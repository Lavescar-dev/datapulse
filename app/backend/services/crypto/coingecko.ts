import {
  COIN_CHART_RANGES,
  type CoinChartPoint,
  type CoinChartRange,
  type CoinChartResponse,
  type CoinData,
  type CoinLinks,
  type CoinSegment,
  type FearGreedIndex,
  type MarketStats,
} from '../../../shared/types/crypto';

const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';
const FEAR_GREED_API = 'https://api.alternative.me/fng/';
const MAX_CHART_POINTS = 240;

const CHART_RANGE_CONFIG: Record<CoinChartRange, {
  ttlMs: number;
  getPath: (coinId: string, now: number) => string;
}> = {
  '1h': {
    ttlMs: 15_000,
    getPath: (coinId, now) => {
      const to = Math.floor(now / 1000);
      const from = to - 60 * 60;
      return `/coins/${coinId}/market_chart/range?vs_currency=usd&from=${from}&to=${to}`;
    },
  },
  '24h': {
    ttlMs: 30_000,
    getPath: (coinId, now) => {
      const to = Math.floor(now / 1000);
      const from = to - 24 * 60 * 60;
      return `/coins/${coinId}/market_chart/range?vs_currency=usd&from=${from}&to=${to}`;
    },
  },
  '7d': {
    ttlMs: 120_000,
    getPath: (coinId) => `/coins/${coinId}/market_chart?vs_currency=usd&days=7`,
  },
  '30d': {
    ttlMs: 300_000,
    getPath: (coinId) => `/coins/${coinId}/market_chart?vs_currency=usd&days=30`,
  },
};

type ChartCacheEntry = {
  expiresAt: number;
  data?: CoinChartResponse;
  promise?: Promise<CoinChartResponse>;
};

type CoinGeckoMarketChartResponse = {
  prices?: Array<[number, number]>;
};

type FearGreedApiResponse = {
  data: Array<{
    value: string;
    value_classification: string;
    timestamp: string;
    time_until_update?: string;
  }>;
};

type CoinGeckoGlobalResponse = {
  data: {
    total_market_cap: { usd: number };
    total_volume: { usd: number };
    market_cap_percentage: Record<string, number>;
    updated_at: number;
  };
};

const STABLECOIN_IDS = new Set([
  'tether',
  'usd-coin',
  'dai',
  'first-digital-usd',
  'ethena-usde',
  'usds',
  'paypal-usd',
  'true-usd',
  'frax',
  'usdd',
  'pax-gold',
  'tether-gold',
  'binance-bridged-usdt-bnb-smart-chain',
]);

const MAJOR_IDS = new Set([
  'bitcoin',
  'ethereum',
  'binancecoin',
  'solana',
  'ripple',
  'tron',
  'dogecoin',
  'cardano',
  'avalanche-2',
  'toncoin',
]);

const LAYER1_IDS = new Set([
  'solana',
  'cardano',
  'avalanche-2',
  'sui',
  'aptos',
  'near',
  'internet-computer',
  'polkadot',
  'kaspa',
  'hedera-hashgraph',
  'stellar',
  'algorand',
  'sei-network',
]);

const DEFI_IDS = new Set([
  'chainlink',
  'uniswap',
  'aave',
  'maker',
  'lido-dao',
  'compound-governance-token',
  'curve-dao-token',
  'ethena',
  'pancakeswap-token',
  'jupiter-exchange-solana',
]);

const MEME_IDS = new Set([
  'dogecoin',
  'shiba-inu',
  'pepe',
  'dogwifcoin',
  'bonk',
  'floki',
  'book-of-meme',
  'official-trump',
  'brett',
  'mog-coin',
]);

const RWA_IDS = new Set([
  'ondo-finance',
  'mantra-dao',
  'pax-gold',
  'tether-gold',
  'maker',
  'blackrock-usd-institutional-digital-liquidity-fund',
  'figure-heloc',
  'mountain-protocol-usdm',
  'hashnote-usyc',
  'ondo-us-dollar-yield',
]);

