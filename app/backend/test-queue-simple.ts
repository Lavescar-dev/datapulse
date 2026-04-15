/**
 * Simple test script for BullMQ job queue system
 */

import { scrapeQueue, seoQueue, initializeWorkers, getQueueStats } from './queue';
import type { ScrapeJobData, SEOAnalyzeJobData } from '../shared/types/jobs';

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function testQueue() {
  console.log('🧪 Testing BullMQ Job Queue System (Simple)\n');
  console.log('='.repeat(80) + '\n');

  try {
    // Initialize workers
    console.log('🔧 Initializing BullMQ workers...');
    const workers = await initializeWorkers();
    console.log('✓ Workers initialized\n');
    await delay(1000);

    // Test 1: Add jobs
    console.log('📝 Test 1: Adding jobs...');
    const scrapeData: ScrapeJobData = {
      url: 'https://example.com',
      selector: '.article',
      autoDetect: false,
      sessionId: 'test-session-1',
      isAdmin: false,
    };
    const scrapeJob = await scrapeQueue.add('scrape-url', scrapeData);
    console.log(`✓ Scrape job added: ${scrapeJob.id}\n`);

    const seoData: SEOAnalyzeJobData = {
      url: 'https://example.com',
      sessionId: 'test-session-1',
      isAdmin: false,
    };
    const seoJob = await seoQueue.add('analyze-url', seoData);
    console.log(`✓ SEO job added: ${seoJob.id}\n`);

    // Wait for processing
    console.log('⏳ Waiting for jobs to process...');
    await delay(3000);

    // Check status
    const scrapeStatus = await scrapeJob.getState();
    console.log(`Scrape job status: ${scrapeStatus}`);

    const seoStatus = await seoJob.getState();
    console.log(`SEO job status: ${seoStatus}\n`);

    // Get results
    if (scrapeJob.returnvalue) {
      console.log('Scrape result:', JSON.stringify(scrapeJob.returnvalue, null, 2));
    }
    if (seoJob.returnvalue) {
      console.log('SEO result:', JSON.stringify(seoJob.returnvalue, null, 2));
    }

    // Get queue stats
    console.log('\n📊 Queue statistics:');
    const stats = await getQueueStats();
    console.log('Scrape queue:', stats.scrape);
    console.log('SEO queue:', stats.seo);

    console.log('\n✅ Test completed!\n');

    // Cleanup
    await workers.scrapeWorker.close();
    await workers.seoWorker.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testQueue();
