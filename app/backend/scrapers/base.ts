export interface ProductResult {
  name: string;
  price: number;
  currency: string;
  inStock: boolean;
  url: string;
  imageUrl?: string;
  rating?: number;
  reviewCount?: number;
}

export interface ScraperResult {
  source: string;
  products: ProductResult[];
  query: string;
  scrapedAt: Date;
  error?: string;
}

/**
 * Interface for all e-commerce scrapers
 */
export interface IScraper {
  /**
   * Search for products by query
   */
  search(query: string): Promise<ProductResult[]>;

  /**
   * Get product details from URL
   */
  getProductDetails(url: string): Promise<ProductResult | null>;

  /**
   * Get scraper source name
   */
  getSource(): string;
}

/**
 * Base scraper with common functionality
 */
export abstract class BaseScraper implements IScraper {
  private static readonly RATE_LIMIT_DELAY = 2000; // 2 seconds between requests
  private static readonly MAX_RETRIES = 3;
  private static readonly TIMEOUT = 30000; // 30 seconds

  protected userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  ];

  private lastRequestTime = 0;

  /**
   * Enforce rate limiting between requests
   */
  protected async rateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < BaseScraper.RATE_LIMIT_DELAY) {
      const delay = BaseScraper.RATE_LIMIT_DELAY - timeSinceLastRequest;
      await this.sleep(delay);
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Get random user agent
   */
  protected getRandomUserAgent(): string {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)] ?? this.userAgents[0] ?? 'Mozilla/5.0';
  }

  /**
   * Sleep utility
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Retry logic with exponential backoff
   */
  protected async retry<T>(
    fn: () => Promise<T>,
    retries = BaseScraper.MAX_RETRIES
  ): Promise<T> {
    let lastError: Error | unknown;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff: 1s, 2s, 4s

        console.warn(
          `${this.getSource()} scraper failed (attempt ${attempt + 1}/${retries}), retrying in ${delay}ms...`,
          error instanceof Error ? error.message : error
        );

        if (attempt < retries - 1) {
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Execute with timeout
   */
  protected async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs = BaseScraper.TIMEOUT
  ): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
      ),
    ]);
  }

  /**
   * Normalize price string to number
   */
  protected normalizePrice(priceString: string): number {
    // Remove currency symbols, spaces, and convert comma to dot
    const cleaned = priceString
      .replace(/[₺$€£TL\s]/g, '')
      .replace(/\./g, '') // Remove thousand separators
      .replace(',', '.'); // Convert decimal comma to dot

    return parseFloat(cleaned) || 0;
  }

  /**
   * Clean product name
   */
  protected cleanProductName(name: string): string {
    return name.trim().replace(/\s+/g, ' ');
  }

  // Abstract methods to be implemented by child classes
  abstract search(query: string): Promise<ProductResult[]>;
  abstract getProductDetails(url: string): Promise<ProductResult | null>;
  abstract getSource(): string;
}