const EXCHANGE_IDS = new Set([
  'binancecoin',
  'leo-token',
  'crypto-com-chain',
  'okb',
  'bittensor',
]);

const INFRASTRUCTURE_IDS = new Set([
  'chainlink',
  'render-token',
  'the-graph',
  'filecoin',
  'arweave',
  'celestia',
]);

const AI_IDS = new Set([
  'render-token',
  'bittensor',
  'near',
  'fetch-ai',
  'singularitynet',
]);

const OFFICIAL_LINKS: Record<string, Omit<CoinLinks, 'coingecko'>> = {
  bitcoin: { homepage: 'https://bitcoin.org', explorer: 'https://www.blockchain.com/explorer' },
  ethereum: { homepage: 'https://ethereum.org', explorer: 'https://etherscan.io' },
  tether: { homepage: 'https://tether.to' },
  'usd-coin': { homepage: 'https://www.circle.com/usdc' },
  solana: { homepage: 'https://solana.com', explorer: 'https://explorer.solana.com' },
  ripple: { homepage: 'https://ripple.com', explorer: 'https://livenet.xrpl.org' },
  binancecoin: { homepage: 'https://www.bnbchain.org', explorer: 'https://bscscan.com' },
  cardano: { homepage: 'https://cardano.org' },
  dogecoin: { homepage: 'https://dogecoin.com', explorer: 'https://dogechain.info' },
  chainlink: { homepage: 'https://chain.link' },
  uniswap: { homepage: 'https://uniswap.org' },
  aave: { homepage: 'https://aave.com' },
  'ondo-finance': { homepage: 'https://ondo.finance' },
};

const buildCoinGeckoUrl = (coinId: string) => `https://www.coingecko.com/en/coins/${coinId}`;

const toLowerValues = (...values: Array<string | undefined | null>) =>
  values.filter((value): value is string => Boolean(value)).map((value) => value.toLowerCase());

const inferWrapped = (coin: CoinData) => {
  const values = toLowerValues(coin.symbol, coin.name, coin.id);
  return values.some((value) =>
    value.startsWith('w') ||
    value.includes('wrapped') ||
    value.includes('bridged')
  );
};

const inferStablecoin = (coin: CoinData) => {
  if (STABLECOIN_IDS.has(coin.id)) return true;

  const values = toLowerValues(coin.symbol, coin.name, coin.id);
  return values.some((value) =>
    value.includes('usd') ||
    value.includes('stable') ||
    value.includes('eurc')
  );
};

const inferRwaLike = (coin: CoinData) => {
  if (RWA_IDS.has(coin.id)) return true;

  const values = toLowerValues(coin.symbol, coin.name, coin.id);
  return values.some((value) =>
    value.includes('yield') ||
    value.includes('institutional') ||
    value.includes('fund') ||
    value.includes('heloc') ||
    value.includes('treasury') ||
    value.includes('gold')
  );
};

const classifySegment = (coin: CoinData): CoinSegment => {
  if (inferStablecoin(coin)) return 'Stablecoin';
  if (inferWrapped(coin)) return 'Wrapped';
  if (inferRwaLike(coin)) return 'RWA';
  if (MAJOR_IDS.has(coin.id)) return 'Major';
  if (MEME_IDS.has(coin.id)) return 'Meme';
  if (LAYER1_IDS.has(coin.id)) return 'Layer1';
  if (DEFI_IDS.has(coin.id)) return 'DeFi';
  if (EXCHANGE_IDS.has(coin.id)) return 'Exchange';
  if (AI_IDS.has(coin.id)) return 'AI';
  if (INFRASTRUCTURE_IDS.has(coin.id)) return 'Infrastructure';
  return 'Other';
};

const buildLinks = (coin: CoinData): CoinLinks => ({
  coingecko: buildCoinGeckoUrl(coin.id),
  homepage: OFFICIAL_LINKS[coin.id]?.homepage ?? null,
  explorer: OFFICIAL_LINKS[coin.id]?.explorer ?? null,
});

