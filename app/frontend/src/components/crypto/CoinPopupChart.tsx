// @ts-nocheck
import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import type { CoinChartPoint, CoinData } from '../../../../shared/types/crypto';

interface CoinPopupChartProps {
  coin: CoinData;
}

type PopupTab = 'live' | '1h' | '24h' | '7d' | '30d';

const MAX_LIVE_POINTS = 240;
const SVG_WIDTH = 640;
const SVG_HEIGHT = 320;
const SVG_PADDING = { top: 18, right: 14, bottom: 40, left: 14 };
const GRID_LINE_COUNT = 4;
const HOUR_SECONDS = 60 * 60;
const DAY_SECONDS = 24 * HOUR_SECONDS;
const WEEK_SECONDS = 7 * DAY_SECONDS;
const THIRTY_DAY_SECONDS = 30 * DAY_SECONDS;

const TAB_CONFIG: Array<{ id: PopupTab; label: string; subtitle: string }> = [
  { id: 'live', label: 'Canlı', subtitle: 'Son 1 saatlik veri üzerine saniyelik akış eklenir.' },
  { id: '1h', label: '1 Saat', subtitle: 'Son 1 saatin kıvrım grafikten türeyen görünümü.' },
  { id: '24h', label: '24 Saat', subtitle: 'Son 24 saatin eğilimi.' },
  { id: '7d', label: '7 Gün', subtitle: 'Son 7 günün fiyat davranışı.' },
  { id: '30d', label: '30 Gün', subtitle: 'Yaklaşık 30 gün; 7 günlük şekil ve 30 günlük değişimden türetilir.' },
];

const formatSparklinePoints = (prices: number[] | undefined, endTimestamp: number): CoinChartPoint[] => {
  if (!prices || prices.length < 2) return [];

  const startTimestamp = endTimestamp - WEEK_SECONDS;
  const step = WEEK_SECONDS / Math.max(prices.length - 1, 1);

  return prices
    .map((price, index) => ({
      timestamp: Math.round(startTimestamp + step * index),
      price,
    }))
    .filter((point) => Number.isFinite(point.timestamp) && Number.isFinite(point.price));
};

const sliceRecentPoints = (points: CoinChartPoint[], durationSeconds: number): CoinChartPoint[] => {
  if (points.length < 2) return points;

  const endTimestamp = points[points.length - 1]?.timestamp ?? 0;
  const startTimestamp = endTimestamp - durationSeconds;
  const filtered = points.filter((point) => point.timestamp >= startTimestamp);
  return filtered.length >= 2 ? filtered : points.slice(-Math.min(points.length, 2));
};

const calculateChangePercentage = (points: CoinChartPoint[]) => {
  const first = points[0]?.price;
  const last = points[points.length - 1]?.price;
  if (first == null || last == null || first === 0) return null;
  return ((last - first) / first) * 100;
};

const buildApproximateThirtyDayPoints = (
  points: CoinChartPoint[],
  currentPrice: number,
  change30d: number | undefined
): CoinChartPoint[] => {
  if (points.length < 2) return [];

  const endTimestamp = points[points.length - 1]?.timestamp ?? Math.floor(Date.now() / 1000);
  const startTimestamp = endTimestamp - THIRTY_DAY_SECONDS;
  const step = THIRTY_DAY_SECONDS / Math.max(points.length - 1, 1);
  const targetEnd = Number.isFinite(currentPrice) && currentPrice > 0
    ? currentPrice
    : points[points.length - 1]?.price ?? 0;

  if (change30d == null || !Number.isFinite(change30d) || change30d <= -100) {
    return points.map((point, index) => ({
      timestamp: Math.round(startTimestamp + step * index),
      price: point.price,
    }));
  }

  const targetStart = targetEnd / (1 + change30d / 100);
  const baseStart = points[0]?.price ?? targetStart;
  const baseEnd = points[points.length - 1]?.price ?? targetEnd;
  const baseSpan = baseEnd - baseStart;
  const targetSpan = targetEnd - targetStart;

  return points.map((point, index) => {
    const normalized = Math.abs(baseSpan) < 1e-9
      ? index / Math.max(points.length - 1, 1)
      : (point.price - baseStart) / baseSpan;

    return {
      timestamp: Math.round(startTimestamp + step * index),
      price: targetStart + normalized * targetSpan,
    };
  });
};

const formatPrice = (price: number) => {
  if (price < 1) return `$${price.toFixed(6)}`;
  if (price < 100) return `$${price.toFixed(2)}`;
  return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatPercentage = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) return 'Veri yok';
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
};

