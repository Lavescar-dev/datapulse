import { createMemo, createResource, For, onCleanup, Show } from 'solid-js';
import type { CoinData, FearGreedIndex, MarketStats as MarketStatsType } from '../../../../shared/types/crypto';
import { apiJson } from '../../lib/api';
import { createLocaleSignal } from '../../lib/locale';

type CryptoDashboardPayload = {
  coins: CoinData[];
  fearGreedIndex: FearGreedIndex;
  marketStats: MarketStatsType;
};

type PulseTone = 'risk' | 'btc' | 'alt' | 'stable' | 'meme' | 'positive';

const formatMoney = (num: number) => {
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  return `$${num.toLocaleString('en-US')}`;
};

const formatPercent = (value: number | null | undefined, digits = 2) => {
  if (value == null || !Number.isFinite(value)) return 'N/A';
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`;
};

const getTone = (value: number) => {
  if (value <= 25) return 'risk-off';
  if (value <= 45) return 'defensive';
  if (value <= 60) return 'balanced';
  if (value <= 75) return 'risk-on';
  return 'euphoric';
};

const pulseToneClass: Record<PulseTone, string> = {
  risk: 'border-amber-500/20 bg-gradient-to-r from-amber-500/14 to-rose-500/10 text-amber-50',
  btc: 'border-orange-500/20 bg-orange-500/10 text-orange-50',
  alt: 'border-rose-500/20 bg-rose-500/10 text-rose-50',
  stable: 'border-blue-500/20 bg-blue-500/10 text-blue-50',
  meme: 'border-fuchsia-500/20 bg-gradient-to-r from-fuchsia-500/12 to-purple-500/10 text-fuchsia-50',
  positive: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-50',
};

export default function MarketStats() {
  const locale = createLocaleSignal();
  const t = (tr: string, en: string) => (locale() === 'en' ? en : tr);
  const [statsData, { refetch }] = createResource(async () => {
    return await apiJson<CryptoDashboardPayload>('/api/crypto/coins', {
      requireSession: true,
    });
  });

  const interval = setInterval(() => {
    refetch();
  }, 30000);

  onCleanup(() => clearInterval(interval));

  const movers = createMemo(() => {
    const coins = statsData()?.coins ?? [];
    const sortedBy24h = [...coins].sort(
      (a, b) => (b.price_change_percentage_24h ?? -999) - (a.price_change_percentage_24h ?? -999)
    );
    const highestVolume = [...coins].sort((a, b) => b.total_volume - a.total_volume)[0];
    const stablecoinDominance = coins
      .filter((coin) => coin.isStablecoin)
      .reduce((sum, coin) => sum + (coin.market_cap_share ?? 0), 0);
    const memeAverage = average(
      coins.filter((coin) => coin.segment === 'Meme').map((coin) => coin.price_change_percentage_24h ?? 0)
    );
    const altAverage = average(
      coins.filter((coin) => !coin.isStablecoin && coin.id !== 'bitcoin').map((coin) => coin.price_change_percentage_24h ?? 0)
    );

    return {
      topGainer: sortedBy24h[0],
      topLoser: sortedBy24h[sortedBy24h.length - 1],
      highestVolume,
      stablecoinDominance,
      memeAverage,
      altAverage,
    };
  });

  const pulseItems = createMemo(() => {
    const payload = statsData();
    if (!payload) return [] as Array<{ label: string; tone: PulseTone }>;

    const fearGreed = payload.fearGreedIndex.value;
    const btcDominance = payload.marketStats.btc_dominance;
    const stablecoinDominance = movers().stablecoinDominance;
    const altAverage = movers().altAverage;
    const memeAverage = movers().memeAverage;
    const riskTone = getTone(fearGreed);

    return [
      { label: locale() === 'en' ? (riskTone === 'risk-off' || riskTone === 'defensive' ? 'Risk-off view' : 'Risk-on view') : (riskTone === 'risk-off' || riskTone === 'defensive' ? 'Risk-off görünüm' : 'Risk-on görünüm'), tone: riskTone === 'risk-off' || riskTone === 'defensive' ? 'risk' : 'positive' },
      { label: locale() === 'en' ? (btcDominance >= 52 ? 'BTC dominant' : 'BTC dominance neutral') : (btcDominance >= 52 ? 'BTC baskın' : 'BTC dominansı nötr'), tone: 'btc' },
      { label: locale() === 'en' ? (altAverage < 0 ? 'Altcoins weak' : 'Altcoins supported') : (altAverage < 0 ? 'Altcoinler zayıf' : 'Altcoinler destek buluyor'), tone: altAverage < 0 ? 'alt' : 'positive' },
      { label: locale() === 'en' ? (stablecoinDominance >= 8 ? 'Stablecoin weight high' : 'Stablecoin pressure limited') : (stablecoinDominance >= 8 ? 'Stablecoin ağırlığı yüksek' : 'Stablecoin baskısı sınırlı'), tone: stablecoinDominance >= 8 ? 'stable' : 'stable' },
      { label: locale() === 'en' ? (memeAverage < 0 ? 'Meme segment lags' : 'Meme segment active') : (memeAverage < 0 ? 'Meme segmenti geride' : 'Meme segmenti canlı'), tone: 'meme' },
    ] as Array<{ label: string; tone: PulseTone }>;
  });

  const statCards = createMemo(() => {
    const payload = statsData();
    if (!payload) return [];

    return [
      {
        label: t('Fear & Greed', 'Fear & Greed'),
        value: payload.fearGreedIndex.value.toString(),
        detail: payload.fearGreedIndex.value_classification,
        hint: t('Risk iştahı', 'Risk appetite'),
        accent: 'text-amber-300',
      },
      {
        label: t('BTC dominansı', 'BTC dominance'),
        value: `${payload.marketStats.btc_dominance.toFixed(2)}%`,
        detail: t('Pazar yön veriyor', 'Market leads the way'),
        hint: t('Pazar liderliği', 'Market leadership'),
        accent: 'text-orange-300',
      },
      {
        label: t('ETH dominansı', 'ETH dominance'),
        value: `${payload.marketStats.eth_dominance.toFixed(2)}%`,
        detail: t('Akıllı kontrat payı', 'Smart contract share'),
        hint: t('L1 uygulama katmanı', 'L1 application layer'),
        accent: 'text-blue-300',
      },
      {
        label: t('Toplam piyasa değeri', 'Total market cap'),
        value: formatMoney(payload.marketStats.total_market_cap),
        detail: t('Global kripto büyüklüğü', 'Global crypto size'),
        hint: t('Makro risk kapasitesi', 'Macro risk capacity'),
        accent: 'text-cyan-200',
      },
      {
        label: t('24s hacim', '24h volume'),
        value: formatMoney(payload.marketStats.total_volume),
        detail: t('Likidite nabzı', 'Liquidity pulse'),
        hint: t('İşlem aktivitesi', 'Trading activity'),
        accent: 'text-emerald-300',
      },
      {
        label: t('Stablecoin payı', 'Stablecoin share'),
        value: `${movers().stablecoinDominance.toFixed(2)}%`,
        detail: t('Nakit park oranı', 'Cash parking rate'),
        hint: t('Savunmacı konumlanma', 'Defensive positioning'),
        accent: 'text-violet-300',
      },
      {
        label: t('En güçlü', 'Strongest'),
        value: movers().topGainer ? movers().topGainer.symbol.toUpperCase() : '-',
        detail: movers().topGainer ? formatPercent(movers().topGainer.price_change_percentage_24h) : 'N/A',
        hint: movers().topGainer?.name ?? t('Veri yok', 'No data'),
        accent: 'text-emerald-300',
      },
      {
        label: t('En zayıf', 'Weakest'),
        value: movers().topLoser ? movers().topLoser.symbol.toUpperCase() : '-',
        detail: movers().topLoser ? formatPercent(movers().topLoser.price_change_percentage_24h) : 'N/A',
        hint: movers().topLoser?.name ?? t('Veri yok', 'No data'),
        accent: 'text-rose-300',
      },
    ];
  });

  return (
    <div class="space-y-4">
      <Show when={statsData.loading}>
        <div class="dashboard-panel p-6 text-center text-slate-400">
          {t('Piyasa verileri yükleniyor...', 'Market data is loading...')}
        </div>
      </Show>

      <Show when={statsData.error}>
        <div class="dashboard-panel border-rose-900/60 p-6 text-center text-rose-300">
          {t('Hata', 'Error')}: {statsData.error.message}
        </div>
      </Show>

      <Show when={!statsData.loading && !statsData.error && statsData()}>
        <div class="dashboard-panel overflow-hidden crypto-terminal-copy">
          <div class="border-b border-slate-800/70 px-4 py-4 sm:px-5 lg:px-6">
            <div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div class="dashboard-reading-width">
                <div class="crypto-terminal-label text-blue-200/90">{t('Market Pulse', 'Market Pulse')}</div>
                <h2 class="crypto-terminal-heading mt-2">{t('Bugün piyasada ne oluyor?', 'What is happening in the market today?')}</h2>
              </div>
              <div class="flex items-center gap-2 self-start text-sm text-slate-200">
                <svg class="h-4 w-4 text-blue-200" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 6v6l4 2m5-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <span class="crypto-terminal-mono text-sm text-slate-50">
                  {new Date(statsData()!.marketStats.updated_at * 1000).toLocaleTimeString('tr-TR')}
                </span>
                <span class="h-2 w-2 rounded-full bg-emerald-400" />
              </div>
            </div>
            <div class="mt-4 flex flex-wrap gap-2.5">
              <For each={pulseItems()}>
                {(item) => (
                  <span class={`rounded-full border px-3.5 py-1.5 text-sm font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${pulseToneClass[item.tone]}`}>
                    {item.label}
                  </span>
                )}
              </For>
            </div>
          </div>

          <div class="grid gap-px bg-slate-800/30 p-[1px] sm:grid-cols-2 xl:grid-cols-4">
            <For each={statCards()}>
              {(card) => (
                <div class="flex flex-col justify-between bg-slate-900/40 p-4 transition-colors hover:bg-slate-800/40">
                  <div>
                    <div class="crypto-terminal-label text-slate-400">{card.label}</div>
                    <div class={`crypto-terminal-value dashboard-stat-number mt-3 ${card.accent}`}>{card.value}</div>
                  </div>
                  <div class="space-y-1.5">
                    <div class="text-sm font-semibold text-slate-100">{card.detail}</div>
                    <div class="crypto-terminal-subtle text-sm">{card.hint}</div>
                  </div>
                </div>
              )}
            </For>
          </div>

          <div class="grid gap-4 border-t border-slate-800/70 p-4 sm:p-5 sm:grid-cols-2 xl:gap-5">
            <div class="bg-slate-900/40 p-4">
              <div class="flex items-center justify-between gap-3">
                <div>
                <div class="crypto-terminal-label">Movers Snapshot</div>
                  <div class="mt-1 text-xl font-semibold text-white">{t('Pazar yön veriyor', 'Market is setting the direction')}</div>
                </div>
                <div class="crypto-terminal-subtle text-sm">24 saat</div>
              </div>
              <div class="mt-4 grid gap-3 md:grid-cols-3">
                <MoverRow title="En güçlü" status="Yükselen" coin={movers().topGainer} tone="emerald" />
                <MoverRow title="En zayıf" status="Düşen" coin={movers().topLoser} tone="rose" />
                <MoverRow
                  title="Likidite lideri"
                  status="Likidite lideri"
                  coin={movers().highestVolume}
                  tone="blue"
                  metric={movers().highestVolume ? formatMoney(movers().highestVolume.total_volume) : 'N/A'}
                  metricLabel="24s hacim"
                />
              </div>
            </div>

            <div class="bg-slate-900/40 p-4">
                <div class="crypto-terminal-label">{t('Piyasa bağlamı', 'Market context')}</div>
              <div class="mt-1 text-xl font-semibold text-white">{t('Kısa vadeli konumlanma', 'Short-term positioning')}</div>
              <div class="mt-4 space-y-2">
                <ContextRow
                  label={t('BTC / ETH dominans farkı', 'BTC / ETH dominance gap')}
                  value={`${(statsData()!.marketStats.btc_dominance - statsData()!.marketStats.eth_dominance).toFixed(1)} ${t('puan', 'pts')}`}
                  hint={t('Liderlik farkı büyüdükçe rotasyon daralır, BTC ağırlığı artar.', 'As the leadership gap widens, rotation narrows and BTC weight rises.')}
                />
                <ContextRow
                  label={t('Altcoin genişliği', 'Altcoin breadth')}
                  value={formatPercent(movers().altAverage)}
                  hint={t('BTC hariç ortalama 24s performans; piyasanın ne kadar yayıldığını gösterir.', 'Average 24h performance excluding BTC; shows how broad the market is.')}
                />
                <ContextRow
                  label={t('Meme momentumu', 'Meme momentum')}
                  value={formatPercent(movers().memeAverage)}
                  hint={t('Spekülatif risk iştahını okur; hızlanan akış genelde beta arayışını işaret eder.', 'Reads speculative risk appetite; accelerating flow usually signals beta chasing.')}
                />
                <ContextRow
                  label={t('Stablecoin park oranı', 'Stablecoin parking rate')}
                  value={`${movers().stablecoinDominance.toFixed(2)}%`}
                  hint={t('Stablecoin payı yükseldikçe sermayenin kenarda bekleme eğilimi güçlenir.', 'As stablecoin share rises, capital tends to stay on the sidelines.')}
                />
              </div>
            </div>
          </div>
        </div>
      </Show>
    </div>
  );
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function MoverRow(props: {
  title: string;
  status: 'Yükselen' | 'Düşen' | 'Likidite lideri';
  coin?: CoinData;
  tone: 'emerald' | 'rose' | 'blue';
  metric?: string;
  metricLabel?: string;
}) {
  const toneClasses = {
    emerald: 'text-emerald-50',
    rose: 'text-rose-50',
    blue: 'text-blue-50',
  };

  return (
    <div class="flex items-center justify-between gap-3 p-3">
      <div class="flex items-center gap-3">
        <Show when={props.coin} fallback={<div class="crypto-terminal-subtle text-sm">Veri yok</div>}>
          <img src={props.coin!.image} alt={props.coin!.name} class="h-9 w-9 rounded-full" />
          <div class="min-w-0">
            <div class="truncate text-sm font-semibold text-white">{props.coin!.symbol.toUpperCase()}</div>
            <div class="crypto-terminal-subtle text-xs truncate">{props.coin!.name}</div>
          </div>
        </Show>
      </div>
      <Show when={props.coin}>
        <div class="text-right">
          <div class={`crypto-terminal-mono text-lg ${props.tone === 'emerald' ? 'text-emerald-200' : props.tone === 'rose' ? 'text-rose-200' : 'text-blue-200'}`}>
            {props.metric ?? formatPercent(props.coin!.price_change_percentage_24h)}
          </div>
          <div class="crypto-terminal-subtle text-xs">{props.metricLabel ?? '24s'}</div>
        </div>
      </Show>
    </div>
  );
}

function ContextRow(props: { label: string; value: string; hint: string }) {
  return (
    <div class="flex items-center justify-between gap-3 py-2">
      <div class="crypto-terminal-subtle text-sm">{props.label}</div>
      <div class="text-right">
        <div class="crypto-terminal-mono text-base text-white">{props.value}</div>
        <div class="crypto-terminal-subtle text-xs">{props.hint}</div>
      </div>
    </div>
  );
}
