import { Hono } from 'hono';
import { authMiddleware, getSessionFromContext, requestCountMiddleware, writeSessionCookie } from '../middleware/auth';
import { addScrapeJob, getJobStatus } from '../queue/index';
import { getExampleById, getExampleSummaries } from '../cache/scraper-examples/index';
import { sessionManager } from '../auth/session';
import type { ScrapeJobData } from '../../shared/types/jobs';

const scraperRoutes = new Hono();

/**
 * POST /api/scraper/submit
 * Submit a new scrape job
 */
scraperRoutes.post('/submit', authMiddleware, requestCountMiddleware, async (c) => {
  try {
    const session = getSessionFromContext(c);
    const body = await c.req.json();
    const { url, selector, autoDetect } = body;

    if (!url) {
      return c.json({ success: false, message: 'URL is required' }, 400);
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (err) {
      return c.json({ success: false, message: 'Invalid URL format' }, 400);
    }

    // Check demo session limits (3 scrapes)
    if (!session.isAdmin) {
      const scrapesRemaining = (session as any).scrapesRemaining || 0;
      if (scrapesRemaining <= 0) {
        return c.json({
          success: false,
          message: 'Scrape limit reached. Demo users have 3 scrapes per session.'
        }, 429);
      }
    }

    // Create job data
    const jobData: ScrapeJobData = {
      url,
      selector,
      autoDetect: autoDetect ?? true,
      sessionId: session.ip || 'unknown',
      isAdmin: session.isAdmin,
    };

    // Queue the job
    const jobId = await addScrapeJob(jobData);

    console.log(`✅ Scrape job queued: ${jobId} for URL: ${url}`);

    return c.json({
      success: true,
      jobId,
      message: 'Scrape job queued successfully',
    });
  } catch (error) {
    console.error('Error submitting scrape job:', error);
    return c.json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to submit scrape job'
    }, 500);
  }
});

/**
 * GET /api/scraper/status/:jobId
 * Get job status and progress
 */
scraperRoutes.get('/status/:jobId', authMiddleware, async (c) => {
  try {
    const jobId = c.req.param('jobId');

    const status = await getJobStatus(jobId, 'scrape');

    if (!status) {
      return c.json({ success: false, message: 'Job not found' }, 404);
    }

    return c.json({
      success: true,
      jobId: status.id,
      status: status.status,
      progress: status.progress || 0,
      error: status.error,
    });
  } catch (error) {
    console.error('Error fetching job status:', error);
    return c.json({
      success: false,
      message: 'Failed to fetch job status'
    }, 500);
  }
});

/**
 * GET /api/scraper/result/:jobId
 * Get completed scrape result
 */
scraperRoutes.get('/result/:jobId', authMiddleware, async (c) => {
  try {
    const jobId = c.req.param('jobId');
    const session = getSessionFromContext(c);

    const status = await getJobStatus(jobId, 'scrape');

    if (!status) {
      return c.json({ success: false, message: 'Job not found' }, 404);
    }

    if (status.status !== 'completed') {
      return c.json({
        success: false,
        message: `Job is ${status.status}. Wait until completed.`
      }, 400);
    }

    if (!status.result) {
      return c.json({ success: false, message: 'No result available' }, 404);
    }

    // Decrement scrapes counter for demo users (only on first successful fetch)
    if (!session.isAdmin) {
      const sessionToken = c.req.header('Cookie')?.split(`${sessionManager.getCookieName()}=`)[1]?.split(';')[0];
      if (sessionToken) {
        const updatedToken = await sessionManager.decrementScrapes(sessionToken);
        if (updatedToken) {
          writeSessionCookie(c, updatedToken);
        }
      }
    }

    return c.json(status.result);
  } catch (error) {
    console.error('Error fetching scrape result:', error);
    return c.json({
      success: false,
      message: 'Failed to fetch scrape result'
    }, 500);
  }
});

/**
 * GET /api/scraper/examples
 * Get showcase example summaries
 */
scraperRoutes.get('/examples', async (c) => {
  try {
    return c.json({
      success: true,
      count: getExampleSummaries().length,
      examples: getExampleSummaries(),
    });
  } catch (error) {
    console.error('Error fetching example summaries:', error);
    return c.json({
      success: false,
      message: 'Failed to fetch examples',
    }, 500);
  }
});

/**
 * GET /api/scraper/examples/:exampleId
 * Get pre-scraped showcase example
 */
scraperRoutes.get('/examples/:exampleId', async (c) => {
  try {
    const exampleId = c.req.param('exampleId');
    const example = getExampleById(exampleId);

    if (!example) {
      return c.json({ success: false, message: 'Example not found' }, 404);
    }

    return c.json({
      success: true,
      ...example,
    });
  } catch (error) {
    console.error('Error fetching example:', error);
    return c.json({
      success: false,
      message: 'Failed to fetch example'
    }, 500);
  }
});

export { scraperRoutes };
