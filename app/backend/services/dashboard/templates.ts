import type { DashboardTemplate, WidgetConfig } from '../../../shared/types/dashboard';

/**
 * Pre-made dashboard templates
 */

// Template 1: Crypto Overview Dashboard
const cryptoOverviewWidgets: WidgetConfig[] = [
  {
    id: 'crypto-fear-greed',
    type: 'stat',
    source: 'crypto',
    title: 'Fear & Greed Index',
    description: 'Current market sentiment indicator',
    x: 0,
    y: 0,
    w: 4,
    h: 2,
    dataKey: 'fearGreedIndex',
    color: '#f59e0b',
    showHeader: true,
  },
  {
    id: 'crypto-market-cap',
    type: 'stat',
    source: 'crypto',
    title: 'Total Market Cap',
    description: 'Global cryptocurrency market capitalization',
    x: 4,
    y: 0,
    w: 4,
    h: 2,
    dataKey: 'marketStats',
    color: '#3b82f6',
    showHeader: true,
  },
  {
    id: 'crypto-top-coins-chart',
    type: 'chart',
    source: 'crypto',
    title: 'Top Cryptocurrencies',
    description: 'Market cap comparison',
    x: 8,
    y: 0,
    w: 4,
    h: 2,
    chartType: 'bar',
    limit: 10,
    color: '#8b5cf6',
    showHeader: true,
  },
  {
    id: 'crypto-price-table',
    type: 'table',
    source: 'crypto',
    title: 'Live Crypto Prices',
    description: 'Real-time cryptocurrency prices and 24h changes',
    x: 0,
    y: 2,
    w: 12,
    h: 4,
    limit: 15,
    showHeader: true,
  },
  {
    id: 'crypto-news-feed',
    type: 'list',
    source: 'news',
    title: 'Crypto News',
    description: 'Latest cryptocurrency news',
    x: 0,
    y: 6,
    w: 6,
    h: 3,
    limit: 8,
    filters: { category: 'Crypto' },
    showHeader: true,
  },
  {
    id: 'crypto-social-feed',
    type: 'list',
    source: 'social',
    title: 'Trending on Reddit',
    description: 'Hot crypto discussions',
    x: 6,
    y: 6,
    w: 6,
    h: 3,
    limit: 8,
    filters: { platform: 'Reddit' },
    showHeader: true,
  },
];

export const cryptoOverviewTemplate: DashboardTemplate = {
  id: 'crypto-overview',
  name: 'Crypto Overview',
  description:
    'Comprehensive cryptocurrency dashboard with market data, prices, news, and social sentiment',
  category: 'crypto',
  widgets: cryptoOverviewWidgets,
};

// Template 2: Tech News Hub Dashboard
const techNewsHubWidgets: WidgetConfig[] = [
  {
    id: 'news-tech-articles',
    type: 'list',
    source: 'news',
    title: 'Technology News',
    description: 'Latest tech industry updates',
    x: 0,
    y: 0,
    w: 6,
    h: 4,
    limit: 12,
    filters: { category: 'Tech' },
    showHeader: true,
  },
  {
    id: 'news-finance-articles',
    type: 'list',
    source: 'news',
    title: 'Financial News',
    description: 'Markets and business updates',
    x: 6,
    y: 0,
    w: 6,
    h: 4,
    limit: 12,
    filters: { category: 'Finance' },
    showHeader: true,
  },
  {
    id: 'social-hackernews',
    type: 'list',
    source: 'social',
    title: 'Hacker News Top Stories',
    description: 'Trending on Hacker News',
    x: 0,
    y: 4,
    w: 4,
    h: 3,
    limit: 10,
    filters: { platform: 'HackerNews' },
    showHeader: true,
  },
  {
    id: 'social-reddit-programming',
    type: 'list',
    source: 'social',
    title: 'r/programming',
    description: 'Hot programming discussions',
    x: 4,
    y: 4,
    w: 4,
    h: 3,
    limit: 10,
    filters: { platform: 'Reddit' },
    showHeader: true,
  },
  {
    id: 'social-github-trending',
    type: 'list',
    source: 'social',
    title: 'GitHub Trending',
    description: 'Popular repositories today',
    x: 8,
    y: 4,
    w: 4,
    h: 3,
    limit: 10,
    filters: { platform: 'GitHub' },
    showHeader: true,
  },
  {
    id: 'news-sentiment-chart',
    type: 'chart',
    source: 'news',
    title: 'News Sentiment',
    description: 'Sentiment analysis of recent articles',
    x: 0,
    y: 7,
    w: 6,
    h: 2,
    chartType: 'pie',
    dataKey: 'sentiment',
    showHeader: true,
  },
  {
    id: 'crypto-top-performers',
    type: 'list',
    source: 'crypto',
    title: 'Top Crypto Performers',
    description: '24h gainers',
    x: 6,
    y: 7,
    w: 6,
    h: 2,
    limit: 8,
    showHeader: true,
  },
];