const buildAnomalyBadges = (coin: CoinData): string[] => {
  const badges: string[] = [];
  const volumeRatio = coin.market_cap > 0 ? coin.total_volume / coin.market_cap : 0;
  const dayChange = coin.price_change_percentage_24h ?? 0;
  const weekChange = coin.price_change_percentage_7d_in_currency ?? 0;

  if (volumeRatio >= 0.45) {
    badges.push('Hacim patlaması');
  }

  if (volumeRatio >= 0.25 && Math.abs(dayChange) <= 2.5) {
    badges.push('Fiyata göre aşırı hacim');
  }

  if (dayChange > 0 && weekChange < 0) {
    badges.push('24s pozitif / 7g negatif');
  }

  if ((coin.ath_change_percentage ?? 0) <= -65 && volumeRatio >= 0.12) {
    badges.push('ATH uzak / hacim artıyor');
  }

  return badges;
};

const enrichCoin = (coin: CoinData): CoinData => {
  const isStablecoin = inferStablecoin(coin);
  const isWrapped = inferWrapped(coin);
  const isRwaLike = inferRwaLike(coin);

  return {
    ...coin,
    segment: classifySegment(coin),
    isStablecoin,
    isWrapped,
    isRwaLike,
    market_cap_share: 0,
    anomaly_badges: buildAnomalyBadges(coin),
    links: buildLinks(coin),
  };
};

export class CoinGeckoClient {
  private apiKey: string | undefined;
  private chartCache = new Map<string, ChartCacheEntry>();

  constructor() {
    this.apiKey = process.env.COINGECKO_API_KEY;
  }

  private getHeaders(): Record<string, string> | undefined {
    return this.apiKey ? { 'x-cg-demo-api-key': this.apiKey } : undefined;
  }

  private getChartCacheKey(coinId: string, range: CoinChartRange) {
    return `${coinId}:${range}`;
  }

  private assertValidChartRange(range: string): asserts range is CoinChartRange {
    if (!COIN_CHART_RANGES.includes(range as CoinChartRange)) {
      throw new Error(`Unsupported chart range: ${range}`);
    }
  }

  private downsampleChartPoints(points: CoinChartPoint[]): CoinChartPoint[] {
    if (points.length <= MAX_CHART_POINTS) {
      return points;
    }

    const step = (points.length - 1) / (MAX_CHART_POINTS - 1);
    const sampled: CoinChartPoint[] = [];

    for (let index = 0; index < MAX_CHART_POINTS; index += 1) {
      const sourceIndex = Math.round(index * step);
      const point = points[sourceIndex];
      if (point) {
        sampled.push(point);
      }
    }

    return sampled;
  }

  private normalizeChartPoints(prices: Array<[number, number]> | undefined): CoinChartPoint[] {
    if (!prices?.length) {
      return [];
    }

    const normalized = prices
      .map(([timestamp, price]) => ({
        timestamp: Math.floor(timestamp / 1000),
        price,
      }))
      .filter((point, index, allPoints) => {
        if (!Number.isFinite(point.timestamp) || !Number.isFinite(point.price)) {
          return false;
        }

        return index === 0 || point.timestamp !== allPoints[index - 1]?.timestamp;
      });

    return this.downsampleChartPoints(normalized);
  }

  private calculateChangePercentage(points: CoinChartPoint[]) {
    const first = points[0]?.price;
    const last = points[points.length - 1]?.price;

    if (first == null || last == null || first === 0) {
      return null;
    }

    return ((last - first) / first) * 100;
  }

