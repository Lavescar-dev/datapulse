import { HepsiburadaScraper } from '../../../scrapers/hepsiburada';
import type { ScrapedProduct } from '../../../../shared/types/price';

export class HepsiburadaTracker {
  private scraper: HepsiburadaScraper;

  constructor() {
    this.scraper = new HepsiburadaScraper();
  }

  /**
   * Extract product details from Hepsiburada URL
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
      console.error('Error tracking Hepsiburada product:', error);
      return null;
    }
  }

  /**
   * Get marketplace identifier
   */
  getMarketplace(): 'hepsiburada' {
    return 'hepsiburada';
  }

  /**
   * Validate URL is from Hepsiburada
   */
  isValidUrl(url: string): boolean {
    return url.includes('hepsiburada.com');
  }
}
