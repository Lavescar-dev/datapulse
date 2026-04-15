import type {
  CryptoWidgetData,
  NewsWidgetData,
  SocialWidgetData,
  PriceWidgetData,
  MonitorWidgetData,
  ScraperWidgetData,
  SEOWidgetData,
  WidgetSource,
  WidgetConfig,
} from '../../../shared/types/dashboard';
import { newsCache } from '../../cache/news-cache';
import { socialCache } from '../../cache/social-cache';
import { priceHistoryManager } from '../../cache/price-history';
import { apiHealthManager } from '../../cache/api-health';
import { getCryptoData } from '../../cron/crypto';

/**
 * Widget data fetching service
 * Aggregates data from various modules for dashboard widgets
 */
export class WidgetService {
  /**
   * Fetch data for a specific widget based on its source
   */
  async fetchWidgetData(config: WidgetConfig): Promise<any> {
    try {
      switch (config.source) {
        case 'crypto':
          return await this.fetchCryptoData(config);
        case 'news':
          return await this.fetchNewsData(config);
        case 'social':
          return await this.fetchSocialData(config);
        case 'price':
          return await this.fetchPriceData(config);
        case 'monitor':
          return await this.fetchMonitorData(config);
        case 'scraper':
          return await this.fetchScraperData(config);
        case 'seo':
          return await this.fetchSEOData(config);
        default:
          throw new Error(`Unknown widget source: ${config.source}`);
      }
    } catch (error) {
      console.error(`Error fetching widget data for ${config.id}:`, error);
      throw error;
    }
  }

  /**
   * Fetch cryptocurrency data
   */
  private async fetchCryptoData(config: WidgetConfig): Promise<CryptoWidgetData> {
    const cache = await getCryptoData();

    if (!cache) {
      throw new Error('Crypto data not available');
    }

    const limit = config.limit || 10;
    const result: CryptoWidgetData = {};

    // Extract relevant data based on widget type
    if (config.type === 'table' || config.type === 'list') {
      result.coins = cache.coins.slice(0, limit).map((coin) => ({
        name: coin.name,
        symbol: coin.symbol,
        price: coin.current_price,
        change24h: coin.price_change_percentage_24h,
        marketCap: coin.market_cap,
      }));
    }

    if (config.type === 'stat') {
      const dataKey = config.dataKey || 'fearGreedIndex';

      if (dataKey === 'fearGreedIndex') {
        result.fearGreedIndex = {
          value: cache.fearGreedIndex.value,
          classification: cache.fearGreedIndex.value_classification,
        };
      } else if (dataKey === 'marketStats') {
        result.marketStats = {
          totalMarketCap: cache.marketStats.total_market_cap,
          totalVolume: cache.marketStats.total_volume,
          btcDominance: cache.marketStats.btc_dominance,
        };
      }
    }

    if (config.type === 'chart') {
      // For charts, provide top N coins with price data
      result.coins = cache.coins.slice(0, limit).map((coin) => ({
        name: coin.name,
        symbol: coin.symbol,
        price: coin.current_price,
        change24h: coin.price_change_percentage_24h,
        marketCap: coin.market_cap,
      }));
    }

    return result;
  }

  /**
   * Fetch news data
   */
  private async fetchNewsData(config: WidgetConfig): Promise<NewsWidgetData> {
    const cache = await newsCache.get();

    if (!cache) {
      throw new Error('News data not available');
    }

    const limit = config.limit || 10;
    let articles = cache.articles;
    const filters = config.filters;

    // Apply filters if provided
    if (filters?.category) {
      articles = articles.filter((a) => a.category === filters.category);
    }

    if (filters?.sentiment) {
      articles = articles.filter((a) => a.sentiment === filters.sentiment);
    }

    // Sort by date (most recent first)
    articles = articles.sort(
      (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
    );

    return {
      articles: articles.slice(0, limit).map((article) => ({
        id: article.id,
        title: article.title,
        source: article.sourceName,
        category: article.category,
        sentiment: article.sentiment,
        pubDate: article.pubDate,
        link: article.link,
      })),
      totalCount: articles.length,
    };
  }

  /**
   * Fetch social media data
   */
  private async fetchSocialData(config: WidgetConfig): Promise<SocialWidgetData> {
    const cache = await socialCache.get();

    if (!cache) {
      throw new Error('Social data not available');
    }

    const limit = config.limit || 10;
    let posts = cache.posts;
    const filters = config.filters;

    // Apply filters if provided
    if (filters?.platform) {
      posts = posts.filter((p) => p.platform === filters.platform);
    }

    // Sort by score (highest first) then by timestamp
    posts = posts.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.timestamp - a.timestamp;
    });

