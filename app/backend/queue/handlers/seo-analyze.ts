// SEO analysis job handler
import type { Job } from 'bullmq';
import type { SEOAnalyzeJobData, SEOAnalyzeJobResult } from '../../../shared/types/jobs';
import { analyzeSEO } from '../../services/seo/analyzer';

export async function processSEOJob(job: Job<SEOAnalyzeJobData>): Promise<SEOAnalyzeJobResult> {
  const { url } = job.data;

  try {
    console.log(`🔍 Starting SEO analysis for ${url}`);

    // Update progress
    await job.updateProgress(10);

    // Run comprehensive SEO analysis
    const report = await analyzeSEO(url);

    // Update progress
    await job.updateProgress(90);

    console.log(`✅ SEO analysis completed for ${url}`);

    return {
      success: true,
      report,
      url,
      analyzedAt: Date.now(),
    };
  } catch (error) {
    console.error(`❌ Error analyzing ${url}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      url,
      analyzedAt: Date.now(),
    };
  }
}
