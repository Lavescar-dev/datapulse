// BullMQ queue setup for scraping and SEO analysis jobs
import { Queue, Worker, Job } from 'bullmq';
import redisOptions, { probeRedisConnection } from '../services/redis';
import type {
  JobStatus,
  JobType,
  ScrapeJobData,
  SEOAnalyzeJobData,
  ScrapeJobResult,
  SEOAnalyzeJobResult,
} from '../../shared/types/jobs';

// Queue configuration
const queueConfig = {
  connection: redisOptions,
  defaultJobOptions: {
    attempts: 2,
    backoff: {
      type: 'exponential' as const,
      delay: 1000,
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: {
      count: 50, // Keep last 50 failed jobs
    },
  },
};

let scrapeQueue: Queue<ScrapeJobData> | null = null;
let seoQueue: Queue<SEOAnalyzeJobData> | null = null;

type QueueMode = 'redis' | 'inline';

let queueMode: QueueMode = 'inline';
let workersInitialized = false;

const inlineJobs = new Map<string, JobStatus>();

// Worker configuration with max 2 concurrent jobs and 30-second timeout
const workerConfig = {
  connection: redisOptions,
  concurrency: 2, // Max 2 concurrent jobs
  lockDuration: 30000, // 30 seconds timeout per job
};

// Import job handlers (to be created)
let scrapeHandler: (job: Job<ScrapeJobData>) => Promise<ScrapeJobResult>;
let seoHandler: (job: Job<SEOAnalyzeJobData>) => Promise<SEOAnalyzeJobResult>;

// Dynamically import handlers to avoid circular dependencies
async function loadHandlers() {
  try {
    const scrapeModule = await import('./handlers/scrape');
    scrapeHandler = scrapeModule.processScrapeJob;
  } catch (err) {
    console.warn('⚠️  Scrape handler not found, using placeholder');
    scrapeHandler = async (job) => ({
      success: false,
      error: 'Scrape handler not implemented yet',
      url: job.data.url,
      scrapedAt: Date.now(),
    });
  }

  try {
    const seoModule = await import('./handlers/seo-analyze');
    seoHandler = seoModule.processSEOJob;
  } catch (err) {
    console.warn('⚠️  SEO handler not found, using placeholder');
    seoHandler = async (job) => ({
      success: false,
      error: 'SEO handler not implemented yet',
      url: job.data.url,
      analyzedAt: Date.now(),
    });
  }
}

function ensureQueues() {
  if (!scrapeQueue) {
    scrapeQueue = new Queue<ScrapeJobData>('scrape', queueConfig);
  }

  if (!seoQueue) {
    seoQueue = new Queue<SEOAnalyzeJobData>('seo-analyze', queueConfig);
  }
}

function getQueue(type: JobType) {
  const queue = type === 'scrape' ? scrapeQueue : seoQueue;

  if (!queue) {
    throw new Error(`Redis queue for ${type} is not initialized`);
  }

  return queue;
}

function createInlineJobId(type: JobType, url: string) {
  const urlHash = Buffer.from(url).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
  return `${type}-${urlHash}-${Date.now()}`;
}

function updateInlineJob(jobId: string, updates: Partial<JobStatus>) {
  const existing = inlineJobs.get(jobId);

  if (!existing) {
    return;
  }

  inlineJobs.set(jobId, {
    ...existing,
    ...updates,
  });
}

async function runInlineJob<TData extends ScrapeJobData | SEOAnalyzeJobData, TResult extends ScrapeJobResult | SEOAnalyzeJobResult>(
  type: JobType,
  data: TData,
  handler: (job: Job<TData>) => Promise<TResult>
) {
  const jobId = createInlineJobId(type, data.url);

  inlineJobs.set(jobId, {
    id: jobId,
    type,
    status: 'waiting',
    progress: 0,
    data,
    createdAt: Date.now(),
  });

  queueMicrotask(async () => {
    updateInlineJob(jobId, {
      status: 'active',
      processedAt: Date.now(),
    });

    const inlineJob = {
      id: jobId,
      data,
      updateProgress: async (progress: number | object) => {
        updateInlineJob(jobId, {
          progress: typeof progress === 'number' ? progress : 0,
        });
      },
    } as Job<TData>;

    try {
      const result = await handler(inlineJob);
      updateInlineJob(jobId, {
        status: result.success ? 'completed' : 'failed',
        progress: 100,
        result,
        error: result.success ? undefined : result.error,
        finishedAt: Date.now(),
      });
    } catch (error) {
      updateInlineJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown queue error',
        finishedAt: Date.now(),
      });
    }
  });

  return jobId;
}

// Initialize workers
export async function initializeWorkers() {
  if (workersInitialized) {
    return { mode: queueMode };
  }

  await loadHandlers();

  const redisAvailable = await probeRedisConnection();

  if (!redisAvailable) {
    queueMode = 'inline';
    workersInitialized = true;
    console.log('✅ Queue fallback initialized in inline mode');
    return { mode: queueMode };
  }

  queueMode = 'redis';
  ensureQueues();

  // Scrape worker
  const scrapeWorker = new Worker<ScrapeJobData, ScrapeJobResult>(
    'scrape',
    async (job) => {
      console.log(`🔄 Processing scrape job ${job.id} for URL: ${job.data.url}`);
      return scrapeHandler(job);
    },
    workerConfig
  );

  scrapeWorker.on('completed', (job, result) => {
    console.log(
      `✅ Scrape job ${job.id} completed for ${job.data.url} - ${result.itemCount || 0} items`
    );
  });

  scrapeWorker.on('failed', (job, err) => {
    console.error(`❌ Scrape job ${job?.id} failed:`, err.message);
  });

  // SEO analyze worker
  const seoWorker = new Worker<SEOAnalyzeJobData, SEOAnalyzeJobResult>(
    'seo-analyze',
    async (job) => {
      console.log(`🔄 Processing SEO job ${job.id} for URL: ${job.data.url}`);
      return seoHandler(job);
    },
    workerConfig
  );

  seoWorker.on('completed', (job, result) => {
    console.log(`✅ SEO job ${job.id} completed for ${job.data.url}`);
  });

  seoWorker.on('failed', (job, err) => {
    console.error(`❌ SEO job ${job?.id} failed:`, err.message);
  });

  console.log('✅ BullMQ workers initialized (max 2 concurrent jobs, 30s timeout)');

  workersInitialized = true;

  return { mode: queueMode, scrapeWorker, seoWorker };
}