    return {
      posts: posts.slice(0, limit).map((post) => ({
        id: post.id,
        platform: post.platform,
        title: post.title,
        score: post.score,
        metadata: post.metadata,
        url: post.url,
        timestamp: post.timestamp,
      })),
      totalCount: posts.length,
    };
  }

  /**
   * Fetch price tracking data
   */
  private async fetchPriceData(config: WidgetConfig): Promise<PriceWidgetData> {
    const products = await priceHistoryManager.getAllProducts();

    if (!products || products.length === 0) {
      throw new Error('Price tracking data not available');
    }

    const limit = config.limit || 10;
    let filteredProducts = products;
    const filters = config.filters;

    // Apply filters if provided
    if (filters?.marketplace) {
      filteredProducts = filteredProducts.filter(
        (p) => p.marketplace === filters.marketplace
      );
    }

    if (filters?.available !== undefined) {
      filteredProducts = filteredProducts.filter(
        (p) => p.available === filters.available
      );
    }

    // Get price stats for each product
    const productsWithStats = await Promise.all(
      filteredProducts.slice(0, limit).map(async (product) => {
        const stats = await priceHistoryManager.getPriceStats(product.id);
        return {
          id: product.id,
          name: product.name,
          marketplace: product.marketplace,
          currentPrice: product.currentPrice,
          currency: product.currency,
          priceChange: stats?.priceChange,
          priceChangePercent: stats?.priceChangePercent,
          available: product.available,
        };
      })
    );

    return {
      products: productsWithStats,
      totalCount: filteredProducts.length,
    };
  }

  /**
   * Fetch API monitoring data
   */
  private async fetchMonitorData(config: WidgetConfig): Promise<MonitorWidgetData> {
    const endpoints = await apiHealthManager.getAllEndpoints();

    if (!endpoints || endpoints.length === 0) {
      throw new Error('API monitoring data not available');
    }

    const limit = config.limit || 10;
    let filteredEndpoints = endpoints;
    const filters = config.filters;

    // Apply filters if provided
    if (filters?.status) {
      filteredEndpoints = filteredEndpoints.filter(
        (e) => e.currentStatus === filters.status
      );
    }

    if (filters?.enabled !== undefined) {
      filteredEndpoints = filteredEndpoints.filter(
        (e) => e.enabled === filters.enabled
      );
    }

    // Sort by status (down first for alerting)
    filteredEndpoints = filteredEndpoints.sort((a, b) => {
      const statusOrder = { down: 0, unknown: 1, up: 2 };
      return statusOrder[a.currentStatus] - statusOrder[b.currentStatus];
    });

    const summary = await apiHealthManager.getSummary();

    return {
      endpoints: filteredEndpoints.slice(0, limit).map((endpoint) => ({
        id: endpoint.id,
        name: endpoint.name,
        url: endpoint.url,
        status: endpoint.currentStatus,
        uptime24h: endpoint.uptimeStats['24h'].uptimePercent,
        responseTime: endpoint.lastResponseTime,
        lastCheck: endpoint.lastCheck,
      })),
      summary: {
        total: summary.total,
        up: summary.up,
        down: summary.down,
        unknown: summary.unknown,
      },
    };
  }

  /**
   * Fetch scraper data (placeholder - would need actual implementation)
   */
  private async fetchScraperData(config: WidgetConfig): Promise<ScraperWidgetData> {
    // This would need access to scraper job history
    // For now, return placeholder data
    return {
      recentJobs: [],
      totalJobs: 0,
      successRate: 0,
    };
  }

  /**
   * Fetch SEO data (placeholder - would need actual implementation)
   */
  private async fetchSEOData(config: WidgetConfig): Promise<SEOWidgetData> {
    // This would need access to SEO analysis history
    // For now, return placeholder data
    return {
      recentAnalyses: [],
      totalAnalyses: 0,
    };
  }

  /**
   * Fetch data for multiple widgets in parallel
   */
  async fetchMultipleWidgets(configs: WidgetConfig[]): Promise<Map<string, any>> {
    const results = new Map<string, any>();

    await Promise.all(
      configs.map(async (config) => {
        try {
          const data = await this.fetchWidgetData(config);
          results.set(config.id, data);
        } catch (error) {
          console.error(`Error fetching widget ${config.id}:`, error);
          results.set(config.id, {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      })
    );

    return results;
  }
}

export const widgetService = new WidgetService();
