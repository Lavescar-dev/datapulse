import { Hono } from 'hono';
import { authMiddleware, getSessionFromContext, requestCountMiddleware, writeSessionCookie } from '../middleware/auth';
import { addSEOJob, getJobStatus } from '../queue/index';
import { sessionManager } from '../auth/session';
import type { SEOAnalyzeJobData } from '../../shared/types/jobs';

const seoRoutes = new Hono();

/**
 * POST /api/seo/analyze
 * Submit a new SEO analysis job
 */
seoRoutes.post('/analyze', authMiddleware, requestCountMiddleware, async (c) => {
  try {
    const session = getSessionFromContext(c);
    const body = await c.req.json();
    const { url } = body;

    if (!url) {
      return c.json({ success: false, message: 'URL is required' }, 400);
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (err) {
      return c.json({ success: false, message: 'Invalid URL format' }, 400);
    }

    // Check demo session limits (3 analyses)
    if (!session.isAdmin) {
      const analysesRemaining = (session as any).seoAnalysesRemaining || 0;
      if (analysesRemaining <= 0) {
        return c.json({
          success: false,
          message: 'SEO analysis limit reached. Demo users have 3 analyses per session.'
        }, 429);
      }
    }

    // Create job data
    const jobData: SEOAnalyzeJobData = {
      url,
      sessionId: session.ip || 'unknown',
      isAdmin: session.isAdmin,
    };

    // Queue the job
    const jobId = await addSEOJob(jobData);

    console.log(`✅ SEO analysis job queued: ${jobId} for URL: ${url}`);

    return c.json({
      success: true,
      jobId,
      message: 'SEO analysis job queued successfully',
    });
  } catch (error) {
    console.error('Error submitting SEO analysis job:', error);
    return c.json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to submit SEO analysis job'
    }, 500);
  }
});

/**
 * GET /api/seo/status/:jobId
 * Get job status and progress
 */
seoRoutes.get('/status/:jobId', authMiddleware, async (c) => {
  try {
    const jobId = c.req.param('jobId');

    const status = await getJobStatus(jobId, 'seo-analyze');

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
 * GET /api/seo/result/:jobId
 * Get completed SEO analysis result
 */
seoRoutes.get('/result/:jobId', authMiddleware, async (c) => {
  try {
    const jobId = c.req.param('jobId');
    const session = getSessionFromContext(c);

    const status = await getJobStatus(jobId, 'seo-analyze');

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

    // Decrement SEO analyses counter for demo users (only on first successful fetch)
    if (!session.isAdmin) {
      const sessionToken = c.req.header('Cookie')?.split(`${sessionManager.getCookieName()}=`)[1]?.split(';')[0];
      if (sessionToken) {
        const updatedToken = await sessionManager.decrementSEOAnalyses(sessionToken);
        if (updatedToken) {
          writeSessionCookie(c, updatedToken);
        }
      }
    }

    return c.json(status.result);
  } catch (error) {
    console.error('Error fetching SEO analysis result:', error);
    return c.json({
      success: false,
      message: 'Failed to fetch SEO analysis result'
    }, 500);
  }
});

export { seoRoutes };