  async getTopCoins(limit: number = 100): Promise<CoinData[]> {
    const params = new URLSearchParams({
      vs_currency: 'usd',
      order: 'market_cap_desc',
      per_page: limit.toString(),
      page: '1',
      sparkline: 'true',
      price_change_percentage: '24h,7d,30d',
    });

    const url = `${COINGECKO_API_BASE}/coins/markets?${params}`;

    try {
      const response = await fetch(url, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as CoinData[];
      return data.map((coin) => enrichCoin(coin));
    } catch (error) {
      console.error('Error fetching top coins:', error);
      throw error;
    }
  }

  async getFearGreedIndex(): Promise<FearGreedIndex> {
    try {
      const response = await fetch(FEAR_GREED_API);

      if (!response.ok) {
        throw new Error(`Fear & Greed API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as FearGreedApiResponse;
      const latest = data.data[0];

      if (!latest) {
        throw new Error('Fear & Greed API returned no data');
      }

      return {
        value: parseInt(latest.value),
        value_classification: latest.value_classification,
        timestamp: new Date(parseInt(latest.timestamp) * 1000).toISOString(),
        time_until_update: latest.time_until_update,
      };
    } catch (error) {
      console.error('Error fetching Fear & Greed Index:', error);
      throw error;
    }
  }

  async getMarketStats(): Promise<MarketStats> {
    const url = `${COINGECKO_API_BASE}/global`;

    try {
      const response = await fetch(url, {
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as CoinGeckoGlobalResponse;
      const globalData = data.data;

      return {
        total_market_cap: globalData.total_market_cap.usd,
        total_volume: globalData.total_volume.usd,
        market_cap_percentage: globalData.market_cap_percentage,
        btc_dominance: globalData.market_cap_percentage.btc || 0,
        eth_dominance: globalData.market_cap_percentage.eth || 0,
        updated_at: globalData.updated_at,
      };
    } catch (error) {
      console.error('Error fetching market stats:', error);
      throw error;
    }
  }

  async getCoinChart(coinId: string, range: CoinChartRange): Promise<CoinChartResponse> {
    this.assertValidChartRange(range);

    const cacheKey = this.getChartCacheKey(coinId, range);
    const existing = this.chartCache.get(cacheKey);
    const now = Date.now();

    if (existing?.data && existing.expiresAt > now) {
      return existing.data;
    }

    if (existing?.promise) {
      return existing.promise;
    }

    const config = CHART_RANGE_CONFIG[range];
    const requestPromise = (async () => {
      try {
        const url = `${COINGECKO_API_BASE}${config.getPath(encodeURIComponent(coinId), now)}`;
        const response = await fetch(url, { headers: this.getHeaders() });

        if (!response.ok) {
          throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as CoinGeckoMarketChartResponse;
        const points = this.normalizeChartPoints(data.prices);

        if (points.length === 0) {
          throw new Error(`No chart data returned for ${coinId} (${range})`);
        }

        const chartResponse: CoinChartResponse = {
          coinId,
          range,
          currency: 'usd',
          points,
          changePercentage: this.calculateChangePercentage(points),
          cachedAt: new Date().toISOString(),
        };

        this.chartCache.set(cacheKey, {
          data: chartResponse,
          expiresAt: Date.now() + config.ttlMs,
        });

        return chartResponse;
      } catch (error) {
        this.chartCache.delete(cacheKey);
        console.error(`Error fetching coin chart for ${coinId} (${range}):`, error);
        throw error;
      }
    })();

    this.chartCache.set(cacheKey, {
      expiresAt: now + config.ttlMs,
      promise: requestPromise,
    });

    return requestPromise;
  }

  async fetchAllData(): Promise<{
    coins: CoinData[];
    fearGreedIndex: FearGreedIndex;
    marketStats: MarketStats;
  }> {
    try {
      const [coins, fearGreedIndex, marketStats] = await Promise.all([
        this.getTopCoins(),
        this.getFearGreedIndex(),
        this.getMarketStats(),
      ]);

      const normalizedCoins = coins.map((coin) => ({
        ...coin,
        market_cap_share: marketStats.total_market_cap > 0
          ? (coin.market_cap / marketStats.total_market_cap) * 100
          : 0,
      }));

      return {
        coins: normalizedCoins,
        fearGreedIndex,
        marketStats,
      };
    } catch (error) {
      console.error('Error fetching all crypto data:', error);
      throw error;
    }
  }
}

export const coinGeckoClient = new CoinGeckoClient();
