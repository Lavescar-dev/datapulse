import { TrendyolScraper } from '../../../scrapers/trendyol';
import type { ScrapedProduct } from '../../../../shared/types/price';

export class TrendyolTracker {
  private scraper: TrendyolScraper;

  constructor() {
    this.scraper = new TrendyolScraper();
  }

  /**
   * Extract product details from Trendyol URL
   */
  async trackProduct(url: string): Promise<ScrapedProduct | null> {
    try {
      const result = await this.scraper.getProductDetails(url);

      if (!result) {
        return null;
      }

      return {
        name: result.name,
        price: result.price,
        currency: result.currency,
        available: result.inStock,
        imageUrl: result.imageUrl || '',
      };
    } catch (error) {
      console.error('Error tracking Trendyol product:', error);
      return null;
    }
  }

  /**
   * Get marketplace identifier
   */
  getMarketplace(): 'trendyol' {
    return 'trendyol';
  }

  /**
   * Validate URL is from Trendyol
   */
  isValidUrl(url: string): boolean {
    return url.includes('trendyol.com');
  }
}
