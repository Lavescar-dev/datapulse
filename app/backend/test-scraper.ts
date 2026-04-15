// Test script for web scraper engine
import { scrapeWithPuppeteer } from './services/scraper/engine';
import { fetchAndScrape } from './services/scraper/static';
import { urlCache } from './services/scraper/cache';

async function testScraperEngine() {
  console.log('🧪 Testing Web Scraper Engine\n');
  console.log('='.repeat(50));

  // Test 1: Scrape a simple website with Puppeteer
  console.log('\n📝 Test 1: Scraping example.com with Puppeteer...');
  try {
    const result1 = await scrapeWithPuppeteer({
      url: 'https://example.com',
      autoDetect: true,
      timeout: 15000,
    });

    if (result1.success) {
      console.log('✅ Puppeteer scrape successful!');
      console.log(`   Pattern: ${result1.pattern}`);
      console.log(`   Items: ${result1.data?.length || 0}`);
      console.log(`   Sample data:`, result1.data?.[0]);
    } else {
      console.log('❌ Puppeteer scrape failed:', result1.error);
    }
  } catch (error) {
    console.log('❌ Test 1 error:', error);
  }

  // Test 2: Scrape with Cheerio fallback
  console.log('\n📝 Test 2: Scraping example.com with Cheerio...');
  try {
    const result2 = await fetchAndScrape('https://example.com', {
      autoDetect: true,
    });

    if (result2.success) {
      console.log('✅ Cheerio scrape successful!');
      console.log(`   Pattern: ${result2.pattern}`);
      console.log(`   Items: ${result2.data?.length || 0}`);
      console.log(`   Sample data:`, result2.data?.[0]);
    } else {
      console.log('❌ Cheerio scrape failed:', result2.error);
    }
  } catch (error) {
    console.log('❌ Test 2 error:', error);
  }

  // Test 3: URL deduplication cache
  console.log('\n📝 Test 3: Testing URL deduplication cache...');
  const testUrl = 'https://example.com';

  console.log('   Adding URL to cache...');
  urlCache.add(testUrl);

  if (urlCache.isInCooldown(testUrl)) {
    const remaining = urlCache.getRemainingCooldown(testUrl);
    console.log(`✅ URL is in cooldown (${remaining}s remaining)`);
  } else {
    console.log('❌ URL should be in cooldown but isn\'t');
  }

  console.log('   Cache stats:', urlCache.getStats());

  // Test 4: Custom selector
  console.log('\n📝 Test 4: Testing custom CSS selector...');
  try {
    const result4 = await scrapeWithPuppeteer({
      url: 'https://example.com',
      selector: 'h1, p',
      timeout: 15000,
    });

    if (result4.success) {
      console.log('✅ Custom selector scrape successful!');
      console.log(`   Items found: ${result4.data?.length || 0}`);
      console.log(`   Sample:`, result4.data?.[0]);
    } else {
      console.log('❌ Custom selector scrape failed:', result4.error);
    }
  } catch (error) {
    console.log('❌ Test 4 error:', error);
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ Scraper engine tests completed!');
  console.log('\n💡 Note: For full testing, try scraping various websites:');
  console.log('   - E-commerce sites (products)');
  console.log('   - News sites (articles)');
  console.log('   - Wikipedia (content)');
  console.log('   - GitHub (repositories)');

  process.exit(0);
}

// Run tests
testScraperEngine().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
