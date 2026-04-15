import { Hono } from 'hono';
import { authMiddleware, getSessionFromContext } from '../middleware/auth';
import { priceHistoryManager } from '../cache/price-history';
import { priceTrackerService } from '../services/price/tracker';
import { ensurePriceTrackerSeeded } from '../services/price/seed';

const priceRoutes = new Hono();

/**
 * GET /api/price/products
 * Get all tracked products with price history
 */
priceRoutes.get('/products', authMiddleware, async (c) => {
  try {
    await ensurePriceTrackerSeeded();
    const products = await priceHistoryManager.getAllProducts();

    return c.json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    return c.json(
      {
        success: false,
        message: 'Failed to fetch products',
      },
      500
    );
  }
});

/**
 * GET /api/price/products/:id
 * Get a specific product by ID
 */
priceRoutes.get('/products/:id', authMiddleware, async (c) => {
  try {
    const id = c.req.param('id');
    const product = await priceHistoryManager.getProduct(id);

    if (!product) {
      return c.json({ success: false, message: 'Product not found' }, 404);
    }

    return c.json({
      success: true,
      product,
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    return c.json(
      {
        success: false,
        message: 'Failed to fetch product',
      },
      500
    );
  }
});

/**
 * GET /api/price/products/:id/stats
 * Get price statistics for a product
 */
priceRoutes.get('/products/:id/stats', authMiddleware, async (c) => {
  try {
    await ensurePriceTrackerSeeded();
    const id = c.req.param('id');
    const stats = await priceHistoryManager.getPriceStats(id);

    if (!stats) {
      return c.json({ success: false, message: 'Product not found' }, 404);
    }

    return c.json({
      success: true,
      stats,
    });
  } catch (error) {
    console.error('Error fetching product stats:', error);
    return c.json(
      {
        success: false,
        message: 'Failed to fetch product stats',
      },
      500
    );
  }
});

/**
 * POST /api/price/products
 * Add a new product to track (admin only)
 */
priceRoutes.post('/products', authMiddleware, async (c) => {
  try {
    const session = getSessionFromContext(c);

    // Admin-only endpoint
    if (!session.isAdmin) {
      return c.json(
        {
          success: false,
          message: 'Admin access required',
        },
        403
      );
    }

    const body = await c.req.json();
    const { url } = body;

    if (!url) {
      return c.json({ success: false, message: 'URL is required' }, 400);
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (err) {
      return c.json({ success: false, message: 'Invalid URL format' }, 400);
    }

    // Add product using the tracker service
    const product = await priceTrackerService.addProductByUrl(url);

    if (!product) {
      return c.json(
        {
          success: false,
          message: 'Failed to add product. Check if URL is from a supported marketplace.',
        },
        400
      );
    }

    return c.json({
      success: true,
      message: 'Product added successfully',
      product,
    });
  } catch (error) {
    console.error('Error adding product:', error);
    return c.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to add product',
      },
      500
    );
  }
});

/**
 * DELETE /api/price/products/:id
 * Remove a product from tracking (admin only)
 */
priceRoutes.delete('/products/:id', authMiddleware, async (c) => {
  try {
    const session = getSessionFromContext(c);

    // Admin-only endpoint
    if (!session.isAdmin) {
      return c.json(
        {
          success: false,
          message: 'Admin access required',
        },
        403
      );
    }

    const id = c.req.param('id');
    const removed = await priceHistoryManager.removeProduct(id);

    if (!removed) {
      return c.json({ success: false, message: 'Product not found' }, 404);
    }

    return c.json({
      success: true,
      message: 'Product removed successfully',
    });
  } catch (error) {
    console.error('Error removing product:', error);
    return c.json(
      {
        success: false,
        message: 'Failed to remove product',
      },
      500
    );
  }
});

/**
 * POST /api/price/alerts
 * Add a price alert (admin only)
 */
priceRoutes.post('/alerts', authMiddleware, async (c) => {
  try {
    const session = getSessionFromContext(c);

    // Admin-only endpoint
    if (!session.isAdmin) {
      return c.json(
        {
          success: false,
          message: 'Admin access required',
        },
        403
      );
    }

    const body = await c.req.json();
    const { productId, targetPrice, condition } = body;

    if (!productId || !targetPrice || !condition) {
      return c.json(
        {
          success: false,
          message: 'productId, targetPrice, and condition are required',
        },
        400
      );
    }

    if (condition !== 'below' && condition !== 'above') {
      return c.json(
        {
          success: false,
          message: 'condition must be "below" or "above"',
        },
        400
      );
    }

    const alert = await priceHistoryManager.addAlert({
      productId,
      targetPrice,
      condition,
    });

    return c.json({
      success: true,
      message: 'Alert added successfully',
      alert,
    });
  } catch (error) {
    console.error('Error adding alert:', error);
    return c.json(
      {
        success: false,
        message: 'Failed to add alert',
      },
      500
    );
  }
});

/**
 * GET /api/price/alerts/:productId
 * Get alerts for a specific product
 */
priceRoutes.get('/alerts/:productId', authMiddleware, async (c) => {
  try {
    const session = getSessionFromContext(c);

    // Admin-only endpoint
    if (!session.isAdmin) {
      return c.json(
        {
          success: false,
          message: 'Admin access required',
        },
        403
      );
    }

    const productId = c.req.param('productId');
    const alerts = await priceHistoryManager.getProductAlerts(productId);

    return c.json({
      success: true,
      count: alerts.length,
      alerts,
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return c.json(
      {
        success: false,
        message: 'Failed to fetch alerts',
      },
      500
    );
  }
});

/**
 * GET /api/price/export/:id
 * Export product price history as CSV
 */
priceRoutes.get('/export/:id', authMiddleware, async (c) => {
  try {
    const session = getSessionFromContext(c);

    // Admin-only endpoint
    if (!session.isAdmin) {
      return c.json(
        {
          success: false,
          message: 'Admin access required',
        },
        403
      );
    }

    const id = c.req.param('id');
    const csv = await priceHistoryManager.exportProductHistoryCSV(id);

    if (!csv) {
      return c.json({ success: false, message: 'Product not found' }, 404);
    }

    // Get product name for filename
    const product = await priceHistoryManager.getProduct(id);
    const filename = product
      ? `${product.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_price_history.csv`
      : 'price_history.csv';

    // Set headers for CSV download
    c.header('Content-Type', 'text/csv');
    c.header('Content-Disposition', `attachment; filename="${filename}"`);

    return c.body(csv);
  } catch (error) {
    console.error('Error exporting product history:', error);
    return c.json(
      {
        success: false,
        message: 'Failed to export product history',
      },
      500
    );
  }
});

export { priceRoutes };
