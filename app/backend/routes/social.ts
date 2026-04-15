import { Hono } from 'hono';
import { socialCache } from '../cache/social-cache';
import type { SocialPlatform } from '../../shared/types/social';
import { optionalAuthMiddleware, requestCountMiddleware } from '../middleware/auth';

const socialRoutes = new Hono();

// Get all social posts
// Uses optional auth to track sessions, counts requests for demo users
socialRoutes.get('/', optionalAuthMiddleware, requestCountMiddleware, async (c) => {
  try {
    const cache = await socialCache.get();

    if (!cache || !cache.posts) {
      return c.json({
        posts: [],
        count: 0,
        message: 'No cached social posts available',
      });
    }

    return c.json({
      posts: cache.posts,
      count: cache.posts.length,
      lastUpdated: cache.lastUpdated,
    });
  } catch (error) {
    console.error('Error fetching social posts:', error);
    return c.json(
      {
        error: 'Failed to fetch social posts',
        posts: [],
      },
      500
    );
  }
});

// Get posts by platform
// Uses optional auth to track sessions, counts requests for demo users
socialRoutes.get('/:platform', optionalAuthMiddleware, requestCountMiddleware, async (c) => {
  try {
    const platform = c.req.param('platform') as SocialPlatform;
    const posts = await socialCache.getByPlatform(platform);

    return c.json({
      posts,
      count: posts.length,
      platform,
    });
  } catch (error) {
    console.error('Error fetching platform posts:', error);
    return c.json(
      {
        error: 'Failed to fetch platform posts',
        posts: [],
      },
      500
    );
  }
});

// Legacy endpoint for backwards compatibility
socialRoutes.get('/trends', async (c) => {
  try {
    const cache = await socialCache.get();

    if (!cache || !cache.posts) {
      return c.json({
        count: 0,
        trends: [],
      });
    }

    return c.json({
      count: cache.posts.length,
      trends: cache.posts,
    });
  } catch (error) {
    console.error('Error fetching trends:', error);
    return c.json(
      {
        error: 'Failed to fetch trends',
        trends: [],
      },
      500
    );
  }
});

export { socialRoutes };
