import { TrendyolTracker, HepsiburadaTracker, N11Tracker, AmazonTRTracker } from './trackers';
import { priceHistoryManager } from '../../cache/price-history';
import type { Product, ScrapedProduct } from '../../../shared/types/price';
import type { ProductResult } from '../../scrapers/base';
import { TrendyolScraper } from '../../scrapers/trendyol';
import { HepsiburadaScraper } from '../../scrapers/hepsiburada';
import { N11Scraper } from '../../scrapers/n11';
import { AmazonTRScraper } from '../../scrapers/amazon';

export class PriceTrackerService {
  private trendyol: TrendyolTracker;
  private hepsiburada: HepsiburadaTracker;
  private n11: N11Tracker;
  private amazon: AmazonTRTracker;
  private showcaseSearchers: {
    trendyol: TrendyolScraper;
    hepsiburada: HepsiburadaScraper;
    n11: N11Scraper;
    'amazon-tr': AmazonTRScraper;
  };

  constructor() {
    this.trendyol = new TrendyolTracker();
    this.hepsiburada = new HepsiburadaTracker();
    this.n11 = new N11Tracker();
    this.amazon = new AmazonTRTracker();
    this.showcaseSearchers = {
      trendyol: new TrendyolScraper(),
      hepsiburada: new HepsiburadaScraper(),
      n11: new N11Scraper(),
      'amazon-tr': new AmazonTRScraper(),
    };
  }

  /**
   * Initialize price tracker
   */
  async initialize(): Promise<void> {
    await priceHistoryManager.initialize();
    console.log('✓ Price tracker service initialized');
  }

  /**
   * Add product to tracking by URL
   */
  async addProductByUrl(url: string): Promise<Product | null> {
    try {
      const tracker = this.getTrackerForUrl(url);

      if (!tracker) {
        throw new Error('Unsupported marketplace URL');
      }

      const scrapedProduct = await tracker.trackProduct(url);

      if (!this.isScrapedProductUsable(scrapedProduct)) {
        throw new Error('Failed to scrape product details');
      }

      const product = await priceHistoryManager.addProduct({
        url,
        name: scrapedProduct.name,
        currentPrice: scrapedProduct.price,
        currency: scrapedProduct.currency,
        available: scrapedProduct.available,
        imageUrl: scrapedProduct.imageUrl,
        marketplace: tracker.getMarketplace(),
        lastChecked: new Date().toISOString(),
        source: 'live',
      });

      return product;
    } catch (error) {
      console.error('Error adding product:', error);
      return null;
    }
  }

  /**
   * Update all tracked products
   */
  async updateAllProducts(): Promise<void> {
    console.log('📊 Starting price update for all tracked products...');

    const products = await priceHistoryManager.getAllProducts();
    console.log(`Found ${products.length} products to update`);

    let successCount = 0;
    let failCount = 0;

    for (const product of products) {
      try {
        const tracker = this.getTrackerForUrl(product.url);

        if (!tracker) {
          console.warn(`No tracker found for: ${product.url}`);
          failCount++;
          continue;
        }

        const scrapedProduct = await this.resolveLiveProduct(product, tracker);

        if (this.isScrapedProductUsable(scrapedProduct)) {
          await priceHistoryManager.updateProductPrice(
            product.id,
            scrapedProduct.price,
            scrapedProduct.available,
            {
              name: scrapedProduct.name,
              currency: scrapedProduct.currency,
              imageUrl: scrapedProduct.imageUrl,
              trackingQuery: product.trackingQuery,
              source: 'live',
            }
          );
          successCount++;
        } else {
          console.warn(`Failed to scrape: ${product.name}`);
          failCount++;
        }

        // Rate limiting between products
        await this.sleep(2000);
      } catch (error) {
        console.error(`Error updating product ${product.name}:`, error);
        failCount++;
      }
    }

    console.log(`✓ Price update complete: ${successCount} success, ${failCount} failed`);
  }

  /**
   * Get tracker for URL
   */
  private getTrackerForUrl(url: string): {
    trackProduct: (url: string) => Promise<ScrapedProduct | null>;
    getMarketplace: () => 'trendyol' | 'hepsiburada' | 'n11' | 'amazon-tr';
  } | null {
    if (this.trendyol.isValidUrl(url)) {
      return this.trendyol;
    }
    if (this.hepsiburada.isValidUrl(url)) {
      return this.hepsiburada;
    }
    if (this.n11.isValidUrl(url)) {
      return this.n11;
    }
    if (this.amazon.isValidUrl(url)) {
      return this.amazon;
    }
    return null;
  }

