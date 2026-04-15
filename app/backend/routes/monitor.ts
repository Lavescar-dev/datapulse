import { Hono } from 'hono';
import { authMiddleware, getSessionFromContext } from '../middleware/auth';
import { monitorService } from '../services/monitor/monitor';
import { seedMonitorEndpoints } from '../services/monitor/seed';

const monitorRoutes = new Hono();

/**
 * GET /api/monitor/endpoints
 * Get all monitored endpoints with health data
 */
monitorRoutes.get('/endpoints', authMiddleware, async (c) => {
  try {
    let endpoints = await monitorService.getAllEndpoints();
    if (endpoints.length === 0) {
      await seedMonitorEndpoints();
      endpoints = await monitorService.getAllEndpoints();
    }

    return c.json({
      success: true,
      count: endpoints.length,
      endpoints,
    });
  } catch (error) {
    console.error('Error fetching endpoints:', error);
    return c.json(
      {
        success: false,
        message: 'Failed to fetch endpoints',
      },
      500
    );
  }
});

/**
 * GET /api/monitor/endpoints/:id
 * Get a specific endpoint by ID
 */
monitorRoutes.get('/endpoints/:id', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id');
    const endpoint = await monitorService.getEndpoint(id);

    if (!endpoint) {
      return c.json({ success: false, message: 'Endpoint not found' }, 404);
    }

    return c.json({
      success: true,
      endpoint,
    });
  } catch (error) {
    console.error('Error fetching endpoint:', error);
    return c.json(
      {
        success: false,
        message: 'Failed to fetch endpoint',
      },
      500
    );
  }
});

/**
 * GET /api/monitor/summary
 * Get summary statistics for all monitored endpoints
 */
monitorRoutes.get('/summary', authMiddleware, async (c) => {
  try {
    const endpoints = await monitorService.getAllEndpoints();
    if (endpoints.length === 0) {
      await seedMonitorEndpoints();
    }
    const stats = await monitorService.getSummaryStats();

    return c.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Error fetching summary stats:', error);
    return c.json(
      {
        success: false,
        message: 'Failed to fetch summary stats',
      },
      500
    );
  }
});

/**
 * POST /api/monitor/endpoints
 * Add new endpoint to monitor (admin only)
 */
monitorRoutes.post('/endpoints', authMiddleware, async (c) => {
  try {
    // Check if user is admin
    const session = getSessionFromContext(c);
    if (!session?.isAdmin) {
      return c.json(
        {
          success: false,
          message: 'Unauthorized: Admin access required',
        },
        403
      );
    }

    const body = await c.req.json();
    const { name, url, method = 'GET', checkInterval = 5 } = body;

    if (!name || !url) {
      return c.json(
        {
          success: false,
          message: 'Name and URL are required',
        },
        400
      );
    }

    const endpoint = await monitorService.addEndpoint(name, url, method, checkInterval);

    if (!endpoint) {
      return c.json(
        {
          success: false,
          message: 'Failed to add endpoint',
        },
        500
      );
    }

    return c.json({
      success: true,
      message: 'Endpoint added successfully',
      endpoint,
    });
  } catch (error) {
    console.error('Error adding endpoint:', error);
    return c.json(
      {
        success: false,
        message: 'Failed to add endpoint',
      },
      500
    );
  }
});

/**
 * DELETE /api/monitor/endpoints/:id
 * Remove endpoint from monitoring (admin only)
 */
monitorRoutes.delete('/endpoints/:id', authMiddleware, async (c) => {
  try {
    // Check if user is admin
    const session = getSessionFromContext(c);
    if (!session?.isAdmin) {
      return c.json(
        {
          success: false,
          message: 'Unauthorized: Admin access required',
        },
        403
      );
    }

    const id = c.req.param('id');
    const removed = await monitorService.removeEndpoint(id);

    if (!removed) {
      return c.json(
        {
          success: false,
          message: 'Endpoint not found',
        },
        404
      );
    }

    return c.json({
      success: true,
      message: 'Endpoint removed successfully',
    });
  } catch (error) {
    console.error('Error removing endpoint:', error);
    return c.json(
      {
        success: false,
        message: 'Failed to remove endpoint',
      },
      500
    );
  }
});

/**
 * POST /api/monitor/endpoints/:id/check
 * Manually trigger health check for an endpoint (admin only)
 */
monitorRoutes.post('/endpoints/:id/check', authMiddleware, async (c) => {
  try {
    // Check if user is admin
    const session = getSessionFromContext(c);
    if (!session?.isAdmin) {
      return c.json(
        {
          success: false,
          message: 'Unauthorized: Admin access required',
        },
        403
      );
    }

    const id = c.req.param('id');
    await monitorService.checkEndpoint(id);

    const endpoint = await monitorService.getEndpoint(id);

    return c.json({
      success: true,
      message: 'Health check completed',
      endpoint,
    });
  } catch (error) {
    console.error('Error checking endpoint:', error);
    return c.json(
      {
        success: false,
        message: 'Failed to check endpoint',
      },
      500
    );
  }
});

export { monitorRoutes };
