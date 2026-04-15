import { AmazonTRScraper } from '../../../scrapers/amazon';
import type { ScrapedProduct } from '../../../../shared/types/price';

export class AmazonTRTracker {
  private scraper: AmazonTRScraper;

  constructor() {
    this.scraper = new AmazonTRScraper();
  }

  /**
   * Extract product details from Amazon TR URL
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
      console.error('Error tracking Amazon TR product:', error);
      return null;
    }
  }

  /**
   * Get marketplace identifier
   */
  getMarketplace(): 'amazon-tr' {
    return 'amazon-tr';
  }

  /**
   * Validate URL is from Amazon TR
   */
  isValidUrl(url: string): boolean {
    return url.includes('amazon.com.tr');
  }

  /**
   * Close browser instance (Amazon uses Puppeteer)
   */
  async close(): Promise<void> {
    await this.scraper.close();
  }
}