export default function CoinPopupChart(props: CoinPopupChartProps) {
  const [activeTab, setActiveTab] = createSignal<PopupTab>('live');
  const [livePoints, setLivePoints] = createSignal<CoinChartPoint[]>([]);
  const [hoveredIndex, setHoveredIndex] = createSignal<number | null>(null);
  const [isCompact, setIsCompact] = createSignal(false);
  const [isWide, setIsWide] = createSignal(false);

  let liveSeedKey = '';
  let latestPrice = props.coin.current_price;

  const currentTabConfig = createMemo(() => TAB_CONFIG.find((tab) => tab.id === activeTab()) ?? TAB_CONFIG[0]);
  const chartGradientId = createMemo(() => `coin-popup-chart-fill-${props.coin.id}`);
  const sparklinePoints = createMemo<CoinChartPoint[]>(() => {
    const updatedAt = props.coin.last_updated ? Date.parse(props.coin.last_updated) : Date.now();
    const endTimestamp = Number.isFinite(updatedAt)
      ? Math.floor(updatedAt / 1000)
      : Math.floor(Date.now() / 1000);
    return formatSparklinePoints(props.coin.sparkline_in_7d?.price, endTimestamp);
  });
  const oneHourPoints = createMemo(() => sliceRecentPoints(sparklinePoints(), HOUR_SECONDS));
  const twentyFourHourPoints = createMemo(() => sliceRecentPoints(sparklinePoints(), DAY_SECONDS));
  const thirtyDayPoints = createMemo(() => buildApproximateThirtyDayPoints(
    sparklinePoints(),
    props.coin.current_price,
    props.coin.price_change_percentage_30d_in_currency,
  ));
  const displayedRawPoints = createMemo<CoinChartPoint[]>(() => {
    switch (activeTab()) {
      case 'live':
        return livePoints();
      case '1h':
        return oneHourPoints();
      case '24h':
        return twentyFourHourPoints();
      case '30d':
        return thirtyDayPoints();
      case '7d':
      default:
        return sparklinePoints();
    }
  });
  const selectedRangeChange = createMemo(() => calculateChangePercentage(displayedRawPoints()));
  const trendPositive = createMemo(() => (selectedRangeChange() ?? 0) >= 0);
  const trendClass = createMemo(() => (trendPositive() ? 'text-emerald-300' : 'text-rose-300'));
  const priceClass = createMemo(() => (trendPositive() ? 'text-sky-100' : 'text-rose-100'));
  const pointCount = createMemo(() => displayedRawPoints().length);
  const hasSparkline = createMemo(() => sparklinePoints().length >= 2);
  const hasUsablePoints = createMemo(() => pointCount() >= 2);
  const loadState = createMemo(() => {
    if (!hasSparkline()) return 'fallback';
    if (!hasUsablePoints()) return 'empty';
    return 'ready';
  });

  const formatAxisTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);

    switch (activeTab()) {
      case 'live':
      case '1h':
        return new Intl.DateTimeFormat('tr-TR', {
          hour: '2-digit',
          minute: '2-digit',
        }).format(date);
      case '24h':
        return new Intl.DateTimeFormat('tr-TR', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
        }).format(date);
      default:
        return new Intl.DateTimeFormat('tr-TR', {
          day: '2-digit',
          month: 'short',
        }).format(date);
    }
  };

  const chartGeometry = createMemo(() => {
    const points = displayedRawPoints();
    if (points.length < 2) return null;

    const plotWidth = SVG_WIDTH - SVG_PADDING.left - SVG_PADDING.right;
    const plotHeight = SVG_HEIGHT - SVG_PADDING.top - SVG_PADDING.bottom;
    const prices = points.map((point) => point.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const rawRange = maxPrice - minPrice;
    const buffer = rawRange > 0 ? rawRange * 0.12 : Math.max(Math.abs(maxPrice) * 0.02, 0.000001);
    const domainMin = minPrice - buffer;
    const domainMax = maxPrice + buffer;
    const domainRange = Math.max(domainMax - domainMin, 0.000001);
    const firstTimestamp = points[0]?.timestamp ?? 0;
    const lastTimestamp = points[points.length - 1]?.timestamp ?? firstTimestamp;
    const timestampSpan = Math.max(lastTimestamp - firstTimestamp, points.length - 1, 1);

    const mappedPoints = points.map((point, index) => {
      const xRatio = lastTimestamp === firstTimestamp
        ? index / Math.max(points.length - 1, 1)
        : (point.timestamp - firstTimestamp) / timestampSpan;
      const yRatio = (point.price - domainMin) / domainRange;

      return {
        x: SVG_PADDING.left + xRatio * plotWidth,
        y: SVG_PADDING.top + (1 - yRatio) * plotHeight,
        price: point.price,
        timestamp: point.timestamp,
      };
    });

    const linePath = mappedPoints
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
      .join(' ');
    const firstPoint = mappedPoints[0];
    const lastPoint = mappedPoints[mappedPoints.length - 1];
    const areaPath = `${linePath} L ${lastPoint.x.toFixed(2)} ${(SVG_HEIGHT - SVG_PADDING.bottom).toFixed(2)} L ${firstPoint.x.toFixed(2)} ${(SVG_HEIGHT - SVG_PADDING.bottom).toFixed(2)} Z`;
    const gridLines = Array.from({ length: GRID_LINE_COUNT }, (_, index) => {
      const ratio = index / (GRID_LINE_COUNT - 1);
      const y = SVG_PADDING.top + ratio * plotHeight;
      const value = domainMax - ratio * domainRange;
      return { y, value };
    });
    const axisPoints = [
      mappedPoints[0],
      mappedPoints[Math.floor((mappedPoints.length - 1) / 2)],
      mappedPoints[mappedPoints.length - 1],
    ];

    return {
      linePath,
      areaPath,
      gridLines,
      lastPoint,
      minPrice,
      maxPrice,
      mappedPoints,
      axisPoints,
    };
  });

  const hoveredPoint = createMemo(() => {
    const geometry = chartGeometry();
    const index = hoveredIndex();
    if (!geometry || index == null) return null;
    return geometry.mappedPoints[index] ?? null;
  });

  const activePoint = createMemo(() => hoveredPoint() ?? chartGeometry()?.mappedPoints[chartGeometry()!.mappedPoints.length - 1] ?? null);
  const chartHeightClass = createMemo(() => (isWide() ? 'h-[420px] 2xl:h-[500px]' : isCompact() ? 'h-[260px] sm:h-[300px]' : 'h-[340px] xl:h-[380px]'));

  const appendLivePoint = (points: CoinChartPoint[], price: number) => {
    const nextPoint: CoinChartPoint = {
      timestamp: Math.floor(Date.now() / 1000),
      price,
    };

    const nextPoints = [...points];
    const lastPoint = nextPoints[nextPoints.length - 1];

    if (lastPoint?.timestamp === nextPoint.timestamp) {
      nextPoints[nextPoints.length - 1] = nextPoint;
    } else {
      nextPoints.push(nextPoint);
    }

    return nextPoints.length > MAX_LIVE_POINTS
      ? nextPoints.slice(nextPoints.length - MAX_LIVE_POINTS)
      : nextPoints;
  };

  const updateHoveredPoint = (event: MouseEvent) => {
    const geometry = chartGeometry();
    const target = event.currentTarget as SVGSVGElement | null;
    if (!geometry || !target) return;

    const rect = target.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    const x = ratio * SVG_WIDTH;

    let closestIndex = 0;
    let closestDistance = Number.POSITIVE_INFINITY;

    geometry.mappedPoints.forEach((point, index) => {
      const distance = Math.abs(point.x - x);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = index;
      }
    });

    setHoveredIndex(closestIndex);
  };

  createEffect(() => {
    latestPrice = props.coin.current_price;
  });

  createEffect(() => {
    props.coin.id;
    setActiveTab('live');
    setLivePoints([]);
    setHoveredIndex(null);
    liveSeedKey = `${props.coin.id}:pending`;
  });

  createEffect(() => {
    const seed = oneHourPoints();
    if (seed.length < 2) {
      setLivePoints([]);
      return;
    }

    const nextSeedKey = `${props.coin.id}:${seed[0]?.timestamp}:${seed[seed.length - 1]?.timestamp}:${props.coin.current_price}`;
    if (liveSeedKey === nextSeedKey) return;

    liveSeedKey = nextSeedKey;
    setLivePoints(seed.slice(-MAX_LIVE_POINTS));
  });

  createEffect(() => {
    if (activeTab() !== 'live' || oneHourPoints().length < 2) return;

    const interval = window.setInterval(() => {
      setLivePoints((current) => appendLivePoint(current, latestPrice));
    }, 1000);

    onCleanup(() => window.clearInterval(interval));
  });

  onMount(() => {
    const updateViewport = () => {
      setIsCompact(window.innerWidth < 640);
      setIsWide(window.innerWidth >= 1440);
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    onCleanup(() => window.removeEventListener('resize', updateViewport));
  });

  const performanceCards = createMemo(() => [
    { label: '24s', value: props.coin.price_change_percentage_24h },
    { label: '7g', value: props.coin.price_change_percentage_7d_in_currency },
    { label: '30g', value: props.coin.price_change_percentage_30d_in_currency },
  ]);

  return (
    <div class="overflow-hidden rounded-2xl border border-slate-800/70 bg-[radial-gradient(circle_at_top_right,rgba(56,189,248,0.08),transparent_45%),linear-gradient(180deg,rgba(15,23,42,0.92),rgba(6,10,20,0.96))] shadow-lg shadow-black/20 crypto-terminal-copy">
      <div class="border-b border-slate-800/60 px-4 py-4 sm:px-5">
        <div class="grid gap-3 sm:grid-cols-3">
          <For each={performanceCards()}>
            {(card) => (
              <div class="rounded-xl border border-slate-800/80 bg-[linear-gradient(180deg,rgba(14,18,34,0.92),rgba(7,11,22,0.96))] px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <div class="crypto-terminal-label text-slate-500">Performans {card.label}</div>
                <div class={`crypto-terminal-value mt-2 text-2xl ${card.value != null && card.value >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {formatPercentage(card.value)}
                </div>
                <div class="crypto-terminal-subtle mt-2 text-sm">Seçili coin için yön teyidi</div>
              </div>
            )}
          </For>
        </div>
      </div>

      <div class="flex flex-col gap-3 border-b border-slate-800/60 px-4 py-3 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
        <div class="-mx-1 overflow-x-auto px-1">
          <div class="flex min-w-max flex-wrap items-center gap-2 sm:min-w-0 sm:flex-wrap">
          <For each={TAB_CONFIG}>
            {(tab) => (
              <button
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setHoveredIndex(null);
                }}
                class={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                  activeTab() === tab.id
                  ? 'border-sky-400/50 bg-sky-400/12 text-sky-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]'
                  : 'border-slate-800/90 bg-slate-950/20 text-slate-300 hover:border-slate-700 hover:text-slate-100'
                }`}
              >
                {tab.label}
              </button>
            )}
          </For>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4 text-right text-sm sm:min-w-[220px]">
          <div>
            <div class="crypto-terminal-label">Fiyat</div>
            <div class={`crypto-terminal-mono mt-1 text-base ${priceClass()}`}>{formatPrice(props.coin.current_price)}</div>
          </div>
          <div>
            <div class="crypto-terminal-label">Seçili aralık</div>
            <div class={`crypto-terminal-value mt-1 text-base ${trendClass()}`}>{formatPercentage(selectedRangeChange())}</div>
          </div>
        </div>
      </div>

      <div class="border-b border-slate-800/60 px-4 py-3 text-sm font-medium text-slate-200 leading-6">
        {currentTabConfig().subtitle}
      </div>

      <div class="relative px-3 py-3 sm:px-4 sm:py-4 xl:px-5 xl:py-5">
        <Show when={loadState() === 'fallback'}>
          <div class="flex h-[320px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-700/50 bg-slate-900/30 px-6 text-center text-base text-slate-200">
            <div>Bu coin için sparkline verisi sağlanmıyor.</div>
            <div class="crypto-terminal-subtle text-sm">Grafik yerine canlı fiyat metrikleri kullanılmaya devam eder.</div>
          </div>
        </Show>

        <Show when={loadState() === 'empty'}>
          <div class="flex h-[320px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-700/50 bg-slate-900/30 px-6 text-center text-base text-slate-200">
            <div>Bu aralık için yeterli veri noktası yok.</div>
            <div class="crypto-terminal-subtle text-sm">Veri yenilendiğinde grafik otomatik güncellenir.</div>
          </div>
        </Show>

        <Show when={loadState() === 'ready'}>
          <div class="rounded-xl border border-slate-800/60 bg-[#081218]/80 p-2.5 shadow-[inset_0_1px_0_rgba(56,189,248,0.03),0_0_30px_rgba(56,189,248,0.03)] sm:p-3 xl:p-4">
            <svg
              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              class={`block w-full overflow-visible ${chartHeightClass()}`}
              preserveAspectRatio="none"
              role="img"
              aria-label={`${props.coin.name} ${currentTabConfig().label} fiyat grafiği`}
              onMouseMove={(event) => updateHoveredPoint(event)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <defs>
                <linearGradient id={chartGradientId()} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stop-color="rgba(96, 165, 250, 0.45)" />
                  <stop offset="100%" stop-color="rgba(96, 165, 250, 0.03)" />
                </linearGradient>
              </defs>

              <For each={chartGeometry()?.gridLines ?? []}>
                {(line) => (
                  <g>
                    <line
                      x1={SVG_PADDING.left}
                      x2={SVG_WIDTH - SVG_PADDING.right}
                      y1={line.y}
                      y2={line.y}
                      stroke="rgba(148, 163, 184, 0.14)"
                      stroke-width="1"
                    />
                    <text
                      x={SVG_WIDTH - SVG_PADDING.right}
                      y={line.y - 6}
                      text-anchor="end"
                      font-size="11"
                      fill="rgba(191, 219, 254, 0.62)"
                    >
                      {formatPrice(line.value)}
                    </text>
                  </g>
                )}
              </For>

              <Show when={chartGeometry()} keyed>
                {(geometry) => (
                  <>
                    <path d={geometry.areaPath} fill={`url(#${chartGradientId()})`} />
                    <path
                      d={geometry.linePath}
                      fill="none"
                      stroke="#60a5fa"
                      stroke-width="3.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />

                    <For each={geometry.axisPoints}>
                      {(point) => (
                        <text
                          x={point.x}
                          y={SVG_HEIGHT - 10}
                          text-anchor={point.x <= SVG_PADDING.left + 10 ? 'start' : point.x >= SVG_WIDTH - SVG_PADDING.right - 10 ? 'end' : 'middle'}
                          font-size="11"
                          fill="rgba(224, 242, 254, 0.72)"
                        >
                          {formatAxisTime(point.timestamp)}
                        </text>
                      )}
                    </For>

                    <text x={SVG_PADDING.left} y="14" font-size="11" fill="rgba(224, 242, 254, 0.88)">
                      Zirve {formatPrice(geometry.maxPrice)}
                    </text>
                    <text
                      x={SVG_WIDTH - SVG_PADDING.right}
                      y={SVG_HEIGHT - SVG_PADDING.bottom - 6}
                      text-anchor="end"
                      font-size="11"
                      fill="rgba(191, 219, 254, 0.82)"
                    >
                      Dip {formatPrice(geometry.minPrice)}
                    </text>
                  </>
                )}
              </Show>

              <Show when={activePoint()} keyed>
                {(point) => {
                  const tooltipWidth = isCompact() ? 90 : 132;
                  const tooltipX = point.x > SVG_WIDTH - 170 ? point.x - tooltipWidth - 14 : point.x + 14;
                  const tooltipY = Math.max(20, point.y - (isCompact() ? 40 : 56));

                  return (
                    <>
                      <line
                        x1={point.x}
                        x2={point.x}
                        y1={SVG_PADDING.top}
                        y2={SVG_HEIGHT - SVG_PADDING.bottom}
                        stroke="rgba(125, 211, 252, 0.35)"
                        stroke-width="1"
                        stroke-dasharray="4 4"
                      />
                      <circle cx={point.x} cy={point.y} r="5.5" fill="#93c5fd" />
                      <circle cx={point.x} cy={point.y} r="10" fill="rgba(96, 165, 250, 0.18)" />
                      <rect
                        x={tooltipX}
                        y={tooltipY}
                        width={tooltipWidth}
                        height={isCompact() ? '28' : '46'}
                        rx="10"
                        fill="rgba(2, 6, 23, 0.92)"
                        stroke="rgba(56, 189, 248, 0.24)"
                      />
                      <Show when={!isCompact()}>
                        <text x={tooltipX + 10} y={tooltipY + 18} font-size="11" fill="rgba(148,163,184,0.92)">
                          {formatAxisTime(point.timestamp)}
                        </text>
                      </Show>
                      <text x={tooltipX + 10} y={tooltipY + (isCompact() ? 18 : 34)} font-size={isCompact() ? '11' : '12'} fill="rgba(224,242,254,0.96)">
                        {formatPrice(point.price)}
                      </text>
                    </>
                  );
                }}
              </Show>
            </svg>

              <div class="mt-3 flex items-center justify-between px-1 text-sm font-semibold text-slate-200">
                <div class="crypto-terminal-label text-slate-200">{currentTabConfig().label}</div>
                <div class="crypto-terminal-subtle">{pointCount()} nokta</div>
              </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
