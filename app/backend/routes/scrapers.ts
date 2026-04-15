import { Hono } from 'hono';
import { scraperManager } from '../scrapers';
import { priceDb } from '../services/price-db';

const scrapersRoutes = new Hono();

/**
 * GET /api/scrapers/status
 * Get status of all registered scrapers
 */
scrapersRoutes.get('/status', (c) => {
  const stats = scraperManager.getStats();

  const scrapers = stats.scraperMetrics.map(metric => ({
    id: `scraper-${metric.source}`,
    name: metric.source.charAt(0).toUpperCase() + metric.source.slice(1),
    status: metric.status === 'healthy' ? 'running' : metric.status === 'degraded' ? 'paused' : 'error',
    last_run: metric.lastCheck.toISOString(),
    data_count: metric.successCount + metric.failureCount,
    success_rate: metric.successRate,
    category: 'ecommerce',
    schedule: 'On demand',
    avg_duration_secs: Math.round(metric.averageResponseTime / 1000),
  }));

  return c.json(scrapers);
});

/**
 * GET /api/scrapers/health
 * Get health summary of all scrapers
 */
scrapersRoutes.get('/health', (c) => {
  const stats = scraperManager.getStats();
  return c.json({
    overall: stats.health,
    scrapers: stats.scraperMetrics,
    cache: stats.cacheStats,
  });
});

/**
 * POST /api/scrapers/search
 * Search products across all enabled scrapers
 * Body: { query: string, sources?: string[], useCache?: boolean }
 */
scrapersRoutes.post('/search', async (c) => {
  try {
    const body = await c.req.json();
    const { query, sources, useCache = true } = body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return c.json({ error: 'Query is required' }, 400);
    }

    console.log(`\n📦 Search request: "${query}"`);

    // Search all sources
    const result = await scraperManager.searchAll(query, {
      sources,
      useCache,
    });

    // Save to database
    if (result.totalProducts > 0) {
      const product = priceDb.saveProduct(query, query);

      // Save price records for each source
      const priceRecords = result.results
        .filter(r => !r.error && r.products.length > 0)
        .flatMap(r => r.products.map(p => ({
          productId: product.id,
          source: r.source,
          price: p.price,
          currency: p.currency,
          inStock: p.inStock,
          url: p.url,
        })));

      if (priceRecords.length > 0) {
        priceDb.savePriceRecordsBatch(priceRecords);
        console.log(`✓ Saved ${priceRecords.length} price records to database`);
      }
    }

    return c.json(result);
  } catch (error) {
    console.error('Search error:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Search failed',
    }, 500);
  }
});

/**
 * GET /api/scrapers/search/:query
 * Search products (GET alternative)
 */
scrapersRoutes.get('/search/:query', async (c) => {
  try {
    const query = c.req.param('query');

    if (!query || query.trim().length === 0) {
      return c.json({ error: 'Query is required' }, 400);
    }

    const result = await scraperManager.searchAll(query);

    // Save to database
    if (result.totalProducts > 0) {
      const product = priceDb.saveProduct(query, query);

      const priceRecords = result.results
        .filter(r => !r.error && r.products.length > 0)
        .flatMap(r => r.products.map(p => ({
          productId: product.id,
          source: r.source,
          price: p.price,
          currency: p.currency,
          inStock: p.inStock,
          url: p.url,
        })));

      if (priceRecords.length > 0) {
        priceDb.savePriceRecordsBatch(priceRecords);
      }
    }

    return c.json(result);
  } catch (error) {
    console.error('Search error:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Search failed',
    }, 500);
  }
});

/**
 * GET /api/scrapers/products/:productId/prices
 * Get price history for a product
 */
scrapersRoutes.get('/products/:productId/prices', (c) => {
  try {
    const productId = parseInt(c.req.param('productId'));

    if (isNaN(productId)) {
      return c.json({ error: 'Invalid product ID' }, 400);
    }

    const prices = priceDb.getLatestPrices(productId);
    return c.json(prices);
  } catch (error) {
    console.error('Error fetching prices:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to fetch prices',
    }, 500);
  }
});

/**
 * GET /api/scrapers/products/:productId/history
 * Get historical price data for a product
 */
scrapersRoutes.get('/products/:productId/history', (c) => {
  try {
    const productId = parseInt(c.req.param('productId'));
    const source = c.req.query('source');
    const days = parseInt(c.req.query('days') || '30');

    if (isNaN(productId)) {
      return c.json({ error: 'Invalid product ID' }, 400);
    }

    if (!source) {
      return c.json({ error: 'Source is required' }, 400);
    }

    const history = priceDb.getPriceHistory(productId, source, days);
    return c.json(history);
  } catch (error) {
    console.error('Error fetching history:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Failed to fetch history',
    }, 500);
  }
});

/**
 * POST /api/scrapers/cache/invalidate
 * Invalidate cache for a query
 * Body: { query: string }
 */
scrapersRoutes.post('/cache/invalidate', async (c) => {
  try {
    const body = await c.req.json();
    const { query } = body;

    if (!query) {
      return c.json({ error: 'Query is required' }, 400);
    }

    await scraperManager.invalidateCache(query);

    return c.json({
      success: true,
      message: `Cache invalidated for query: ${query}`,
    });
  } catch (error) {
    console.error('Cache invalidation error:', error);
    return c.json({
      error: error instanceof Error ? error.message : 'Cache invalidation failed',
    }, 500);
  }
});

/**
 * GET /api/scrapers/stats
 * Get comprehensive scraper statistics
 */
scrapersRoutes.get('/stats', (c) => {
  const stats = scraperManager.getStats();
  return c.json(stats);
});

export { scrapersRoutes };
