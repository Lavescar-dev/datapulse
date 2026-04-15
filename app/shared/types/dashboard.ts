// Dashboard builder types

export type WidgetType = 'chart' | 'table' | 'stat' | 'list';
export type WidgetSource =
  | 'crypto'
  | 'news'
  | 'social'
  | 'scraper'
  | 'price'
  | 'monitor'
  | 'seo';

export type ChartType = 'line' | 'bar' | 'pie' | 'area';

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  source: WidgetSource;
  title: string;
  description?: string;

  // Position and size (for grid layout)
  x: number;
  y: number;
  w: number; // width in grid units
  h: number; // height in grid units

  // Widget-specific configuration
  chartType?: ChartType;
  dataKey?: string; // which data field to display
  limit?: number; // how many items to show
  refreshInterval?: number; // in seconds

  // Filters
  filters?: Record<string, any>;

  // Styling
  color?: string;
  showHeader?: boolean;
  showFooter?: boolean;
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets: WidgetConfig[];
  isTemplate?: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: 'admin' | 'demo';
}

export interface DashboardTemplate {
  id: string;
  name: string;
  description: string;
  category: 'crypto' | 'news' | 'tech' | 'monitoring' | 'ecommerce';
  thumbnail?: string;
  widgets: WidgetConfig[];
}

// Widget data responses

export interface WidgetData {
  widgetId: string;
  timestamp: string;
  data: any;
  error?: string;
}

export interface CryptoWidgetData {
  coins?: Array<{
    name: string;
    symbol: string;
    price: number;
    change24h: number;
    marketCap: number;
  }>;
  fearGreedIndex?: {
    value: number;
    classification: string;
  };
  marketStats?: {
    totalMarketCap: number;
    totalVolume: number;
    btcDominance: number;
  };
}

export interface NewsWidgetData {
  articles: Array<{
    id: string;
    title: string;
    source: string;
    category: string;
    sentiment: string;
    pubDate: string;
    link: string;
  }>;
  totalCount: number;
}

export interface SocialWidgetData {
  posts: Array<{
    id: string;
    platform: string;
    title: string;
    score: number;
    metadata: string;
    url: string;
    timestamp: number;
  }>;
  totalCount: number;
}

export interface PriceWidgetData {
  products: Array<{
    id: string;
    name: string;
    marketplace: string;
    currentPrice: number;
    currency: string;
    priceChange?: number;
    priceChangePercent?: number;
    available: boolean;
  }>;
  totalCount: number;
}

export interface MonitorWidgetData {
  endpoints: Array<{
    id: string;
    name: string;
    url: string;
    status: 'up' | 'down' | 'unknown';
    uptime24h?: number;
    responseTime?: number;
    lastCheck?: string;
  }>;
  summary: {
    total: number;
    up: number;
    down: number;
    unknown: number;
  };
}

export interface ScraperWidgetData {
  recentJobs: Array<{
    id: string;
    url: string;
    status: 'completed' | 'failed' | 'pending';
    timestamp: string;
    dataExtracted?: number;
  }>;
  totalJobs: number;
  successRate: number;
}

export interface SEOWidgetData {
  recentAnalyses: Array<{
    url: string;
    score: number;
    issues: number;
    timestamp: string;
  }>;
  totalAnalyses: number;
}

// Cache structure
export interface DashboardCache {
  dashboards: Dashboard[];
  lastUpdated: number;
}
