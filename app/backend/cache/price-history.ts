import { existsSync } from 'fs';
import { join } from 'path';
import type {
  PriceCache,
  Product,
  PricePoint,
  PriceAlert,
  PriceStats
} from '../../shared/types/price';

const CACHE_FILE_PATH = join(__dirname, 'price-history.json');

export class PriceHistoryManager {
  private cache: PriceCache | null = null;
  private initialized = false;

  private normalizeProduct(product: Product): Product {
    return {
      ...product,
      source: product.source === 'showcase-fallback' ? 'showcase-fallback' : 'live',
      sourceNote: product.sourceNote,
      imageUrl: product.imageUrl || '',
    };
  }

  /**
   * Initialize cache
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.loadFromFile();
      this.initialized = true;
      console.log('✓ Price history cache initialized');
    } catch (error) {
      console.error('Error initializing price history cache:', error);
      this.cache = { products: [], alerts: [], lastUpdated: Date.now() };
      this.initialized = true;
    }
  }

  /**
   * Load cache from JSON file
   */
  private async loadFromFile(): Promise<void> {
    try {
      if (existsSync(CACHE_FILE_PATH)) {
        const file = Bun.file(CACHE_FILE_PATH);
        const data = await file.text();
        const parsed = JSON.parse(data) as PriceCache;
        this.cache = {
          ...parsed,
          products: (parsed.products || []).map(product => this.normalizeProduct(product)),
          alerts: parsed.alerts || [],
          lastUpdated: parsed.lastUpdated || Date.now(),
        };
        console.log(`✓ Loaded ${this.cache?.products.length || 0} tracked products from cache`);
      } else {
        this.cache = { products: [], alerts: [], lastUpdated: Date.now() };
      }
    } catch (error) {
      console.error('Error loading price history from file:', error);
      this.cache = { products: [], alerts: [], lastUpdated: Date.now() };
    }
  }

  /**
   * Save cache to JSON file
   */
  private async saveToFile(): Promise<void> {
    try {
      await Bun.write(CACHE_FILE_PATH, JSON.stringify(this.cache, null, 2));
      console.log('✓ Saved price history to file');
    } catch (error) {
      console.error('Error saving price history to file:', error);
    }
  }

  /**
   * Get all tracked products
   */
  async getAllProducts(): Promise<Product[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.cache?.products || [];
  }

