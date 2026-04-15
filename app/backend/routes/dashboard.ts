import { Hono } from 'hono';

const dashboardRoutes = new Hono();

interface DashboardStats {
  total_scrapers: number;
  active_scrapers: number;
  data_points: number;
  uptime: number;
  scrapers: Array<{
    id: string;
    name: string;
    status: 'running' | 'idle' | 'error' | 'paused';
    last_run: string;
    success_rate: number;
    data_count: number;
    category: string;
    schedule: string;
    avg_duration_secs: number;
  }>;
}

const scrapersData: Array<[string, string, string, string, number, number]> = [
  ['scraper-001', 'E-Commerce Price Tracker', 'ecommerce', 'Every 6h', 45467, 180],
  ['scraper-002', 'Social Media Trends', 'social', 'Every 1h', 127050, 45],
  ['scraper-003', 'News Aggregator', 'news', 'Every 30m', 68612, 30],
  ['scraper-004', 'Crypto Market Data', 'crypto', 'Every 5m', 312868, 15],
  ['scraper-005', 'Weather Data Collector', 'weather', 'Every 15m', 89342, 20],
  ['scraper-006', 'Stock Market Monitor', 'finance', 'Every 1m', 456789, 5],
];

const statuses: Array<'running' | 'idle' | 'error' | 'paused'> = ['running', 'running', 'running', 'running', 'idle', 'paused'];

function generateDashboardStats(): DashboardStats {
  const now = Date.now();

  const scrapers = scrapersData.map(([id, name, category, schedule, baseDataCount, avgDuration], index) => {
    const hoursAgo = Math.floor(Math.random() * 12);
    const lastRun = new Date(now - hoursAgo * 60 * 60 * 1000);

    const dataVariation = Math.floor(Math.random() * 5000) - 2500;
    const data_count = Math.max(1000, baseDataCount + dataVariation);

    const successRate = Math.round((Math.random() * 10 + 90) * 10) / 10;

    return {
      id,
      name,
      status: statuses[index % statuses.length] ?? 'idle',
      last_run: lastRun.toISOString(),
      data_count,
      success_rate: successRate,
      category,
      schedule,
      avg_duration_secs: avgDuration,
    };
  });

  const activeScrapers = scrapers.filter(s => s.status === 'running').length;
  const totalDataPoints = scrapers.reduce((sum, s) => sum + s.data_count, 0);

  return {
    total_scrapers: scrapers.length,
    active_scrapers: activeScrapers,
    data_points: totalDataPoints,
    uptime: Math.round(Math.random() * 5 + 95 * 10) / 10, // 95-100%
    scrapers,
  };
}

dashboardRoutes.get('/stats', (c) => {
  const stats = generateDashboardStats();
  return c.json(stats);
});

export { dashboardRoutes };
