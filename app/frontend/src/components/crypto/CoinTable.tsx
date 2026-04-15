import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  lazy,
  onCleanup,
  onMount,
  Show,
  Suspense,
} from 'solid-js';
import type { CoinData, CoinSegment } from '../../../../shared/types/crypto';
import type { NewsArticle } from '../../../../shared/types/news';
import { apiJson } from '../../lib/api';
import { createLocaleSignal } from '../../lib/locale';

const CoinPopupChart = lazy(() => import('./CoinPopupChart'));

type SortField =
  | 'market_cap_rank'
  | 'current_price'
  | 'market_cap'
  | 'total_volume'
  | 'price_change_percentage_24h'
  | 'price_change_percentage_7d_in_currency'
  | 'market_cap_share';
type SortDirection = 'asc' | 'desc';
type SegmentFilter = 'All' | 'Majors' | 'Stablecoins' | 'DeFi' | 'L1' | 'Meme' | 'RWA';
type SignalFilter = 'All' | 'Gainers' | 'Losers' | 'High Volume' | 'High Volatility';
type PresetView = 'Piyasa Ozeti' | 'Momentum' | 'Likidite' | 'Stablecoinler' | 'Kurumsal / RWA';

type CryptoDashboardPayload = {
  coins: CoinData[];
};

const WATCHLIST_STORAGE_KEY = 'datapulse-crypto-watchlist';
const COMPARE_STORAGE_KEY = 'datapulse-crypto-compare';

const SEGMENT_MATCH: Record<Exclude<SegmentFilter, 'All'>, CoinSegment> = {
  Majors: 'Major',
  Stablecoins: 'Stablecoin',
  DeFi: 'DeFi',
  L1: 'Layer1',
  Meme: 'Meme',
  RWA: 'RWA',
};

const formatPrice = (price: number) => {
  if (price < 1) return `$${price.toFixed(6)}`;
  if (price < 100) return `$${price.toFixed(2)}`;
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatLargeNumber = (num: number) => {
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  return `$${num.toLocaleString('en-US')}`;
};

const getPercentageClass = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) return 'text-slate-400';
  return value >= 0 ? 'text-emerald-300' : 'text-rose-300';
};

const formatPercentage = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) return 'N/A';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
};

const formatAthChange = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) return 'N/A';
  return `${value.toFixed(2)}% düşük`;
};

const formatSupply = (value: number | null | undefined) => {
  if (!value || !Number.isFinite(value)) return 'N/A';
  return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
};

const normalize = (value: string) => value.toLowerCase().trim();

