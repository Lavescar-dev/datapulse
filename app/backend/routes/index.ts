import { Hono } from 'hono';
import { newsRoutes } from './news';
import { weatherRoutes } from './weather';
import { socialRoutes } from './social';
import { ecommerceRoutes } from './ecommerce';
import { scrapersRoutes } from './scrapers';
import { dashboardRoutes } from './dashboard';
import { scraperRoutes } from './scraper';
import { seoRoutes } from './seo';
import { priceRoutes } from './price';
import { monitorRoutes } from './monitor';
import { dashboardBuilderRoutes } from './dashboard-builder';
import { notificationRoutes } from './notification';

const api = new Hono();

// Mount all route modules
api.route('/news', newsRoutes);
api.route('/weather', weatherRoutes);
api.route('/social', socialRoutes);
api.route('/ecommerce', ecommerceRoutes);
api.route('/scrapers', scrapersRoutes);
api.route('/dashboard', dashboardRoutes);
api.route('/scraper', scraperRoutes);
api.route('/seo', seoRoutes);
api.route('/price', priceRoutes);
api.route('/monitor', monitorRoutes);
api.route('/builder', dashboardBuilderRoutes);
api.route('/notifications', notificationRoutes);

export { api };