// Helper function to add a scrape job
export async function addScrapeJob(data: ScrapeJobData) {
  if (queueMode === 'inline') {
    return runInlineJob('scrape', data, scrapeHandler);
  }

  try {
    const job = await getQueue('scrape').add('scrape-url', data, {
      jobId: createInlineJobId('scrape', data.url),
    });
    return job.id;
  } catch (error) {
    console.warn('⚠️ Redis queue add failed, using inline scraper execution');
    queueMode = 'inline';
    return runInlineJob('scrape', data, scrapeHandler);
  }
}

// Helper function to add an SEO analysis job
export async function addSEOJob(data: SEOAnalyzeJobData) {
  if (queueMode === 'inline') {
    return runInlineJob('seo-analyze', data, seoHandler);
  }

  try {
    const job = await getQueue('seo-analyze').add('analyze-url', data, {
      jobId: createInlineJobId('seo-analyze', data.url),
    });
    return job.id;
  } catch (error) {
    console.warn('⚠️ Redis queue add failed, using inline SEO execution');
    queueMode = 'inline';
    return runInlineJob('seo-analyze', data, seoHandler);
  }
}

// Helper function to get job status
export async function getJobStatus(jobId: string, type: JobType) {
  if (queueMode === 'inline') {
    const job = inlineJobs.get(jobId);
    return job?.type === type ? job : null;
  }

  const queue = getQueue(type);
  const job = await queue.getJob(jobId);

  if (!job) {
    return null;
  }

  const state = await job.getState();
  const progress = job.progress;

  return {
    id: job.id!,
    type,
    status: state,
    progress,
    data: job.data,
    result: job.returnvalue,
    error: job.failedReason,
    createdAt: job.timestamp,
    processedAt: job.processedOn,
    finishedAt: job.finishedOn,
  };
}

// Queue dashboard data for admin
export async function getQueueStats() {
  if (queueMode === 'inline') {
    const jobs = Array.from(inlineJobs.values());
    const summarize = (type: JobType) => {
      const typedJobs = jobs.filter((job) => job.type === type);

      return {
        waiting: typedJobs.filter((job) => job.status === 'waiting').length,
        active: typedJobs.filter((job) => job.status === 'active').length,
        completed: typedJobs.filter((job) => job.status === 'completed').length,
        failed: typedJobs.filter((job) => job.status === 'failed').length,
      };
    };

    return {
      scrape: summarize('scrape'),
      seo: summarize('seo-analyze'),
    };
  }

  const [scrapeWaiting, scrapeActive, scrapeCompleted, scrapeFailed] = await Promise.all([
    getQueue('scrape').getWaitingCount(),
    getQueue('scrape').getActiveCount(),
    getQueue('scrape').getCompletedCount(),
    getQueue('scrape').getFailedCount(),
  ]);

  const [seoWaiting, seoActive, seoCompleted, seoFailed] = await Promise.all([
    getQueue('seo-analyze').getWaitingCount(),
    getQueue('seo-analyze').getActiveCount(),
    getQueue('seo-analyze').getCompletedCount(),
    getQueue('seo-analyze').getFailedCount(),
  ]);

  return {
    scrape: {
      waiting: scrapeWaiting,
      active: scrapeActive,
      completed: scrapeCompleted,
      failed: scrapeFailed,
    },
    seo: {
      waiting: seoWaiting,
      active: seoActive,
      completed: seoCompleted,
      failed: seoFailed,
    },
  };
}

// Get recent jobs for admin dashboard
export async function getRecentJobs(type: JobType, limit = 10) {
  if (queueMode === 'inline') {
    return Array.from(inlineJobs.values())
      .filter((job) => job.type === type)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  const queue = getQueue(type);
  const completed = await queue.getCompleted(0, limit - 1);
  const failed = await queue.getFailed(0, limit - 1);
  const active = await queue.getActive(0, limit - 1);
  const waiting = await queue.getWaiting(0, limit - 1);

  const allJobs = [...completed, ...failed, ...active, ...waiting];
  allJobs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  return allJobs.slice(0, limit).map((job) => ({
    id: job.id!,
    type,
    status: job.finishedOn ? (job.failedReason ? 'failed' : 'completed') : job.processedOn ? 'active' : 'waiting',
    data: job.data,
    result: job.returnvalue,
    error: job.failedReason,
    createdAt: job.timestamp,
    processedAt: job.processedOn,
    finishedAt: job.finishedOn,
  }));
}

// Clean up old jobs
export async function cleanOldJobs() {
  if (queueMode === 'inline') {
    const oneHourAgo = Date.now() - 3600000;

    for (const [jobId, job] of inlineJobs.entries()) {
      if (job.createdAt < oneHourAgo && job.status !== 'active') {
        inlineJobs.delete(jobId);
      }
    }

    console.log('🧹 Inline jobs cleaned');
    return;
  }

  await getQueue('scrape').clean(3600000, 100); // Clean jobs older than 1 hour, keep 100
  await getQueue('seo-analyze').clean(3600000, 100);
  console.log('🧹 Old jobs cleaned');
}
