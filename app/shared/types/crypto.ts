// Cryptocurrency data types

export type CoinSegment =
  | 'Major'
  | 'Stablecoin'
  | 'Layer1'
  | 'DeFi'
  | 'Meme'
  | 'RWA'
  | 'Wrapped'
  | 'Exchange'
  | 'Infrastructure'
  | 'AI'
  | 'Other';

export interface CoinLinks {
  coingecko: string;
  homepage?: string | null;
  explorer?: string | null;
}

export interface CoinData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency?: number;
  price_change_percentage_30d_in_currency?: number;
  circulating_supply: number;
  total_supply: number;
  max_supply: number | null;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
  sparkline_in_7d?: {
    price: number[];
  };
  last_updated: string;
  segment?: CoinSegment;
  isStablecoin?: boolean;
  isWrapped?: boolean;
  isRwaLike?: boolean;
  market_cap_share?: number;
  anomaly_badges?: string[];
  links?: CoinLinks;
}

export const COIN_CHART_RANGES = ['1h', '24h', '7d', '30d'] as const;

export type CoinChartRange = typeof COIN_CHART_RANGES[number];

export interface CoinChartPoint {
  timestamp: number;
  price: number;
}

export interface CoinChartResponse {
  coinId: string;
  range: CoinChartRange;
  currency: 'usd';
  points: CoinChartPoint[];
  changePercentage: number | null;
  cachedAt: string;
}

export interface FearGreedIndex {
  value: number;
  value_classification: string;
  timestamp: string;
  time_until_update?: string;
}

export interface MarketStats {
  total_market_cap: number;
  total_volume: number;
  market_cap_percentage: Record<string, number>;
  btc_dominance: number;
  eth_dominance: number;
  updated_at: number;
}

export interface CryptoCache {
  coins: CoinData[];
  fearGreedIndex: FearGreedIndex;
  marketStats: MarketStats;
  lastUpdated: number;
}
