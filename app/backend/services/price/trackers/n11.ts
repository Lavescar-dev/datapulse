import { N11Scraper } from '../../../scrapers/n11';
import type { ScrapedProduct } from '../../../../shared/types/price';

export class N11Tracker {
  private scraper: N11Scraper;

  constructor() {
    this.scraper = new N11Scraper();
  }

  /**
   * Extract product details from N11 URL
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
      console.error('Error tracking N11 product:', error);
      return null;
    }
  }

  /**
   * Get marketplace identifier
   */
  getMarketplace(): 'n11' {
    return 'n11';
  }

  /**
   * Validate URL is from N11
   */
  isValidUrl(url: string): boolean {
    return url.includes('n11.com');
  }
}