  private isScrapedProductUsable(scrapedProduct: ScrapedProduct | null): scrapedProduct is ScrapedProduct {
    return Boolean(
      scrapedProduct
      && scrapedProduct.name.trim().length > 0
      && Number.isFinite(scrapedProduct.price)
      && scrapedProduct.price > 0
      && scrapedProduct.currency.trim().length > 0
    );
  }

  private async resolveLiveProduct(
    product: Product,
    tracker: {
      trackProduct: (url: string) => Promise<ScrapedProduct | null>;
      getMarketplace: () => 'trendyol' | 'hepsiburada' | 'n11' | 'amazon-tr';
    }
  ): Promise<ScrapedProduct | null> {
    const directResult = await tracker.trackProduct(product.url);

    if (this.isScrapedProductUsable(directResult)) {
      return directResult;
    }

    const searchResolved = await this.resolveViaMarketplaceSearch(product);

    if (!searchResolved) {
      return null;
    }

    return {
      name: searchResolved.name,
      price: searchResolved.price,
      currency: searchResolved.currency,
      available: searchResolved.inStock,
      imageUrl: searchResolved.imageUrl || '',
    };
  }

  private async resolveViaMarketplaceSearch(product: Product): Promise<ProductResult | null> {
    const searcher = this.showcaseSearchers[product.marketplace];
    const queries = Array.from(
      new Set(
        [product.trackingQuery, product.name]
          .map((query) => query?.trim())
          .filter((query): query is string => Boolean(query))
      )
    );

    for (const query of queries) {
      try {
        const results = await searcher.search(query);
        const bestMatch = results
          .filter((result) => result.name.trim().length > 0 && Number.isFinite(result.price) && result.price > 0)
          .sort((left, right) => this.scoreSearchMatch(product, right) - this.scoreSearchMatch(product, left))[0];

        if (bestMatch && this.scoreSearchMatch(product, bestMatch) >= 4) {
          return bestMatch;
        }
      } catch (error) {
        console.warn(`Live search refresh failed for ${product.name} with query "${query}":`, error);
      }
    }

    return null;
  }

  private scoreSearchMatch(product: Product, result: ProductResult): number {
    const normalizedQuery = `${product.trackingQuery || ''} ${product.name}`
      .toLocaleLowerCase('tr-TR')
      .replace(/[^a-z0-9çğıöşü\s"]/gi, ' ');
    const normalizedName = result.name
      .toLocaleLowerCase('tr-TR')
      .replace(/[^a-z0-9çğıöşü\s"]/gi, ' ');

    const queryTokens = normalizedQuery
      .split(/\s+/)
      .filter((token) => token.length >= 2);

    let score = 0;

    for (const token of queryTokens) {
      if (normalizedName.includes(token)) {
        score += token.length >= 5 ? 3 : 1;
      }
    }

    const accessoryTerms = [
      'guide',
      'user guide',
      'manual',
      'beginners',
      'beginner',
      'tips',
      'tricks',
      'concise',
      'paperback',
      'hardcover',
      'book',
      'books',
      'kitap',
      'kilif',
      'kılıf',
      'case',
      'cover',
      'koruyucu',
      'ekran koruyucu',
      'screen',
      'nano',
      'film',
      'cam',
      'kapak',
    ];

    for (const term of accessoryTerms) {
      if (normalizedName.includes(term)) {
        score -= 8;
      }
    }

    if (product.marketplace === 'amazon-tr' && normalizedName.includes('kobo')) {
      score -= 8;
    }

    const queryLooksLikeWatch =
      normalizedQuery.includes('watch')
      || normalizedQuery.includes('saat');
    const nameLooksLikeEarbuds =
      normalizedName.includes('buds')
      || normalizedName.includes('kulaklik')
      || normalizedName.includes('kulaklık')
      || normalizedName.includes('earbuds');

    if (queryLooksLikeWatch && nameLooksLikeEarbuds) {
      score -= 20;
    }

    return score;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    await this.amazon.close();
    await this.showcaseSearchers['amazon-tr'].close();
    console.log('✓ Price tracker service cleaned up');
  }
}

export const priceTrackerService = new PriceTrackerService();
