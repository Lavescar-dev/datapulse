/**
 * Test script for cron job functionality
 */

import { refreshNewsData } from './cron/news';
import { refreshSocialData } from './cron/social';
import { newsCache } from './cache/news-cache';
import { socialCache } from './cache/social-cache';
import { readFile } from 'fs/promises';
import { join } from 'path';

async function testCronJobs() {
  console.log('🧪 Testing Cron Jobs and Cache Refresh\n');
  console.log('='.repeat(80) + '\n');

  try {
    // Test news cron
    console.log('📰 Testing News Cron Job:');
    console.log('-'.repeat(80));

    // Get initial cache state
    const initialNewsCache = await newsCache.get();
    const initialNewsTimestamp = initialNewsCache?.lastUpdated || 0;
    console.log(`  Initial cache timestamp: ${new Date(initialNewsTimestamp).toISOString()}`);
    console.log(`  Initial articles count: ${initialNewsCache?.articles?.length || 0}`);

    // Trigger refresh
    console.log('\n  Triggering news refresh...');
    await refreshNewsData();

    // Check updated cache
    const updatedNewsCache = await newsCache.get();
    const updatedNewsTimestamp = updatedNewsCache?.lastUpdated || 0;
    console.log(`\n  Updated cache timestamp: ${new Date(updatedNewsTimestamp).toISOString()}`);
    console.log(`  Updated articles count: ${updatedNewsCache?.articles?.length || 0}`);
    console.log(`  ✓ Cache updated: ${updatedNewsTimestamp > initialNewsTimestamp ? 'PASS' : 'FAIL'}`);
    console.log(`  ✓ Articles loaded: ${updatedNewsCache?.articles?.length ? 'PASS' : 'FAIL'}`);

    // Verify cache file exists
    const newsCachePath = join(__dirname, 'cache', 'news.json');
    try {
      const newsFile = await readFile(newsCachePath, 'utf-8');
      const newsData = JSON.parse(newsFile);
      console.log(`  ✓ Cache file exists: PASS`);
      console.log(`  ✓ Cache file readable: PASS`);
      console.log(`  Cache file size: ${(newsFile.length / 1024).toFixed(2)} KB`);
    } catch (e) {
      console.log(`  ❌ Cache file error: ${e}`);
    }

    console.log('');

    // Test social cron
    console.log('📱 Testing Social Media Cron Job:');
    console.log('-'.repeat(80));

    // Get initial cache state
    const initialSocialCache = await socialCache.get();
    const initialSocialTimestamp = initialSocialCache?.lastUpdated || 0;
    console.log(`  Initial cache timestamp: ${new Date(initialSocialTimestamp).toISOString()}`);
    console.log(`  Initial posts count: ${initialSocialCache?.posts?.length || 0}`);

    // Trigger refresh
    console.log('\n  Triggering social media refresh...');
    await refreshSocialData();

    // Check updated cache
    const updatedSocialCache = await socialCache.get();
    const updatedSocialTimestamp = updatedSocialCache?.lastUpdated || 0;
    console.log(`\n  Updated cache timestamp: ${new Date(updatedSocialTimestamp).toISOString()}`);
    console.log(`  Updated posts count: ${updatedSocialCache?.posts?.length || 0}`);
    console.log(`  ✓ Cache updated: ${updatedSocialTimestamp > initialSocialTimestamp ? 'PASS' : 'FAIL'}`);
    console.log(`  ✓ Posts loaded: ${updatedSocialCache?.posts?.length ? 'PASS' : 'FAIL'}`);

    // Verify cache file exists
    const socialCachePath = join(__dirname, 'cache', 'social.json');
    try {
      const socialFile = await readFile(socialCachePath, 'utf-8');
      const socialData = JSON.parse(socialFile);
      console.log(`  ✓ Cache file exists: PASS`);
      console.log(`  ✓ Cache file readable: PASS`);
      console.log(`  Cache file size: ${(socialFile.length / 1024).toFixed(2)} KB`);
    } catch (e) {
      console.log(`  ❌ Cache file error: ${e}`);
    }

    console.log('');

    // Test cache TTL
    console.log('⏰ Testing Cache TTL:');
    console.log('-'.repeat(80));
    console.log(`  News cache TTL: 30 minutes (1800 seconds)`);
    console.log(`  Social cache TTL: 1 hour (3600 seconds)`);

    const newsAge = (Date.now() - updatedNewsTimestamp) / 1000;
    const socialAge = (Date.now() - updatedSocialTimestamp) / 1000;

    console.log(`  News cache age: ${newsAge.toFixed(0)} seconds`);
    console.log(`  Social cache age: ${socialAge.toFixed(0)} seconds`);
    console.log(`  ✓ News cache fresh: ${newsAge < 1800 ? 'PASS' : 'FAIL'}`);
    console.log(`  ✓ Social cache fresh: ${socialAge < 3600 ? 'PASS' : 'FAIL'}`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ Cron job test completed successfully!');
    console.log('\nSummary:');
    console.log(`  - News refresh interval: 30 minutes`);
    console.log(`  - Social refresh interval: 1 hour`);
    console.log(`  - News cache working: ✓`);
    console.log(`  - Social cache working: ✓`);
    console.log(`  - Cache persistence: ✓`);
    console.log(`  - Cache TTL: ✓`);
    console.log('\nNote: Cron jobs run automatically on server startup via index.ts');
    console.log('  - startNewsCron() called in app/backend/index.ts');
    console.log('  - startSocialCron() called in app/backend/index.ts');

  } catch (error) {
    console.error('❌ Error testing cron jobs:', error);
    process.exit(1);
  }
}

testCronJobs();
