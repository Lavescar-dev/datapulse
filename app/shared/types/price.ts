// E-commerce price tracking types

export interface PricePoint {
  price: number;
  timestamp: string;
  available: boolean;
}

export interface Product {
  id: string;
  url: string;
  name: string;
  trackingQuery?: string;
  currentPrice: number;
  currency: string;
  available: boolean;
  imageUrl: string;
  marketplace: 'trendyol' | 'hepsiburada' | 'n11' | 'amazon-tr';
  lastChecked: string;
  source?: 'live' | 'showcase-fallback';
  sourceNote?: string;
  priceHistory: PricePoint[];
}

export interface PriceStats {
  lowestPrice: number;
  highestPrice: number;
  averagePrice: number;
  lastPrice: number;
  priceChange: number;
  priceChangePercent: number;
}

export interface PriceAlert {
  id: string;
  productId: string;
  targetPrice: number;
  condition: 'below' | 'above';
  triggered: boolean;
  createdAt: string;
  triggeredAt?: string;
}

export interface PriceCache {
  products: Product[];
  alerts: PriceAlert[];
  lastUpdated: number;
}

export interface ScrapedProduct {
  name: string;
  price: number;
  currency: string;
  available: boolean;
  imageUrl: string;
}
