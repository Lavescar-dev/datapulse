import { priceTrackerService } from './tracker';
import { priceHistoryManager } from '../../cache/price-history';
import { SEED_PRODUCTS, type SeedProduct } from './seed-products';
import { TrendyolScraper } from '../../scrapers/trendyol';
import { HepsiburadaScraper } from '../../scrapers/hepsiburada';
import { N11Scraper } from '../../scrapers/n11';
import { AmazonTRScraper } from '../../scrapers/amazon';
import type { ProductResult } from '../../scrapers/base';

const FALLBACK_SOURCE_NOTE = 'Canli market taramasi gecici olarak kullanilamiyor; urun demo showcase snapshoti ile gosteriliyor.';
const VERIFIED_SHOWCASE_NOTE = 'Urun bilgisi pazaryeri arama sonucundan dogrulanan snapshot ile gosteriliyor; detay sayfa senkronu gecici olarak sinirli olabilir.';
let startupSeedPromise: Promise<SeedResult> | null = null;

const showcaseSearchers = {
  trendyol: new TrendyolScraper(),
  hepsiburada: new HepsiburadaScraper(),
  n11: new N11Scraper(),
  'amazon-tr': new AmazonTRScraper(),
} as const;

interface SeedResult {
  skipped: boolean;
  existingCount: number;
  liveCount: number;
  fallbackCount: number;
  failCount: number;
}

/**
 * Seed the price tracker with demo products
 * This will add products and fetch their initial prices
 */
export async function seedPriceTracker(): Promise<SeedResult> {
  console.log('🌱 Seeding price tracker with demo products...');

  await priceTrackerService.initialize();

  // Check if we already have products
  const existingProducts = await priceHistoryManager.getAllProducts();

  if (existingProducts.length > 0) {
    console.log(`✓ Price tracker already seeded with ${existingProducts.length} products`);
    return {
      skipped: true,
      existingCount: existingProducts.length,
      liveCount: 0,
      fallbackCount: 0,
      failCount: 0,
    };
  }

  let liveCount = 0;
  let fallbackCount = 0;
  let failCount = 0;

  for (const seedProduct of SEED_PRODUCTS) {
    try {
      console.log(`Adding: ${seedProduct.description}...`);

      const resolvedProduct = await resolveShowcaseProduct(seedProduct);
      let product = null;

      if (resolvedProduct) {
        product = await priceHistoryManager.addProduct({
          url: resolvedProduct.url,
          name: resolvedProduct.name,
          trackingQuery: seedProduct.query,
          currentPrice: resolvedProduct.price,
          currency: resolvedProduct.currency,
          available: resolvedProduct.inStock,
          imageUrl: resolvedProduct.imageUrl || '',
          marketplace: seedProduct.marketplace,
          lastChecked: new Date().toISOString(),
          source: 'showcase-fallback',
          sourceNote: VERIFIED_SHOWCASE_NOTE,
        });
      } else {
        product = await priceTrackerService.addProductByUrl(seedProduct.url);
      }

      if (product) {
        if (product.source === 'showcase-fallback') {
          fallbackCount++;
          console.log(`↺ Added verified showcase snapshot: ${product.name}`);
        } else {
          liveCount++;
          console.log(`✓ Added: ${product.name} - ${product.currentPrice} ${product.currency}`);
        }
      } else {
        const fallbackProduct = await priceHistoryManager.addProduct({
          url: seedProduct.url,
          name: seedProduct.description,
          trackingQuery: seedProduct.query,
          currentPrice: seedProduct.showcasePrice,
          currency: 'TRY',
          available: seedProduct.showcaseAvailable ?? true,
          imageUrl: '',
          marketplace: seedProduct.marketplace,
          lastChecked: new Date().toISOString(),
          source: 'showcase-fallback',
          sourceNote: FALLBACK_SOURCE_NOTE,
        });

        fallbackCount++;
        console.log(`↺ Added showcase fallback: ${fallbackProduct.name}`);
      }

      await sleep(1000);
    } catch (error) {
      failCount++;
      console.error(`Error adding ${seedProduct.description}:`, error);
    }
  }

  console.log(`\n✓ Seeding complete: ${liveCount} live, ${fallbackCount} fallback, ${failCount} failed`);

  return {
    skipped: false,
    existingCount: 0,
    liveCount,
    fallbackCount,
    failCount,
  };
}

