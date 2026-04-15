import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { adminAuth } from './auth/admin';
import { sessionManager } from './auth/session';
import { authMiddleware, adminOnlyMiddleware, getSessionFromContext, optionalAuthMiddleware, requestCountMiddleware, writeSessionCookie } from './middleware/auth';
import { rateLimiter, getClientIP } from './middleware/ratelimit';
import { startCryptoCron, getCryptoData } from './cron/crypto';
import { startNewsCron, getNewsData } from './cron/news';
import { startSocialCron, getSocialData } from './cron/social';
import { startMonitorCron } from './cron/monitor';
import { startPriceCron } from './cron/price';
import { api } from './routes';
import { initializeScrapers } from './scrapers';
import { initDatabase } from './db/init';
import { initializeWorkers } from './queue/index';
import { monitorService } from './services/monitor/monitor';
import { seedMonitorEndpoints } from './services/monitor/seed';
import { coinGeckoClient } from './services/crypto/coingecko';
import { COIN_CHART_RANGES, type CoinChartRange } from '../shared/types/crypto';
import { ensurePriceTrackerSeeded } from './services/price/seed';

const app = new Hono();
const defaultCorsOrigins = [
  'http://localhost:3031',
  'http://127.0.0.1:3031',
  'http://localhost:4331',
  'http://127.0.0.1:4331',
];
const corsOrigins = (process.env.CORS_ORIGINS || process.env.DATAPULSE_FRONTEND_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = corsOrigins.length > 0 ? corsOrigins : defaultCorsOrigins;
// CORS middleware
app.use('*', cors({
  origin: (origin) => {
    if (!origin) return allowedOrigins[0] || defaultCorsOrigins[0];
    return allowedOrigins.includes(origin) ? origin : '';
  },
  credentials: true,
}));

// Mount API routes
app.route('/api', api);

// Health check (public)
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================================================
// Session Management Routes
// ============================================================================

/**
 * POST /api/session/start
 * Create a new demo session
 */
app.post('/api/session/start', async (c) => {
  const ip = getClientIP(c);

  // Create demo session
  const token = await sessionManager.createDemoSession(ip);

  // Set cookie
  writeSessionCookie(c, token);

  const status = await sessionManager.getSessionStatus(token);

  return c.json({
    success: true,
    session: status,
    remainingSessionsToday: rateLimiter.getRemainingSessions(ip),
  });
});

/**
 * GET /api/session/status
 * Get current session status
 */
app.get('/api/session/status', optionalAuthMiddleware, async (c) => {
  const ip = getClientIP(c);
  const session = c.get('session') as ReturnType<typeof getSessionFromContext> | undefined;
  const token = c.req.header('Cookie')?.split(`${sessionManager.getCookieName()}=`)[1]?.split(';')[0] || '';

  const status = token ? await sessionManager.getSessionStatus(token) : null;

  if (!status || !session) {
    return c.json({
      active: false,
      isAdmin: false,
      requestsRemaining: 0,
      timeRemaining: 0,
      expiresAt: 0,
      scrapesRemaining: 0,
      seoAnalysesRemaining: 0,
      remainingSessionsToday: rateLimiter.getRemainingSessions(ip),
    });
  }

  return c.json({
    ...status,
    isAdmin: session.isAdmin,
    remainingSessionsToday: rateLimiter.getRemainingSessions(ip),
  });
});

// ============================================================================
// Admin Authentication Routes
// ============================================================================

/**
 * POST /api/admin/login
 * Admin login endpoint
 */
app.post('/api/admin/login', async (c) => {
  const body = await c.req.json();
  const { username, password } = body;

  if (!username || !password) {
    return c.json({ error: 'Username and password required' }, 400);
  }

  const isValid = adminAuth.verify({ username, password });

  if (!isValid) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const ip = getClientIP(c);
  const token = await sessionManager.createAdminSession(ip);

  // Set cookie
  writeSessionCookie(c, token, 24 * 60 * 60);

  return c.json({
    success: true,
    message: 'Admin login successful',
    username: adminAuth.getUsername(),
  });
});

// ============================================================================
// Protected API Routes (Demo + Admin)
// ============================================================================

/**
 * GET /api/crypto/coins
 * Get cryptocurrency data (protected, counts against request limit)
 */
app.get('/api/crypto/coins', authMiddleware, requestCountMiddleware, async (c) => {
  try {
    const data = await getCryptoData();
    return c.json(data);
  } catch (error) {
    console.error('Error fetching crypto data:', error);
    return c.json({ error: 'Failed to fetch crypto data' }, 500);
  }
});

/**
 * GET /api/crypto/coins/:coinId/chart
 * Get popup-only cryptocurrency chart history (protected, does not count against request limit)
 */
app.get('/api/crypto/coins/:coinId/chart', authMiddleware, async (c) => {
  const coinId = c.req.param('coinId');
  const range = c.req.query('range');

  if (!coinId) {
    return c.json({ error: 'Coin ID is required' }, 400);
  }

  if (!range || !COIN_CHART_RANGES.includes(range as CoinChartRange)) {
    return c.json({ error: 'Invalid chart range' }, 400);
  }

  try {
    const chart = await coinGeckoClient.getCoinChart(coinId, range as CoinChartRange);
    return c.json(chart);
  } catch (error) {
    console.error(`Error fetching chart data for ${coinId} (${range}):`, error);
    return c.json({ error: 'Chart verisi alınamadı' }, 500);
  }
});

// ============================================================================
// Admin-Only Routes
// ============================================================================

/**
 * GET /api/admin/stats
 * Get admin statistics
 */
app.get('/api/admin/stats', authMiddleware, adminOnlyMiddleware, (c) => {
  return c.json({
    rateLimiter: {
      storeSize: rateLimiter.getStoreSize(),
    },
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// Server Configuration
// ============================================================================

const port = Number(process.env.PORT || 8131);

// Initialize database
initDatabase();

// Initialize scrapers
initializeScrapers();

// Initialize BullMQ workers for scraping and SEO
initializeWorkers();

// Initialize and seed monitor service
(async () => {
  await monitorService.initialize();
  await seedMonitorEndpoints();
  void ensurePriceTrackerSeeded();
})();

// Start crypto data cron job
startCryptoCron();

// Start news data cron job
startNewsCron();

// Start social media cron job
startSocialCron();

// Start API monitoring cron job
startMonitorCron();

// Start price tracking cron job
startPriceCron();

console.log(`🚀 Backend server running on http://localhost:${port}`);
console.log(`📝 Admin username: ${adminAuth.getUsername()}`);
console.log(`🔒 JWT secret: ${process.env.JWT_SECRET ? '✓ configured' : '⚠️  using default'}`);

export default {
  port,
  fetch: app.fetch,
};
