import type { IScraper, ProductResult, ScraperResult } from './base';
import { scraperCache } from '../cache/scraper-cache';
import { healthMonitor } from './health';
import { productNormalizer } from './normalizer';

interface AggregatedResult {
  query: string;
  results: ScraperResult[];
  totalProducts: number;
  cached: boolean;
  timestamp: Date;
  sources: string[];
}

export class ScraperManager {
  private scrapers: Map<string, IScraper> = new Map();
  private maxConcurrent = 4;

  /**
   * Register a scraper
   */
  register(scraper: IScraper): void {
    const source = scraper.getSource();
    this.scrapers.set(source, scraper);
    healthMonitor.initializeScraper(source);
    console.log(`✓ Registered scraper: ${source}`);
  }

  /**
   * Unregister a scraper
   */
  unregister(source: string): void {
    this.scrapers.delete(source);
    console.log(`✓ Unregistered scraper: ${source}`);
  }

  /**
   * Get all registered scraper sources
   */
  getSources(): string[] {
    return Array.from(this.scrapers.keys());
  }

  /**
   * Search single source with cache
   */
  async searchSource(
    source: string,
    query: string,
    useCache = true
  ): Promise<ScraperResult> {
    const scraper = this.scrapers.get(source);

    if (!scraper) {
      return {
        source,
        products: [],
        query,
        scrapedAt: new Date(),
        error: `Scraper not found: ${source}`,
      };
    }

    // Check cache first
    if (useCache) {
      const cached = await scraperCache.get<ProductResult[]>(source, query);
      if (cached) {
        return {
          source,
          products: cached,
          query,
          scrapedAt: new Date(),
        };
      }
    }

    // Execute scraper
    const startTime = Date.now();
    try {
      console.log(`🔍 Scraping ${source} for: "${query}"`);

      const rawProducts = await scraper.search(query);

      const duration = Date.now() - startTime;

      // Normalize and validate products
      const { valid: products, invalid, warnings } = productNormalizer.processProducts(rawProducts);

      if (invalid.length > 0) {
        console.warn(`⚠️  ${source}: ${invalid.length} invalid products filtered out`);
      }

      if (warnings.length > 0) {
        console.warn(`⚠️  ${source}: ${warnings.length} products with warnings`);
      }

      console.log(
        `✓ ${source} completed in ${duration}ms (${products.length}/${rawProducts.length} valid products)`
      );

      // Record success in health monitor
      healthMonitor.recordExecution(source, true, duration);

      // Cache results
      if (products.length > 0) {
        await scraperCache.set(source, query, products);
      }

      return {
        source,
        products,
        query,
        scrapedAt: new Date(),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error(`✗ ${source} failed:`, errorMessage);

      // Record failure in health monitor
      healthMonitor.recordExecution(source, false, duration, errorMessage);

      return {
        source,
        products: [],
        query,
        scrapedAt: new Date(),
        error: errorMessage,
      };
    }
  }

  /**
   * Search all sources in parallel
   */
  async searchAll(
    query: string,
    options: {
      sources?: string[];
      useCache?: boolean;
      maxConcurrent?: number;
    } = {}
  ): Promise<AggregatedResult> {
    const {
      sources = this.getSources(),
      useCache = true,
      maxConcurrent = this.maxConcurrent,
    } = options;

    console.log(`\n🔍 Starting search for: "${query}"`);
    console.log(`📦 Sources: ${sources.join(', ')}`);

    // Execute scrapers with concurrency limit
    const results = await this.executeConcurrent(
      sources.map((source) => () => this.searchSource(source, query, useCache)),
      maxConcurrent
    );

    // Separate successful results and failures
    const successful = results.filter((r) => !r.error);
    const failed = results.filter((r) => r.error);

    if (failed.length > 0) {
      console.warn(
        `⚠️  ${failed.length} scraper(s) failed: ${failed.map((r) => r.source).join(', ')}`
      );
    }

    const totalProducts = successful.reduce(
      (sum, r) => sum + r.products.length,
      0
    );

    console.log(`✓ Search completed: ${totalProducts} total products\n`);

    return {
      query,
      results,
      totalProducts,
      cached: results.some((r) => !r.error && r.products.length > 0),
      timestamp: new Date(),
      sources: successful.map((r) => r.source),
    };
  }

  /**
   * Execute promises with concurrency limit
   */
  private async executeConcurrent<T>(
    factories: Array<() => Promise<T>>,
    maxConcurrent: number
  ): Promise<T[]> {
    const results: T[] = [];
    const executing: Promise<void>[] = [];

    for (const factory of factories) {
      const promise = factory().then((result) => {
        results.push(result);
        executing.splice(executing.indexOf(promise), 1);
      });

      executing.push(promise);

      if (executing.length >= maxConcurrent) {
        await Promise.race(executing);
      }
    }

    await Promise.all(executing);
    return results;
  }

  /**
   * Invalidate cache for all sources
   */
  async invalidateCache(query: string): Promise<void> {
    const sources = this.getSources();
    await Promise.all(
      sources.map((source) => scraperCache.invalidate(source, query))
    );
    console.log(`✓ Cache invalidated for query: "${query}"`);
  }

  /**
   * Get scraper statistics
   */
  getStats() {
    return {
      registeredScrapers: this.scrapers.size,
      sources: this.getSources(),
      cacheStats: scraperCache.getStats(),
      health: healthMonitor.getOverallHealth(),
      scraperMetrics: healthMonitor.getAllMetrics(),
    };
  }

  /**
   * Get health summary
   */
  getHealthSummary(): string {
    return healthMonitor.getHealthSummary();
  }
}

// Export singleton instance
export const scraperManager = new ScraperManager();