export function ensurePriceTrackerSeeded(): Promise<SeedResult> {
  if (!startupSeedPromise) {
    startupSeedPromise = seedPriceTracker()
      .catch((error) => {
        console.error('Price tracker startup seeding failed:', error);
        return {
          skipped: false,
          existingCount: 0,
          liveCount: 0,
          fallbackCount: 0,
          failCount: SEED_PRODUCTS.length,
        } satisfies SeedResult;
      })
      .finally(() => {
        startupSeedPromise = null;
      });
  }

  return startupSeedPromise;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Force reseed - removes all products and seeds again
 */
export async function forceReseedPriceTracker(): Promise<void> {
  console.log('🔄 Force reseeding price tracker...');

  await priceTrackerService.initialize();

  const existingProducts = await priceHistoryManager.getAllProducts();

  // Remove all existing products
  for (const product of existingProducts) {
    await priceHistoryManager.removeProduct(product.id);
  }

  console.log(`✓ Removed ${existingProducts.length} existing products`);

  // Now seed
  await seedPriceTracker();
}

async function resolveShowcaseProduct(seedProduct: SeedProduct): Promise<ProductResult | null> {
  const searcher = showcaseSearchers[seedProduct.marketplace];
  const searchQueries = [seedProduct.query, ...(seedProduct.alternateQueries || [])];

  for (const query of searchQueries) {
    try {
      const results = await searcher.search(query);
      const uniqueResults = Array.from(
        new Map(
          results.map((result) => [`${result.url}::${result.name}`, result] as const)
        ).values()
      );

      const firstUsable = uniqueResults
        .filter((result) => {
          const score = scoreProductMatch(seedProduct, result);
          return (
            result.name.trim().length > 0 &&
            Number.isFinite(result.price) &&
            result.price > 0 &&
            score >= 4
          );
        })
        .sort((left, right) => scoreProductMatch(seedProduct, right) - scoreProductMatch(seedProduct, left))[0];

      if (!firstUsable) {
        continue;
      }

      return {
        ...firstUsable,
        url: firstUsable.url || seedProduct.url,
        currency: firstUsable.currency || 'TRY',
      };
    } catch (error) {
      console.warn(`Showcase search resolution failed for ${seedProduct.description} with query "${query}":`, error);
    }
  }

  return null;
}

function scoreProductMatch(seedProduct: SeedProduct, result: ProductResult): number {
  const normalizedQuery = `${seedProduct.query} ${seedProduct.description}`
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9çğıöşü\s"]/gi, ' ');
  const normalizedName = result.name
    .toLocaleLowerCase('tr-TR')
    .replace(/[^a-z0-9çğıöşü\s"]/gi, ' ');

  const queryTokens = normalizedQuery
    .split(/\s+/)
    .filter((token) => token.length >= 2);

  let score = 0;

  for (const token of queryTokens) {
    if (normalizedName.includes(token)) {
      score += token.length >= 5 ? 3 : 1;
    }
  }

  const accessoryTerms = [
    'guide',
    'user guide',
    'manual',
    'beginners',
    'beginner',
    'tips',
    'tricks',
    'concise',
    'paperback',
    'hardcover',
    'book',
    'books',
    'kitap',
    'kilif',
    'kılıf',
    'case',
    'cover',
    'koruyucu',
    'ekran koruyucu',
    'screen',
    'nano',
    'film',
    'cam',
    'kapak',
  ];

  for (const term of accessoryTerms) {
    if (normalizedName.includes(term)) {
      score -= 8;
    }
  }

  if (seedProduct.marketplace === 'amazon-tr' && normalizedName.includes('kobo')) {
    score -= 8;
  }

  return score;
}

// If running directly
if (import.meta.main) {
  seedPriceTracker()
    .then(() => {
      console.log('✓ Seeding script complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding script failed:', error);
      process.exit(1);
    });
}
