/**
 * Scraper configuration and environment variables
 */

export const SCRAPER_CONFIG = {
  // Request timeout in milliseconds
  SCRAPER_TIMEOUT: parseInt(process.env.SCRAPER_TIMEOUT || '30000'),

  // Maximum retry attempts for failed requests
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES || '3'),

  // Delay between requests in milliseconds (rate limiting)
  RATE_LIMIT_DELAY: parseInt(process.env.RATE_LIMIT_DELAY || '2000'),

  // Cache TTL in seconds
  CACHE_TTL: parseInt(process.env.CACHE_TTL || '900'), // 15 minutes

  // Maximum concurrent scrapers
  MAX_CONCURRENT_SCRAPERS: parseInt(process.env.MAX_CONCURRENT_SCRAPERS || '4'),

  // Maximum products per scraper
  MAX_PRODUCTS_PER_SOURCE: parseInt(
    process.env.MAX_PRODUCTS_PER_SOURCE || '20'
  ),

  // User agents for rotation
  USER_AGENTS: [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  ],

  // Puppeteer launch options
  PUPPETEER_OPTIONS: {
    headless: process.env.PUPPETEER_HEADLESS !== 'false',
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
    ],
  },

  // Redis configuration
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379'),

  // Database configuration
  DB_PATH: process.env.DB_PATH || './db/ecommerce.db',

  // Enabled scrapers (comma-separated)
  ENABLED_SCRAPERS:
    process.env.ENABLED_SCRAPERS?.split(',') || [
      'hepsiburada',
      'trendyol',
      'n11',
      'amazon',
    ],
} as const;

/**
 * Validate configuration
 */
export function validateConfig(): void {
  const errors: string[] = [];

  if (SCRAPER_CONFIG.SCRAPER_TIMEOUT < 5000) {
    errors.push('SCRAPER_TIMEOUT must be at least 5000ms');
  }

  if (SCRAPER_CONFIG.MAX_RETRIES < 1 || SCRAPER_CONFIG.MAX_RETRIES > 10) {
    errors.push('MAX_RETRIES must be between 1 and 10');
  }

  if (
    SCRAPER_CONFIG.RATE_LIMIT_DELAY < 1000 ||
    SCRAPER_CONFIG.RATE_LIMIT_DELAY > 10000
  ) {
    errors.push('RATE_LIMIT_DELAY must be between 1000ms and 10000ms');
  }

  if (SCRAPER_CONFIG.CACHE_TTL < 60) {
    errors.push('CACHE_TTL must be at least 60 seconds');
  }

  if (
    SCRAPER_CONFIG.MAX_CONCURRENT_SCRAPERS < 1 ||
    SCRAPER_CONFIG.MAX_CONCURRENT_SCRAPERS > 10
  ) {
    errors.push('MAX_CONCURRENT_SCRAPERS must be between 1 and 10');
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid scraper configuration:\n${errors.map((e) => `  - ${e}`).join('\n')}`
    );
  }
}

// Validate on module load
validateConfig();

console.log('✓ Scraper configuration loaded:', {
  timeout: `${SCRAPER_CONFIG.SCRAPER_TIMEOUT}ms`,
  retries: SCRAPER_CONFIG.MAX_RETRIES,
  rateLimit: `${SCRAPER_CONFIG.RATE_LIMIT_DELAY}ms`,
  cacheTTL: `${SCRAPER_CONFIG.CACHE_TTL}s`,
  maxConcurrent: SCRAPER_CONFIG.MAX_CONCURRENT_SCRAPERS,
  enabledScrapers: SCRAPER_CONFIG.ENABLED_SCRAPERS,
});
