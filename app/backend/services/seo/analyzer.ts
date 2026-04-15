// SEO and domain analyzer - main orchestrator
import type { SEOReport } from '../../../shared/types/jobs';
import { lookupWhois } from './whois';
import { lookupDNS } from './dns';
import { checkSSL } from './ssl';
import { analyzeHeaders } from './headers';
import { extractMetaTags } from './meta';
import { detectTechnology } from './tech';
import { parseRobotsTxt, parseSitemap } from './robots';
import { calculatePerformanceScore } from './performance';
import { buildAuditBundle } from './audit';

export async function analyzeSEO(url: string): Promise<SEOReport> {
  console.log(`Starting SEO analysis for ${url}`);

  // Run all analysis tasks in parallel
  const [whois, dns, ssl, headers, meta, robots, sitemap] = await Promise.all([
    lookupWhois(url),
    lookupDNS(url),
    checkSSL(url),
    analyzeHeaders(url),
    extractMetaTags(url),
    parseRobotsTxt(url),
    parseSitemap(url),
  ]);

  // Run technology detection (needs headers)
  const headersMap = headers
    ? {
        server: headers.server || '',
        'x-powered-by': headers.poweredBy || '',
      }
    : undefined;

  const techStack = await detectTechnology(url, headersMap);

  const auditBundle = buildAuditBundle({
    url,
    ssl,
    headers,
    meta,
    robots,
    sitemap,
  });

  // Calculate performance score from collected signals only
  const performanceScore = calculatePerformanceScore(ssl, headers, meta, auditBundle.assetBreakdown);

  const report: SEOReport = {
    url,
    whois,
    dns,
    ssl,
    headers,
    meta,
    techStack: techStack.length > 0 ? techStack : undefined,
    robots,
    sitemap,
    performanceScore,
    categoryScores: auditBundle.categoryScores,
    recommendations: auditBundle.recommendations,
    findings: auditBundle.findings,
    assetBreakdown: auditBundle.assetBreakdown,
    renderingRisk: auditBundle.renderingRisk,
    serpPreview: auditBundle.serpPreview,
    socialPresence: auditBundle.socialPresence,
    summary: auditBundle.summary,
  };

  console.log(`SEO analysis completed for ${url} in ${meta?.fetchTimeMs ?? 0}ms`);

  return report;
}
