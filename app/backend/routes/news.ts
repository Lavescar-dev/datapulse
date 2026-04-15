import { Hono } from 'hono';
import type { NewsCategory } from '../../shared/types/news';
import { optionalAuthMiddleware, requestCountMiddleware } from '../middleware/auth';
import { getNewsData } from '../cron/news';

const newsRoutes = new Hono();

// Get all news articles (with optional category filter)
// Uses optional auth to track sessions, counts requests for demo users
newsRoutes.get('/', optionalAuthMiddleware, requestCountMiddleware, async (c) => {
  try {
    const cache = await getNewsData();

    if (!cache || !cache.articles) {
      return c.json({
        articles: [],
        count: 0,
        error: 'No news data available',
      }, 404);
    }

    // Check for category filter
    const category = c.req.query('category') as NewsCategory | 'All' | undefined;
    let articles = cache.articles;

    if (category && category !== 'All') {
      articles = articles.filter(article => article.category === category);
    }

    return c.json({
      articles,
      count: articles.length,
      lastUpdated: cache.lastUpdated,
    });
  } catch (error) {
    console.error('Error fetching news:', error);
    return c.json({
      articles: [],
      count: 0,
      error: 'Failed to fetch news',
    }, 500);
  }
});

// Legacy endpoint for backwards compatibility
newsRoutes.get('/feed', async (c) => {
  try {
    const cache = await getNewsData();

    if (!cache || !cache.articles) {
      return c.json({
        articles: [],
        count: 0,
      });
    }

    return c.json({
      articles: cache.articles,
      count: cache.articles.length,
    });
  } catch (error) {
    console.error('Error fetching news feed:', error);
    return c.json({
      articles: [],
      count: 0,
    });
  }
});

export { newsRoutes };
