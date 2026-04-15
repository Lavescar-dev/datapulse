/**
 * Test script for BullMQ job queue system
 */

import {
  initializeWorkers,
  addScrapeJob,
  addSEOJob,
  getJobStatus,
  getQueueStats,
  getRecentJobs,
} from './queue';
import type { ScrapeJobData, SEOAnalyzeJobData } from '../shared/types/jobs';

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function testQueue() {
  console.log('🧪 Testing BullMQ Job Queue System\n');
  console.log('='.repeat(80) + '\n');

  try {
    // Initialize workers
    console.log('🔧 Initializing BullMQ workers...');
    const workers = await initializeWorkers();
    console.log('✓ Workers initialized\n');
    await delay(1000);

    // Test 1: Add a scrape job
    console.log('📝 Test 1: Adding scrape job...');
    const scrapeData: ScrapeJobData = {
      url: 'https://example.com',
      selector: '.article',
      autoDetect: false,
      sessionId: 'test-session-1',
      isAdmin: false,
    };
    const scrapeJobId = await addScrapeJob(scrapeData);
    console.log(`✓ Scrape job added: ${scrapeJobId}\n`);

    // Test 2: Add an SEO job
    console.log('📝 Test 2: Adding SEO analysis job...');
    const seoData: SEOAnalyzeJobData = {
      url: 'https://example.com',
      sessionId: 'test-session-1',
      isAdmin: false,
    };
    const seoJobId = await addSEOJob(seoData);
    console.log(`✓ SEO job added: ${seoJobId}\n`);

    // Test 3: Poll job status
    console.log('📊 Test 3: Polling job status...');
    await delay(2000); // Wait for processing

    const scrapeStatus = await getJobStatus(scrapeJobId!, 'scrape');
    console.log('Scrape Job Status:');
    console.log('-'.repeat(80));
    console.log(`  Job ID: ${scrapeStatus?.id}`);
    console.log(`  Status: ${scrapeStatus?.status}`);
    console.log(`  URL: ${scrapeStatus?.data.url}`);
    if (scrapeStatus?.result) {
      console.log(`  Success: ${scrapeStatus.result.success}`);
      console.log(`  Items: ${scrapeStatus.result.itemCount || 0}`);
    }
    console.log('');

    const seoStatus = await getJobStatus(seoJobId!, 'seo-analyze');
    console.log('SEO Job Status:');
    console.log('-'.repeat(80));
    console.log(`  Job ID: ${seoStatus?.id}`);
    console.log(`  Status: ${seoStatus?.status}`);
    console.log(`  URL: ${seoStatus?.data.url}`);
    if (seoStatus?.result) {
      console.log(`  Success: ${seoStatus.result.success}`);
      if (seoStatus.result.report) {
        console.log(`  Performance Score: ${seoStatus.result.report.performanceScore?.overall}/100`);
      }
    }
    console.log('');

    // Test 4: Get queue stats
    console.log('📊 Test 4: Queue statistics...');
    const stats = await getQueueStats();
    console.log('Queue Stats:');
    console.log('-'.repeat(80));
    console.log('Scrape Queue:');
    console.log(`  Waiting: ${stats.scrape.waiting}`);
    console.log(`  Active: ${stats.scrape.active}`);
    console.log(`  Completed: ${stats.scrape.completed}`);
    console.log(`  Failed: ${stats.scrape.failed}`);
    console.log('SEO Queue:');
    console.log(`  Waiting: ${stats.seo.waiting}`);
    console.log(`  Active: ${stats.seo.active}`);
    console.log(`  Completed: ${stats.seo.completed}`);
    console.log(`  Failed: ${stats.seo.failed}`);
    console.log('');

    // Test 5: Get recent jobs
    console.log('📊 Test 5: Recent jobs...');
    const recentScrapeJobs = await getRecentJobs('scrape', 5);
    console.log(`Recent Scrape Jobs (${recentScrapeJobs.length}):`);
    console.log('-'.repeat(80));
    recentScrapeJobs.forEach((job, i) => {
      console.log(`  ${i + 1}. Job ${job.id} - ${job.status} - ${job.data.url}`);
    });
    console.log('');

    const recentSeoJobs = await getRecentJobs('seo-analyze', 5);
    console.log(`Recent SEO Jobs (${recentSeoJobs.length}):`);
    console.log('-'.repeat(80));
    recentSeoJobs.forEach((job, i) => {
      console.log(`  ${i + 1}. Job ${job.id} - ${job.status} - ${job.data.url}`);
    });
    console.log('');

    // Test 6: Test concurrency (add multiple jobs)
    console.log('📝 Test 6: Testing concurrency (2 jobs max)...');
    const job1 = await addScrapeJob({
      url: 'https://example1.com',
      sessionId: 'test-session-2',
      isAdmin: false,
    });
    const job2 = await addScrapeJob({
      url: 'https://example2.com',
      sessionId: 'test-session-2',
      isAdmin: false,
    });
    const job3 = await addScrapeJob({
      url: 'https://example3.com',
      sessionId: 'test-session-2',
      isAdmin: false,
    });
    console.log(`✓ Added 3 jobs: ${job1}, ${job2}, ${job3}`);
    console.log('  (Max 2 should process concurrently)\n');

    await delay(2000);
    const concurrencyStats = await getQueueStats();
    console.log('Concurrency Check:');
    console.log('-'.repeat(80));
    console.log(`  Active jobs: ${concurrencyStats.scrape.active} (should be ≤ 2)`);
    console.log(`  Waiting jobs: ${concurrencyStats.scrape.waiting}`);
    console.log('');

    console.log('✅ All queue tests completed!\n');
    console.log('💡 Note: Job handlers are placeholders. Implement actual scraping logic in next task.\n');

    // Cleanup
    await delay(1000);
    workers.scrapeWorker.close();
    workers.seoWorker.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testQueue();