const buildSparklinePath = (prices: number[] | undefined, width: number, height: number) => {
  if (!prices || prices.length < 2) return null;

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = Math.max(max - min, 0.000001);

  return prices
    .map((price, index) => {
      const x = (index / Math.max(prices.length - 1, 1)) * width;
      const y = height - ((price - min) / range) * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
};

const buildNewsMatcher = (coin: CoinData) => {
  const terms = [coin.name, coin.symbol, coin.id]
    .filter(Boolean)
    .map((value) => normalize(value));

  return (article: NewsArticle) => {
    const content = normalize(`${article.title} ${article.description ?? ''} ${article.content ?? ''}`);
    return terms.some((term) => {
      if (term.length <= 2) {
        return content.includes(` ${term} `) || content.startsWith(`${term} `) || content.endsWith(` ${term}`);
      }

      return content.includes(term);
    });
  };
};

const volumeRatio = (coin: CoinData) => (coin.market_cap > 0 ? coin.total_volume / coin.market_cap : 0);

const supplyProgress = (coin: CoinData) => {
  const circulating = coin.circulating_supply || 0;
  const cap = coin.max_supply ?? coin.total_supply ?? coin.circulating_supply ?? 1;
  return Math.min(100, (circulating / Math.max(cap, 1)) * 100);
};

export default function CoinTable() {
  const locale = createLocaleSignal();
  const t = (tr: string, en: string) => (locale() === 'en' ? en : tr);
  const [sortField, setSortField] = createSignal<SortField>('market_cap_rank');
  const [sortDirection, setSortDirection] = createSignal<SortDirection>('asc');
  const [selectedCoin, setSelectedCoin] = createSignal<CoinData | null>(null);
  const [searchQuery, setSearchQuery] = createSignal('');
  const [segmentFilter, setSegmentFilter] = createSignal<SegmentFilter>('All');
  const [signalFilter, setSignalFilter] = createSignal<SignalFilter>('All');
  const [presetView, setPresetView] = createSignal<PresetView>('Piyasa Ozeti');
  const [minimumMarketCap, setMinimumMarketCap] = createSignal(0);
  const [watchlistOnly, setWatchlistOnly] = createSignal(false);
  const [watchlist, setWatchlist] = createSignal<string[]>([]);
  const [compareIds, setCompareIds] = createSignal<string[]>([]);
  const presetOptions = () => [
    { value: 'Piyasa Ozeti', label: t('Piyasa Özeti', 'Market Summary') },
    { value: 'Momentum', label: t('Momentum', 'Momentum') },
    { value: 'Likidite', label: t('Likidite', 'Liquidity') },
    { value: 'Stablecoinler', label: t('Stablecoinler', 'Stablecoins') },
    { value: 'Kurumsal / RWA', label: t('Kurumsal / RWA', 'Institutional / RWA') },
  ] as Array<{ value: PresetView; label: string }>;

  const [coinsData, { refetch }] = createResource(async () => {
    const data = await apiJson<CryptoDashboardPayload>('/api/crypto/coins', {
      requireSession: true,
    });
    return data.coins;
  });

  const [relatedNews] = createResource(
    () => selectedCoin()?.id,
    async () => {
      const active = selectedCoin();
      if (!active) return [] as NewsArticle[];

      const data = await apiJson<{ articles: NewsArticle[] }>('/api/news');
      const matcher = buildNewsMatcher(active);
      return (data.articles ?? []).filter(matcher).slice(0, 4);
    }
  );

  const interval = setInterval(() => {
    refetch();
  }, 30000);

  onCleanup(() => clearInterval(interval));

  onMount(() => {
    const storedWatchlist = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
    const storedCompare = window.localStorage.getItem(COMPARE_STORAGE_KEY);

    if (storedWatchlist) {
      try {
        setWatchlist(JSON.parse(storedWatchlist));
      } catch {
        window.localStorage.removeItem(WATCHLIST_STORAGE_KEY);
      }
    }

    if (storedCompare) {
      try {
        setCompareIds(JSON.parse(storedCompare));
      } catch {
        window.localStorage.removeItem(COMPARE_STORAGE_KEY);
      }
    }
  });

  createEffect(() => {
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlist()));
  });

  createEffect(() => {
    window.localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(compareIds()));
  });

  createEffect(() => {
    const activeCoin = selectedCoin();
    const latestCoins = coinsData();

    if (!activeCoin || !latestCoins) return;

    const nextCoin = latestCoins.find((coin) => coin.id === activeCoin.id);
    if (nextCoin && nextCoin !== activeCoin) {
      setSelectedCoin(nextCoin);
    }
  });

  const compareCoins = createMemo(() => {
    const ids = compareIds();
    const coins = coinsData() ?? [];
    return ids.map((id) => coins.find((coin) => coin.id === id)).filter((coin): coin is CoinData => Boolean(coin));
  });

  const filteredCoins = createMemo(() => {
    const coins = coinsData() ?? [];
    const query = normalize(searchQuery());
    const currentSegment = segmentFilter();
    const currentSignal = signalFilter();
    const minCap = minimumMarketCap();
    const watchIds = new Set(watchlist());

    return coins.filter((coin) => {
      if (query) {
        const haystack = normalize(`${coin.name} ${coin.symbol} ${coin.id}`);
        if (!haystack.includes(query)) return false;
      }

      if (currentSegment !== 'All' && coin.segment !== SEGMENT_MATCH[currentSegment]) {
        return false;
      }

      if (watchlistOnly() && !watchIds.has(coin.id)) {
        return false;
      }

      if (coin.market_cap < minCap) {
        return false;
      }

      switch (currentSignal) {
        case 'Gainers':
          return (coin.price_change_percentage_24h ?? 0) > 0;
        case 'Losers':
          return (coin.price_change_percentage_24h ?? 0) < 0;
        case 'High Volume':
          return volumeRatio(coin) >= 0.12 || coin.total_volume >= 1e10;
        case 'High Volatility':
          return Math.abs(coin.price_change_percentage_24h ?? 0) >= 6 || Math.abs(coin.price_change_percentage_7d_in_currency ?? 0) >= 15;
        default:
          return true;
      }
    });
  });

  const sortedCoins = createMemo(() => {
    const sorted = [...filteredCoins()].sort((a, b) => {
      const field = sortField();
      const direction = sortDirection();
      const aVal = a[field] ?? 0;
      const bVal = b[field] ?? 0;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });

    return sorted;
  });

  const movers = createMemo(() => {
    const coins = coinsData() ?? [];
    const by24h = [...coins].sort((a, b) => (b.price_change_percentage_24h ?? -999) - (a.price_change_percentage_24h ?? -999));
    const byVolume = [...coins].sort((a, b) => b.total_volume - a.total_volume);
    const byVolatility = [...coins].sort(
      (a, b) => Math.abs(b.price_change_percentage_24h ?? 0) - Math.abs(a.price_change_percentage_24h ?? 0)
    );

    return {
      gainers: by24h.slice(0, 3),
      losers: by24h.slice(-3).reverse(),
      volume: byVolume.slice(0, 3),
      volatility: byVolatility.slice(0, 3),
    };
  });

  const summaryStats = createMemo(() => {
    const visible = filteredCoins();
    const watchIds = new Set(watchlist());
    const anomalies = visible.reduce((sum, coin) => sum + (coin.anomaly_badges?.length ? 1 : 0), 0);

    return {
      total: visible.length,
      gainers: visible.filter((coin) => (coin.price_change_percentage_24h ?? 0) > 0).length,
      watchlistCount: visible.filter((coin) => watchIds.has(coin.id)).length,
      anomalies,
    };
  });

  const handleSort = (field: SortField) => {
    if (sortField() === field) {
      setSortDirection(sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection(field === 'market_cap_rank' ? 'asc' : 'desc');
    }
  };

  const toggleWatchlist = (coinId: string) => {
    setWatchlist((current) => current.includes(coinId)
      ? current.filter((id) => id !== coinId)
      : [...current, coinId]);
  };

  const toggleCompare = (coinId: string) => {
    setCompareIds((current) => {
      if (current.includes(coinId)) return current.filter((id) => id !== coinId);
      if (current.length >= 3) return [...current.slice(1), coinId];
      return [...current, coinId];
    });
  };

  const applyPreset = (preset: PresetView) => {
    setPresetView(preset);

    if (preset === 'Piyasa Ozeti') {
      setSegmentFilter('All');
      setSignalFilter('All');
      setMinimumMarketCap(1_000_000_000);
      setSortField('market_cap_rank');
      setSortDirection('asc');
      return;
    }

    if (preset === 'Momentum') {
      setSegmentFilter('All');
      setSignalFilter('High Volatility');
      setMinimumMarketCap(500_000_000);
      setSortField('price_change_percentage_24h');
      setSortDirection('desc');
      return;
    }

    if (preset === 'Likidite') {
      setSegmentFilter('All');
      setSignalFilter('High Volume');
      setMinimumMarketCap(1_000_000_000);
      setSortField('total_volume');
      setSortDirection('desc');
      return;
    }

    if (preset === 'Stablecoinler') {
      setSegmentFilter('Stablecoins');
      setSignalFilter('All');
      setMinimumMarketCap(100_000_000);
      setSortField('market_cap');
      setSortDirection('desc');
      return;
    }

    setSegmentFilter('RWA');
    setSignalFilter('All');
    setMinimumMarketCap(100_000_000);
    setSortField('market_cap');
    setSortDirection('desc');
  };

  return (
    <div class="space-y-5 bg-slate-950/20 p-4 sm:p-5 crypto-terminal-copy">
      <Show when={coinsData.loading}>
        <div class="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-slate-400">{t('Veriler yükleniyor...', 'Data is loading...')}</div>
      </Show>

      <Show when={coinsData.error}>
        <div class="rounded-2xl border border-rose-900/60 bg-slate-900/60 p-8 text-center text-rose-300">
          {t('Hata', 'Error')}: {coinsData.error.message}
        </div>
      </Show>

      <Show when={!coinsData.loading && !coinsData.error}>
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MoverPanel title={t('Yükselenler', 'Gainers')} items={movers().gainers} tone="emerald" />
          <MoverPanel title={t('Düşenler', 'Losers')} items={movers().losers} tone="rose" />
          <MoverPanel title={t('Yüksek hacim', 'High Volume')} items={movers().volume} tone="sky" mode="volume" />
          <MoverPanel title={t('Yüksek oynaklık', 'High Volatility')} items={movers().volatility} tone="amber" mode="volatility" />
        </div>

        <div class="rounded-2xl border border-slate-800/70 bg-slate-950/45 p-3 shadow-[inset_0_1px_0_rgba(148,163,184,0.06)]">
          <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span class="text-slate-400">{t('Görünen', 'Visible')}: <span class="font-semibold text-white">{summaryStats().total}</span></span>
            <span class="text-slate-400">{t('Pozitif', 'Positive')}: <span class="font-semibold text-emerald-300">{summaryStats().gainers}</span></span>
            <span class="text-slate-400">{t('Watchlist', 'Watchlist')}: <span class="font-semibold text-amber-300">{watchlist().length}</span></span>
          </div>
          
          <div class="mt-3 flex flex-wrap gap-2">
            <For each={presetOptions()}>
              {(preset) => (
                <button
                  type="button"
                  onClick={() => applyPreset(preset.value)}
                  class={`rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                    presetView() === preset.value
                      ? 'border-sky-400/40 bg-sky-400/12 text-sky-100'
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {preset.label}
                </button>
              )}
            </For>
          </div>

          <div class="mt-3 flex flex-wrap items-center gap-2">
            <div class="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2">
              <svg class="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m21 21-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0Z" />
              </svg>
              <input
                value={searchQuery()}
                onInput={(event) => setSearchQuery(event.currentTarget.value)}
                placeholder={t('Coin ara...', 'Search coins...')}
                class="w-24 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
              />
            </div>

            <select
              value={segmentFilter()}
              onChange={(e) => setSegmentFilter(e.currentTarget.value as SegmentFilter)}
              class="rounded-lg border border-slate-700 bg-slate-900/50 px-2 py-2 text-xs font-medium text-white"
            >
              <option value="All">{t('Segment', 'Segment')}</option>
              <option value="Majors">{t('Majors', 'Majors')}</option>
              <option value="Stablecoins">{t('Stablecoinler', 'Stablecoins')}</option>
              <option value="DeFi">{t('DeFi', 'DeFi')}</option>
              <option value="L1">{t('L1', 'L1')}</option>
              <option value="Meme">{t('Meme', 'Meme')}</option>
              <option value="RWA">{t('RWA', 'RWA')}</option>
            </select>

            <select
              value={signalFilter()}
              onChange={(e) => setSignalFilter(e.currentTarget.value as SignalFilter)}
              class="rounded-lg border border-slate-700 bg-slate-900/50 px-2 py-2 text-xs font-medium text-white"
            >
              <option value="All">{t('Sinyal', 'Signal')}</option>
              <option value="Gainers">{t('Yükselenler', 'Gainers')}</option>
              <option value="Losers">{t('Düşenler', 'Losers')}</option>
              <option value="High Volume">{t('Yüksek hacim', 'High Volume')}</option>
              <option value="High Volatility">{t('Yüksek oynaklık', 'High Volatility')}</option>
            </select>

            <select
              value={String(minimumMarketCap())}
              onChange={(e) => setMinimumMarketCap(Number(e.currentTarget.value))}
              class="rounded-lg border border-slate-700 bg-slate-900/50 px-2 py-2 text-xs font-medium text-white"
            >
              <option value="0">{t('Min cap', 'Min cap')}</option>
              <option value="100000000">$100M+</option>
              <option value="1000000000">$1B+</option>
              <option value="10000000000">$10B+</option>
            </select>
          </div>
        </div>

        <Show when={compareCoins().length > 0}>
          <div class="rounded-2xl border border-sky-500/20 bg-sky-500/8 p-4">
            <div class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div class="crypto-terminal-label text-sky-100">{t('Karşılaştırma modu', 'Compare mode')}</div>
                 <div class="crypto-terminal-copy mt-1 text-base text-sky-50">{t('Popup içinde karşılaştırma için', 'Selected for popup comparison')} {compareCoins().length}/3 {t('coin seçildi.', 'coins selected.')}</div>
              </div>
              <button
                type="button"
                onClick={() => setCompareIds([])}
                class="rounded-full border border-sky-400/30 px-3 py-1.5 text-xs font-medium text-sky-100 hover:bg-sky-400/10"
                >
                 {t('Seçimleri temizle', 'Clear selections')}
              </button>
            </div>
            <div class="mt-3 flex flex-wrap gap-2">
              <For each={compareCoins()}>
                {(coin) => (
                  <button
                    type="button"
                    onClick={() => setSelectedCoin(coin)}
                    class="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 px-3.5 py-2 text-sm font-semibold text-slate-100"
                  >
                    <img src={coin.image} alt={coin.name} class="h-4 w-4 rounded-full" />
                    {coin.symbol.toUpperCase()}
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>

        <div class="overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-950/45">
          <div class="max-h-[72vh] overflow-auto md:[--sticky-left:0px]">
            <table class="min-w-full border-separate border-spacing-0 text-sm">
              <thead class="sticky top-0 z-30 bg-slate-900/95 backdrop-blur">
                <tr class="text-slate-300">
                  <StickyTh class="min-w-[180px] md:left-0 md:min-w-[240px] text-left">{t('Coin', 'Coin')}</StickyTh>
                  <SortableTh label={t('Fiyat', 'Price')} field="current_price" onSort={handleSort} sortField={sortField()} sortDirection={sortDirection()} align="right" />
                  <SortableTh label={t('24s', '24h')} field="price_change_percentage_24h" onSort={handleSort} sortField={sortField()} sortDirection={sortDirection()} align="right" />
                  <SortableTh class="hidden md:table-cell" label={t('7g', '7d')} field="price_change_percentage_7d_in_currency" onSort={handleSort} sortField={sortField()} sortDirection={sortDirection()} align="right" />
                  <SortableTh class="hidden lg:table-cell" label={t('Piyasa Değeri', 'Market Cap')} field="market_cap" onSort={handleSort} sortField={sortField()} sortDirection={sortDirection()} align="right" />
                  <SortableTh class="hidden lg:table-cell" label={t('Hacim', 'Volume')} field="total_volume" onSort={handleSort} sortField={sortField()} sortDirection={sortDirection()} align="right" />
                  <SortableTh class="hidden xl:table-cell" label={t('Pay', 'Share')} field="market_cap_share" onSort={handleSort} sortField={sortField()} sortDirection={sortDirection()} align="right" />
                  <th class="hidden sm:table-cell px-4 py-3 text-right text-xs font-medium uppercase tracking-[0.24em] text-slate-500">{t('Spark', 'Spark')}</th>
                </tr>
              </thead>
              <tbody>
                <For each={sortedCoins()}>
                  {(coin, index) => {
                    const isTopTen = () => coin.market_cap_rank <= 10;
                    const isWatching = () => watchlist().includes(coin.id);
                    const isComparing = () => compareIds().includes(coin.id);
                    return (
                      <tr
                        class={`group border-t border-slate-800/70 transition-all hover:bg-slate-900/70 ${isTopTen() ? 'bg-slate-900/25' : ''}`}
                        onClick={() => setSelectedCoin(coin)}
                      >
                        <td class="border-t border-slate-800/70 bg-inherit px-3 py-[var(--dashboard-row-density)] md:sticky md:left-0 md:z-20">
                          <div class="flex items-start gap-3">
                            <div class="mt-1 flex flex-col gap-2">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleWatchlist(coin.id);
                                }}
                                class={`rounded-full border p-1 transition-all ${isWatching() ? 'border-amber-400/40 bg-amber-400/15 text-amber-200' : 'border-slate-700 text-slate-500 hover:text-amber-200'}`}
                                aria-label="watchlist"
                              >
                                <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill={isWatching() ? 'currentColor' : 'none'} stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="m12 3.75 2.62 5.3 5.85.85-4.23 4.12 1 5.82L12 17.06l-5.24 2.78 1-5.82-4.23-4.12 5.85-.85L12 3.75Z" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  toggleCompare(coin.id);
                                }}
                                class={`rounded-full border p-1 transition-all ${isComparing() ? 'border-sky-400/40 bg-sky-400/15 text-sky-100' : 'border-slate-700 text-slate-500 hover:text-sky-100'}`}
                                aria-label="compare"
                              >
                                <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 19h16M6 16l4-4 3 3 5-7" />
                                </svg>
                              </button>
                            </div>

                            <img src={coin.image} alt={coin.name} class={`mt-0.5 h-10 w-10 rounded-full ${isTopTen() ? 'ring-2 ring-sky-400/20' : ''}`} />
                            <div class="min-w-0 flex-1">
                              <div class="flex flex-wrap items-center gap-2">
                                <span class={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-[11px] font-semibold ${isTopTen() ? 'bg-sky-400/15 text-sky-100' : 'bg-slate-800 text-slate-400'}`}>
                                  #{coin.market_cap_rank}
                                </span>
                                <div class="crypto-terminal-value text-base">{coin.name}</div>
                                <span class="crypto-terminal-subtle text-xs uppercase">{coin.symbol}</span>
                                <span class="rounded-full border border-slate-700 bg-slate-900/70 px-2.5 py-1 text-[11px] font-semibold text-slate-200">
                                  {coin.segment ?? t('Diğer', 'Other')}
                                </span>
                              </div>
                              <div class="mt-1 flex flex-wrap gap-1.5">
                                <Show when={isTopTen()}>
                                  <span class="rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[10px] font-medium text-sky-100">{t('İlk 10', 'Top 10')}</span>
                                </Show>
                                <For each={(coin.anomaly_badges ?? []).slice(0, 2)}>
                                  {(badge) => (
                                    <span class="rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-100">
                                      {badge}
                                    </span>
                                  )}
                                </For>
                              </div>
                            </div>
                          </div>
                        </td>
                          <td class="px-3 py-[var(--dashboard-row-density)] text-right crypto-terminal-mono text-base">{formatPrice(coin.current_price)}</td>
                          <td class={`px-3 py-[var(--dashboard-row-density)] text-right font-semibold ${getPercentageClass(coin.price_change_percentage_24h)}`}>{formatPercentage(coin.price_change_percentage_24h)}</td>
                          <td class={`hidden md:table-cell px-3 py-[var(--dashboard-row-density)] text-right font-semibold ${getPercentageClass(coin.price_change_percentage_7d_in_currency)}`}>{formatPercentage(coin.price_change_percentage_7d_in_currency)}</td>
                          <td class="hidden lg:table-cell px-3 py-[var(--dashboard-row-density)] text-right crypto-terminal-mono text-slate-100">{formatLargeNumber(coin.market_cap)}</td>
                          <td class="hidden lg:table-cell px-3 py-[var(--dashboard-row-density)] text-right crypto-terminal-mono text-slate-300">{formatLargeNumber(coin.total_volume)}</td>
                          <td class="hidden xl:table-cell px-3 py-[var(--dashboard-row-density)] text-right crypto-terminal-value text-sm text-slate-100">{(coin.market_cap_share ?? 0).toFixed(2)}%</td>
                          <td class="hidden sm:table-cell px-3 py-[var(--dashboard-row-density)]">
                           <RowSparkline coin={coin} />
                        </td>
                      </tr>
                    );
                  }}
                </For>
              </tbody>
            </table>

            <Show when={sortedCoins().length === 0}>
                  <div class="p-10 text-center text-slate-400">{t('Filtrelere uyan coin bulunamadı.', 'No coins matched the filters.')}</div>
            </Show>
          </div>
        </div>
      </Show>

      <Show when={selectedCoin()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4 backdrop-blur-sm" onClick={() => setSelectedCoin(null)}>
          <div class="max-h-[96vh] h-[96vh] w-[calc(100vw-1rem)] overflow-auto rounded-[1.4rem] border border-slate-800/70 bg-[#0a0e1a] shadow-2xl shadow-black/50 sm:h-auto sm:w-[var(--dashboard-popup-width)]" onClick={(event) => event.stopPropagation()}>
            <div class="relative overflow-hidden rounded-t-[1.4rem] border-b border-slate-800/60 bg-[linear-gradient(180deg,rgba(16,22,40,0.98),rgba(8,12,24,0.98))] px-4 py-5 sm:px-6 sm:py-6">
              <div class="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.03),transparent)]" />
              <div class="relative flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                <div class="flex items-start gap-4">
                  <img src={selectedCoin()!.image} alt={selectedCoin()!.name} class="h-16 w-16 rounded-full ring-2 ring-slate-700/50" />
                  <div>
                    <div class="flex flex-wrap items-center gap-2.5">
                      <h2 class="crypto-terminal-heading text-3xl">{selectedCoin()!.name}</h2>
                      <span class="rounded-full border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-sm font-semibold uppercase text-slate-100">{selectedCoin()!.symbol}</span>
                      <span class="rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-sm font-semibold text-sky-50">#{selectedCoin()!.market_cap_rank}</span>
                      <span class="rounded-full border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-sm font-semibold text-slate-100">{selectedCoin()!.segment ?? t('Diğer', 'Other')}</span>
                    </div>
                     <div class="mt-4 flex flex-wrap items-end gap-2.5">
                      <span class="crypto-terminal-mono text-4xl">{formatPrice(selectedCoin()!.current_price)}</span>
                      <span class={`rounded-full px-3 py-1.5 text-sm font-bold ${getPercentageClass(selectedCoin()!.price_change_percentage_24h)} bg-slate-900/70`}>{formatPercentage(selectedCoin()!.price_change_percentage_24h)}</span>
                      <span class="rounded-full bg-slate-900/70 px-3 py-1.5 text-sm font-semibold text-slate-100">{t('7g', '7d')} {formatPercentage(selectedCoin()!.price_change_percentage_7d_in_currency)}</span>
                      <span class="rounded-full bg-slate-900/70 px-3 py-1.5 text-sm font-semibold text-slate-100">{t('30g', '30d')} {formatPercentage(selectedCoin()!.price_change_percentage_30d_in_currency)}</span>
                    </div>
                    <div class="mt-4 flex flex-wrap gap-2">
                      <ExternalLinkButton href={selectedCoin()!.links?.coingecko} label="CoinGecko" />
                      <Show when={selectedCoin()!.links?.homepage}>
                        <ExternalLinkButton href={selectedCoin()!.links?.homepage} label={t('Resmî', 'Official')} />
                      </Show>
                      <Show when={selectedCoin()!.links?.explorer}>
                        <ExternalLinkButton href={selectedCoin()!.links?.explorer} label={t('Gezgin', 'Explorer')} />
                      </Show>
                    </div>
                  </div>
                </div>

                 <div class="grid gap-3 sm:grid-cols-2 xl:min-w-[360px]">
                  <QuickStat label={t('Piyasa Değeri', 'Market Cap')} value={formatLargeNumber(selectedCoin()!.market_cap)} />
                  <QuickStat label={t('24s Hacim', '24h Volume')} value={formatLargeNumber(selectedCoin()!.total_volume)} />
                  <QuickStat label={t('Hacim / Piyasa Değeri', 'Volume / MCap')} value={`${(volumeRatio(selectedCoin()!) * 100).toFixed(2)}%`} />
                  <QuickStat label={t('Pazar payı', 'Dominance share')} value={`${(selectedCoin()!.market_cap_share ?? 0).toFixed(2)}%`} />
                </div>
              </div>
            </div>

            <div class="grid gap-5 p-4 sm:p-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.92fr)] 2xl:grid-cols-[minmax(0,1.55fr)_minmax(360px,0.88fr)]">
              <div class="space-y-5">
                <Suspense fallback={<div class="flex h-[340px] items-center justify-center rounded-2xl border border-slate-800/60 bg-slate-900/30 text-sm text-slate-400">{t('Grafik yükleniyor...', 'Chart loading...')}</div>}>
                  <CoinPopupChart coin={selectedCoin()!} />
                </Suspense>
              </div>

              <div class="space-y-4">
                <InfoCard title={t('Hızlı istatistikler', 'Quick stats')} subtitle={t('ATH, ATL ve arz metrikleri', 'ATH, ATL, and supply metrics')}>
                  <MetricRow label="ATH" value={formatPrice(selectedCoin()!.ath)} hint={new Date(selectedCoin()!.ath_date).toLocaleDateString(locale() === 'en' ? 'en-US' : 'tr-TR')} />
                  <MetricRow label={t('ATH uzaklık', 'ATH distance')} value={formatAthChange(selectedCoin()!.ath_change_percentage)} hint={t('Mevcut fiyat farkı', 'Current price gap')} />
                  <MetricRow label="ATL" value={formatPrice(selectedCoin()!.atl)} hint={new Date(selectedCoin()!.atl_date).toLocaleDateString(locale() === 'en' ? 'en-US' : 'tr-TR')} />
                  <MetricRow label={t("ATL'den toparlanma", 'Recovery from ATL')} value={formatPercentage(selectedCoin()!.atl_change_percentage)} hint={t('Dipten performans', 'Performance from the low')} />
                </InfoCard>

                <InfoCard title={t('Arz ilerlemesi', 'Supply progress')} subtitle={t('Dolaşımdaki arz / maksimum arz', 'Circulating supply / max supply')}>
                  <div class="text-sm text-slate-300">
                    {formatSupply(selectedCoin()!.circulating_supply)} / {formatSupply(selectedCoin()!.max_supply ?? selectedCoin()!.total_supply)}
                  </div>
                  <div class="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      class="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400"
                      style={{ width: `${supplyProgress(selectedCoin()!)}%` }}
                    />
                  </div>
                  <div class="mt-3 grid gap-2 text-sm text-slate-400">
                    <MetricRow label={t('Dolaşımdaki arz', 'Circulating')} value={formatSupply(selectedCoin()!.circulating_supply)} />
                    <MetricRow label={t('Maksimum arz', 'Max supply')} value={formatSupply(selectedCoin()!.max_supply)} />
                    <MetricRow label={t('Toplam arz', 'Total supply')} value={formatSupply(selectedCoin()!.total_supply)} />
                  </div>
                </InfoCard>
              </div>
            </div>

            <div class="grid gap-5 border-t border-slate-800/60 p-4 sm:p-6 md:grid-cols-2 2xl:grid-cols-3">
              <InfoCard title={t('İlgili haberler', 'Related news')} subtitle={t('DataPulse haber akışı ile eşleşen başlıklar', 'Headlines matched with the DataPulse news stream')}>
                <Show when={relatedNews.loading}>
                  <div class="crypto-terminal-copy text-base text-slate-200">{t('Haberler aranıyor...', 'Searching news...')}</div>
                </Show>
                <Show when={!relatedNews.loading && relatedNews()?.length === 0}>
                  <div class="crypto-terminal-copy text-base text-slate-200">{t('Bu coin ile eşleşen haber bulunamadı.', 'No matching news found for this coin.')}</div>
                </Show>
                <div class="space-y-3">
                  <For each={relatedNews() ?? []}>
                    {(article) => (
                      <a href={article.link} target="_blank" rel="noreferrer" class="block rounded-xl border border-slate-800/70 bg-slate-950/35 p-4 transition-colors hover:border-slate-700 hover:bg-slate-900/60">
                        <div class="crypto-terminal-label text-sky-100">{article.sourceName}</div>
                        <div class="crypto-terminal-copy mt-2 text-base leading-7 text-white">{article.title}</div>
                        <div class="crypto-terminal-subtle mt-3 text-sm">{new Date(article.pubDate).toLocaleString('tr-TR')}</div>
                      </a>
                    )}
                  </For>
                </div>
              </InfoCard>

              <InfoCard title={t('Bağlam kartları', 'Context cards')} subtitle={t('Anomali, oran ve pozisyonlama', 'Anomaly, ratio, and positioning')}>
                <MetricRow label={t('Segment', 'Segment')} value={selectedCoin()!.segment ?? t('Diğer', 'Other')} hint={selectedCoin()!.isStablecoin ? t('Stablecoin bayrağı aktif', 'Stablecoin flag active') : selectedCoin()!.isRwaLike ? t('RWA-benzeri sınıf', 'RWA-like class') : t('Çekirdek varlık', 'Core asset')} />
                <MetricRow label={t('Hacim / Piyasa değeri', 'Vol / MCap')} value={`${(volumeRatio(selectedCoin()!) * 100).toFixed(2)}%`} hint={t('Likidite yoğunluğu', 'Liquidity density')} />
                <MetricRow label={t('Pazar payı', 'Market share')} value={`${(selectedCoin()!.market_cap_share ?? 0).toFixed(2)}%`} hint={t('Global piyasa değeri içindeki pay', 'Share within global cap')} />
                <div class="mt-3 flex flex-wrap gap-2">
                  <For each={selectedCoin()!.anomaly_badges ?? []}>
                    {(badge) => <span class="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-100">{badge}</span>}
                  </For>
                </div>
              </InfoCard>

              <InfoCard title={t('Karşılaştır', 'Compare')} subtitle={t('Seçili 2-3 coin hızlı karşılaştırma', 'Quick comparison for 2-3 selected coins')}>
                <Show when={compareCoins().length === 0}>
                  <div class="crypto-terminal-copy text-base text-slate-200">{t("Tablodan karşılaştırma butonuyla 3 coin'e kadar seç.", 'Pick up to 3 coins using the table compare button.')}</div>
                </Show>
                <div class="space-y-3">
                  <For each={compareCoins()}>
                    {(coin) => (
                      <button type="button" onClick={() => setSelectedCoin(coin)} class={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition-all ${coin.id === selectedCoin()!.id ? 'border-sky-400/30 bg-sky-400/8' : 'border-slate-800/70 bg-slate-950/35 hover:border-slate-700'}`}>
                        <div class="flex items-center gap-3">
                          <img src={coin.image} alt={coin.name} class="h-8 w-8 rounded-full" />
                          <div>
                            <div class="font-medium text-white">{coin.name}</div>
                            <div class="text-xs uppercase text-slate-500">{coin.symbol}</div>
                          </div>
                        </div>
                        <div class="text-right">
                          <div class="font-mono text-sm text-white">{formatPrice(coin.current_price)}</div>
                          <div class={`text-xs font-medium ${getPercentageClass(coin.price_change_percentage_24h)}`}>{formatPercentage(coin.price_change_percentage_24h)}</div>
                        </div>
                      </button>
                    )}
                  </For>
                </div>
              </InfoCard>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

function StickyTh(props: { class?: string; children: any }) {
  return <th class={`crypto-terminal-label z-30 bg-slate-900/95 px-3 py-3 text-left text-slate-200 backdrop-blur md:sticky ${props.class ?? ''}`}>{props.children}</th>;
}

function SortableTh(props: {
  label: string;
  field: SortField;
  onSort: (field: SortField) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  align?: 'left' | 'right';
  class?: string;
}) {
  const active = () => props.sortField === props.field;
  return (
    <th
      class={`crypto-terminal-label px-3 py-3 text-slate-200 ${props.align === 'right' ? 'text-right' : 'text-left'} cursor-pointer hover:bg-slate-800/60 ${props.class ?? ''}`}
      onClick={() => props.onSort(props.field)}
    >
      {props.label} {active() ? (props.sortDirection === 'asc' ? '▲' : '▼') : '⇅'}
    </th>
  );
}

function SelectFilter(props: {
  label: string;
  value: string;
  options: Array<string | { label: string; value: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div class="flex items-center gap-2">
      <span class="crypto-terminal-label text-sm text-slate-500">{props.label}:</span>
      <select value={props.value} onChange={(event) => props.onChange(event.currentTarget.value)} class="appearance-none bg-transparent text-sm font-semibold text-white outline-none cursor-pointer">
        <For each={props.options}>
          {(option) => {
            const value = typeof option === 'string' ? option : option.value;
            const label = typeof option === 'string' ? option : option.label;
            return <option value={value}>{label}</option>;
          }}
        </For>
      </select>
    </div>
  );
}

function StatPill(props: { label: string; value: string; detail?: string }) {
  return (
    <div class="flex items-center gap-4 py-2">
      <div class="crypto-terminal-label text-slate-500">{props.label}</div>
      <div class="crypto-terminal-value dashboard-stat-number text-white">{props.value}</div>
      <Show when={props.detail}>
        <div class="crypto-terminal-subtle text-sm">{props.detail}</div>
      </Show>
    </div>
  );
}

function MoverPanel(props: {
  title: string;
  items: CoinData[];
  tone: 'emerald' | 'rose' | 'sky' | 'amber';
  mode?: 'default' | 'volume' | 'volatility';
}) {
  const tones = {
    emerald: 'border-emerald-500/20 bg-emerald-500/8',
    rose: 'border-rose-500/20 bg-rose-500/8',
    sky: 'border-sky-500/20 bg-sky-500/8',
    amber: 'border-amber-500/20 bg-amber-500/8',
  };

  return (
    <div class={`rounded-2xl border p-4 ${tones[props.tone]} shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]`}>
      <div class="crypto-terminal-label text-slate-100">{props.title}</div>
      <div class="mt-3 space-y-3">
        <For each={props.items}>
          {(coin) => (
            <div class="flex items-center justify-between gap-3 rounded-xl border border-slate-800/60 bg-slate-950/35 px-3 py-2.5">
              <div class="flex items-center gap-3">
                <img src={coin.image} alt={coin.name} class="h-8 w-8 rounded-full" />
                <div>
                  <div class="crypto-terminal-value text-base">{coin.name}</div>
                  <div class="crypto-terminal-subtle text-xs uppercase">{coin.symbol}</div>
                </div>
              </div>
              <div class={`text-right text-base font-bold ${props.mode === 'volume' ? 'crypto-terminal-mono text-sky-100' : props.mode === 'volatility' ? 'crypto-terminal-value text-amber-100' : getPercentageClass(coin.price_change_percentage_24h)}`}>
                {props.mode === 'volume'
                  ? formatLargeNumber(coin.total_volume)
                  : props.mode === 'volatility'
                    ? formatPercentage(Math.abs(coin.price_change_percentage_24h ?? 0))
                    : formatPercentage(coin.price_change_percentage_24h)}
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

function RowSparkline(props: { coin: CoinData }) {
  const path = createMemo(() => buildSparklinePath(props.coin.sparkline_in_7d?.price, 96, 32));
  const positive = () => (props.coin.price_change_percentage_7d_in_currency ?? 0) >= 0;

  return (
    <div class="flex justify-end">
      <svg viewBox="0 0 96 32" class="h-8 w-24 overflow-visible">
        <path d="M0 31.5H96" stroke="rgba(71,85,105,0.45)" />
        <Show when={path()}>
          <path d={path()!} fill="none" stroke={positive() ? '#34d399' : '#fb7185'} stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
        </Show>
      </svg>
    </div>
  );
}

function ExternalLinkButton(props: { href?: string | null; label: string }) {
  return (
		<a href={props.href ?? '#'} target="_blank" rel="noreferrer" class="rounded-full border border-slate-700 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-100 transition-colors hover:border-slate-600 hover:text-white">
      {props.label}
    </a>
  );
}

function QuickStat(props: { label: string; value: string }) {
  return (
    <div class="rounded-xl border border-slate-800/70 bg-slate-950/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div class="crypto-terminal-label">{props.label}</div>
      <div class="crypto-terminal-mono mt-2 text-lg">{props.value}</div>
    </div>
  );
}

function InfoCard(props: { title: string; subtitle: string; children: any }) {
  return (
    <div class="rounded-2xl border border-slate-800/70 bg-slate-950/35 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <div class="crypto-terminal-label">{props.title}</div>
      <div class="crypto-terminal-copy mt-2 text-base leading-6 text-slate-100">{props.subtitle}</div>
      <div class="mt-4 space-y-3">{props.children}</div>
    </div>
  );
}

function MetricRow(props: { label: string; value: string; hint?: string }) {
  return (
    <div class="rounded-xl border border-slate-800/70 bg-slate-900/40 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
      <div class="flex items-center justify-between gap-3">
        <span class="crypto-terminal-copy text-sm">{props.label}</span>
        <span class="crypto-terminal-mono text-right text-sm">{props.value}</span>
      </div>
      <Show when={props.hint}>
        <div class="crypto-terminal-subtle mt-1 text-xs">{props.hint}</div>
      </Show>
    </div>
  );
}