  /**
   * Get product by ID
   */
  async getProduct(id: string): Promise<Product | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.cache?.products.find(p => p.id === id) || null;
  }

  /**
   * Add new product to track
   */
  async addProduct(product: Omit<Product, 'id' | 'priceHistory'>): Promise<Product> {
    if (!this.initialized) {
      await this.initialize();
    }

    const id = this.generateProductId(product.url);

    const existingProduct = this.cache?.products.find(p => p.id === id);

    if (existingProduct) {
      return existingProduct;
    }

    const newProduct: Product = this.normalizeProduct({
      ...product,
      id,
      priceHistory: [{
        price: product.currentPrice,
        timestamp: new Date().toISOString(),
        available: product.available,
      }],
    });

    this.cache!.products.push(newProduct);
    this.cache!.lastUpdated = Date.now();
    await this.saveToFile();

    console.log(`✓ Added product to tracking: ${newProduct.name}`);
    return newProduct;
  }

  /**
   * Update product price
   */
  async updateProductPrice(
    id: string,
    price: number,
    available: boolean,
    metadata?: Partial<Pick<Product, 'name' | 'currency' | 'imageUrl' | 'source' | 'sourceNote' | 'trackingQuery'>>
  ): Promise<Product | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    const product = this.cache?.products.find(p => p.id === id);

    if (!product) {
      return null;
    }

    const pricePoint: PricePoint = {
      price,
      timestamp: new Date().toISOString(),
      available,
    };

    product.currentPrice = price;
    product.available = available;
    product.lastChecked = new Date().toISOString();
    if (metadata?.name) product.name = metadata.name;
    if (metadata?.currency) product.currency = metadata.currency;
    if (typeof metadata?.imageUrl === 'string') product.imageUrl = metadata.imageUrl;
    if (metadata?.trackingQuery) product.trackingQuery = metadata.trackingQuery;
    if (metadata?.source) product.source = metadata.source;
    if (metadata?.source === 'live' && !metadata?.sourceNote) {
      product.sourceNote = undefined;
    } else if (metadata?.sourceNote !== undefined) {
      product.sourceNote = metadata.sourceNote;
    }
    product.priceHistory.push(pricePoint);

    // Keep only last 90 days of history (approximately 360 data points at 6-hour intervals)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    product.priceHistory = product.priceHistory.filter(
      point => new Date(point.timestamp) > ninetyDaysAgo
    );

    this.cache!.lastUpdated = Date.now();
    await this.saveToFile();

    console.log(`✓ Updated price for: ${product.name} - ${price} ${product.currency}`);

    // Check alerts
    await this.checkAlerts(product);

    return product;
  }

  /**
   * Remove product from tracking
   */
  async removeProduct(id: string): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    const initialLength = this.cache!.products.length;
    this.cache!.products = this.cache!.products.filter(p => p.id !== id);

    if (this.cache!.products.length < initialLength) {
      this.cache!.lastUpdated = Date.now();
      await this.saveToFile();
      console.log(`✓ Removed product from tracking: ${id}`);
      return true;
    }

    return false;
  }

  /**
   * Get price statistics for a product
   */
  async getPriceStats(id: string): Promise<PriceStats | null> {
    const product = await this.getProduct(id);

    if (!product || product.priceHistory.length === 0) {
      return null;
    }

    const prices = product.priceHistory.map(p => p.price);
    const lowestPrice = Math.min(...prices);
    const highestPrice = Math.max(...prices);
    const averagePrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const lastPrice = product.currentPrice;

    const firstPrice = product.priceHistory[0]?.price ?? lastPrice;
    const priceChange = lastPrice - firstPrice;
    const priceChangePercent = (priceChange / firstPrice) * 100;

    return {
      lowestPrice,
      highestPrice,
      averagePrice: Math.round(averagePrice * 100) / 100,
      lastPrice,
      priceChange: Math.round(priceChange * 100) / 100,
      priceChangePercent: Math.round(priceChangePercent * 100) / 100,
    };
  }

  /**
   * Add price alert
   */
  async addAlert(alert: Omit<PriceAlert, 'id' | 'triggered' | 'createdAt'>): Promise<PriceAlert> {
    if (!this.initialized) {
      await this.initialize();
    }

    const newAlert: PriceAlert = {
      ...alert,
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      triggered: false,
      createdAt: new Date().toISOString(),
    };

    this.cache!.alerts.push(newAlert);
    await this.saveToFile();

    console.log(`✓ Added price alert for product: ${alert.productId}`);
    return newAlert;
  }

  /**
   * Get alerts for a product
   */
  async getProductAlerts(productId: string): Promise<PriceAlert[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.cache?.alerts.filter(a => a.productId === productId) || [];
  }

  /**
   * Check and trigger alerts for a product
   */
  private async checkAlerts(product: Product): Promise<void> {
    const alerts = await this.getProductAlerts(product.id);
    const currentPrice = product.currentPrice;

    for (const alert of alerts) {
      if (alert.triggered) continue;

      let shouldTrigger = false;

      if (alert.condition === 'below' && currentPrice <= alert.targetPrice) {
        shouldTrigger = true;
      } else if (alert.condition === 'above' && currentPrice >= alert.targetPrice) {
        shouldTrigger = true;
      }

      if (shouldTrigger) {
        alert.triggered = true;
        alert.triggeredAt = new Date().toISOString();
        console.log(`🔔 Alert triggered for ${product.name}: ${currentPrice} ${product.currency}`);
      }
    }

    await this.saveToFile();
  }

  /**
   * Get all alerts
   */
  async getAllAlerts(): Promise<PriceAlert[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.cache?.alerts || [];
  }

  /**
   * Generate unique product ID from URL
   */
  private generateProductId(url: string): string {
    // Use URL hash as ID
    const hash = Bun.hash(url).toString(36);
    return `product-${hash}`;
  }

  /**
   * Get cache metadata
   */
  async getCacheMetadata(): Promise<{
    productCount: number;
    alertCount: number;
    lastUpdated: number;
  }> {
    if (!this.initialized) {
      await this.initialize();
    }

    return {
      productCount: this.cache?.products.length || 0,
      alertCount: this.cache?.alerts.length || 0,
      lastUpdated: this.cache?.lastUpdated || 0,
    };
  }

  /**
   * Export product history to CSV format
   */
  async exportProductHistoryCSV(id: string): Promise<string | null> {
    const product = await this.getProduct(id);

    if (!product) {
      return null;
    }

    const headers = 'Timestamp,Price,Currency,Available\n';
    const rows = product.priceHistory
      .map(point => `${point.timestamp},${point.price},${product.currency},${point.available}`)
      .join('\n');

    return headers + rows;
  }
}

export const priceHistoryManager = new PriceHistoryManager();