export const techNewsHubTemplate: DashboardTemplate = {
  id: 'tech-news-hub',
  name: 'Tech News Hub',
  description:
    'Stay updated with technology news, social media trends, and developer community activity',
  category: 'tech',
  widgets: techNewsHubWidgets,
};

// Template 3: E-commerce & Monitoring Dashboard
const ecommerceMonitoringWidgets: WidgetConfig[] = [
  {
    id: 'price-tracked-products',
    type: 'table',
    source: 'price',
    title: 'Price Tracker',
    description: 'Monitored product prices across marketplaces',
    x: 0,
    y: 0,
    w: 8,
    h: 4,
    limit: 10,
    showHeader: true,
  },
  {
    id: 'price-best-deals',
    type: 'list',
    source: 'price',
    title: 'Best Deals',
    description: 'Products with biggest price drops',
    x: 8,
    y: 0,
    w: 4,
    h: 4,
    limit: 8,
    showHeader: true,
  },
  {
    id: 'monitor-api-status',
    type: 'table',
    source: 'monitor',
    title: 'API Health Monitor',
    description: 'Real-time API endpoint status',
    x: 0,
    y: 4,
    w: 8,
    h: 3,
    limit: 8,
    showHeader: true,
  },
  {
    id: 'monitor-uptime-stat',
    type: 'stat',
    source: 'monitor',
    title: 'System Uptime',
    description: '24h average uptime across all endpoints',
    x: 8,
    y: 4,
    w: 4,
    h: 1.5,
    dataKey: 'uptime',
    color: '#10b981',
    showHeader: true,
  },
  {
    id: 'monitor-response-time',
    type: 'stat',
    source: 'monitor',
    title: 'Avg Response Time',
    description: 'Average API response time',
    x: 8,
    y: 5.5,
    w: 4,
    h: 1.5,
    dataKey: 'responseTime',
    color: '#3b82f6',
    showHeader: true,
  },
  {
    id: 'price-marketplace-chart',
    type: 'chart',
    source: 'price',
    title: 'Products by Marketplace',
    description: 'Distribution across e-commerce platforms',
    x: 0,
    y: 7,
    w: 6,
    h: 2,
    chartType: 'pie',
    showHeader: true,
  },
  {
    id: 'monitor-status-chart',
    type: 'chart',
    source: 'monitor',
    title: 'API Status Distribution',
    description: 'Endpoint health overview',
    x: 6,
    y: 7,
    w: 6,
    h: 2,
    chartType: 'pie',
    showHeader: true,
  },
];

export const ecommerceMonitoringTemplate: DashboardTemplate = {
  id: 'ecommerce-monitoring',
  name: 'E-commerce & Monitoring',
  description:
    'Track product prices, monitor API health, and get alerts on deals and system status',
  category: 'ecommerce',
  widgets: ecommerceMonitoringWidgets,
};

/**
 * Get all available templates
 */
export function getAllTemplates(): DashboardTemplate[] {
  return [cryptoOverviewTemplate, techNewsHubTemplate, ecommerceMonitoringTemplate];
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): DashboardTemplate | null {
  const templates = getAllTemplates();
  return templates.find((t) => t.id === id) || null;
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(
  category: DashboardTemplate['category']
): DashboardTemplate[] {
  const templates = getAllTemplates();
  return templates.filter((t) => t.category === category);
}

/**
 * Create dashboard from template
 */
export function createDashboardFromTemplate(
  templateId: string,
  customName?: string
): {
  name: string;
  description: string;
  widgets: WidgetConfig[];
} | null {
  const template = getTemplateById(templateId);

  if (!template) {
    return null;
  }

  return {
    name: customName || template.name,
    description: template.description,
    widgets: JSON.parse(JSON.stringify(template.widgets)), // Deep clone
  };
}
