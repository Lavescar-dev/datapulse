/**
 * Scraper Registry
 * Initializes and registers all e-commerce scrapers
 */

import { scraperManager } from './manager';
import { HepsiburadaScraper } from './hepsiburada';
import { TrendyolScraper } from './trendyol';
import { N11Scraper } from './n11';
import { AmazonTRScraper } from './amazon';
import { SCRAPER_CONFIG } from '../config/scrapers';
import { closeSharedBrowser } from './browser';

// Initialize scraper instances
const hepsiburada = new HepsiburadaScraper();
const trendyol = new TrendyolScraper();
const n11 = new N11Scraper();
const amazon = new AmazonTRScraper();

// Map of all available scrapers
const availableScrapers = {
  hepsiburada,
  trendyol,
  n11,
  amazon,
};

/**
 * Initialize and register enabled scrapers
 */
export function initializeScrapers(): void {
  console.log('\n🔧 Initializing scrapers...');

  const enabledScrapers = SCRAPER_CONFIG.ENABLED_SCRAPERS;

  for (const scraperName of enabledScrapers) {
    const scraper = availableScrapers[scraperName as keyof typeof availableScrapers];

    if (scraper) {
      scraperManager.register(scraper);
    } else {
      console.warn(`⚠️  Unknown scraper: ${scraperName}`);
    }
  }

  console.log(`✓ Initialized ${scraperManager.getSources().length} scrapers\n`);
}

/**
 * Cleanup all scrapers (close browser instances, etc.)
 */
export async function cleanupScrapers(): Promise<void> {
  console.log('\n🧹 Cleaning up scrapers...');

  // Close Amazon browser if initialized
  if (SCRAPER_CONFIG.ENABLED_SCRAPERS.includes('amazon')) {
    await amazon.close();
  }

  await closeSharedBrowser();

  console.log('✓ Scrapers cleaned up\n');
}

// Export scraper manager and instances
export { scraperManager, hepsiburada, trendyol, n11, amazon };

// Export types
export type { ProductResult, ScraperResult, IScraper } from './base';
