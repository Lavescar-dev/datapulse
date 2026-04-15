// Performance score calculator
import type { AssetBreakdown, HTTPHeaders, MetaTags, PerformanceScore, SSLCertificate } from '../../../shared/types/jobs';

export function calculatePerformanceScore(
  ssl?: SSLCertificate,
  headers?: HTTPHeaders,
  meta?: MetaTags,
  assetBreakdown?: AssetBreakdown,
): PerformanceScore {
  const { sslScore, sslReason } = calculateSSLScore(ssl);
  const { securityHeadersScore, presentHeaders, missingHeaders } = calculateSecurityHeaderScore(headers);
  const { metaScore, presentMeta, missingMeta } = calculateMetaScore(meta);

  const performanceSignals = calculateObservedPerformanceSignals(meta, headers, assetBreakdown);
  const overall = Math.round(
    sslScore * 0.2 +
    securityHeadersScore * 0.25 +
    metaScore * 0.25 +
    performanceSignals.score * 0.3,
  );

  return {
    overall,
    ssl: sslScore,
    securityHeaders: securityHeadersScore,
    metaCompleteness: metaScore,
    loadTime: meta?.fetchTimeMs,
    breakdown: {
      ssl: {
        score: sslScore,
        reason: sslReason,
      },
      securityHeaders: {
        score: securityHeadersScore,
        present: presentHeaders,
        missing: missingHeaders,
      },
      meta: {
        score: metaScore,
        present: presentMeta,
        missing: missingMeta,
      },
      observed: {
        htmlBytes: meta?.htmlBytes,
        assetRequests: assetBreakdown?.totals.requests,
        renderBlockingRequests: assetBreakdown?.totals.renderBlockingRequests,
        knownAssetBytes: assetBreakdown?.totals.knownBytes,
        sizeCoverageRatio: assetBreakdown?.totals.sizeCoverageRatio,
        fetchTimeMs: meta?.fetchTimeMs,
      },
    },
  };
}

function calculateSSLScore(ssl?: SSLCertificate): { sslScore: number; sslReason: string } {
  if (!ssl) {
    return { sslScore: 0, sslReason: 'No SSL certificate found' };
  }

  if (!ssl.valid) {
    return { sslScore: 0, sslReason: 'Invalid SSL certificate' };
  }

  if (ssl.daysUntilExpiry !== undefined && ssl.daysUntilExpiry < 7) {
    return { sslScore: 40, sslReason: `Certificate expires in ${ssl.daysUntilExpiry} days` };
  }

  if (ssl.daysUntilExpiry !== undefined && ssl.daysUntilExpiry < 30) {
    return { sslScore: 70, sslReason: `Certificate expires in ${ssl.daysUntilExpiry} days` };
  }

  return { sslScore: 100, sslReason: 'Valid SSL certificate' };
}

function calculateSecurityHeaderScore(headers?: HTTPHeaders): {
  securityHeadersScore: number;
  presentHeaders: string[];
  missingHeaders: string[];
} {
  const requiredHeaders: Array<keyof HTTPHeaders['securityHeaders']> = [
    'strictTransportSecurity',
    'contentSecurityPolicy',
    'xFrameOptions',
    'xContentTypeOptions',
    'referrerPolicy',
  ];

  const presentHeaders: string[] = [];
  const missingHeaders: string[] = [];

  for (const header of requiredHeaders) {
    if (headers?.securityHeaders[header]) {
      presentHeaders.push(header);
    } else {
      missingHeaders.push(header);
    }
  }

  return {
    securityHeadersScore: Math.round((presentHeaders.length / requiredHeaders.length) * 100),
    presentHeaders,
    missingHeaders,
  };
}

function calculateMetaScore(meta?: MetaTags): { metaScore: number; presentMeta: string[]; missingMeta: string[] } {
  const requiredMeta: Array<keyof MetaTags> = ['title', 'description', 'ogTitle', 'ogDescription', 'ogImage', 'canonical'];
  const presentMeta: string[] = [];
  const missingMeta: string[] = [];

  for (const field of requiredMeta) {
    if (meta?.[field]) {
      presentMeta.push(field);
    } else {
      missingMeta.push(field);
    }
  }

  return {
    metaScore: Math.round((presentMeta.length / requiredMeta.length) * 100),
    presentMeta,
    missingMeta,
  };
}

function calculateObservedPerformanceSignals(meta?: MetaTags, headers?: HTTPHeaders, assetBreakdown?: AssetBreakdown): { score: number } {
  const parts: number[] = [];

  if (meta?.fetchTimeMs !== undefined) {
    parts.push(meta.fetchTimeMs <= 800 ? 100 : meta.fetchTimeMs <= 1500 ? 75 : meta.fetchTimeMs <= 2500 ? 45 : 20);
  }

  if (meta?.htmlBytes !== undefined) {
    parts.push(meta.htmlBytes <= 75_000 ? 100 : meta.htmlBytes <= 150_000 ? 75 : meta.htmlBytes <= 250_000 ? 45 : 20);
  }

  if (assetBreakdown) {
    parts.push(assetBreakdown.totals.renderBlockingRequests <= 1 ? 100 : assetBreakdown.totals.renderBlockingRequests <= 3 ? 70 : 35);
    parts.push(assetBreakdown.totals.requests <= 20 ? 100 : assetBreakdown.totals.requests <= 40 ? 70 : 40);
  }

  if (headers) {
    parts.push(headers.compression ? 100 : 50);
  }

  if (!parts.length) {
    return { score: 0 };
  }

  return { score: Math.round(parts.reduce((sum, value) => sum + value, 0) / parts.length) };
}
