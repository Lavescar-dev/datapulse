import type {
  AssetBreakdown,
  AssetCategoryBreakdown,
  AuditPriority,
  AuditSeverity,
  HTTPHeaders,
  MetaTags,
  PageAsset,
  PerformanceScore,
  RenderingRisk,
  RobotsData,
  SEOAuditSummary,
  SEOCategory,
  SEOCategoryScore,
  SEOFinding,
  SEORecommendation,
  SERPPreview,
  SitemapData,
  SocialPresence,
  SSLCertificate,
} from '../../../shared/types/jobs';

interface AuditInput {
  url: string;
  ssl?: SSLCertificate;
  headers?: HTTPHeaders;
  meta?: MetaTags;
  robots?: RobotsData;
  sitemap?: SitemapData;
  performanceScore?: PerformanceScore;
}

interface Signal {
  available: boolean;
  passed: boolean;
  points: number;
  reason: string;
}

const CATEGORY_ORDER: SEOCategory[] = ['on-page', 'technical', 'performance', 'usability', 'social', 'links'];

export interface AuditBundle {
  assetBreakdown?: AssetBreakdown;
  renderingRisk?: RenderingRisk;
  serpPreview?: SERPPreview;
  socialPresence?: SocialPresence;
  findings: SEOFinding[];
  recommendations: SEORecommendation[];
  categoryScores: Partial<Record<SEOCategory, SEOCategoryScore>>;
  summary?: SEOAuditSummary;
}

export function buildAuditBundle(input: AuditInput): AuditBundle {
  const assetBreakdown = buildAssetBreakdown(input.meta?.assets, input.meta?.htmlBytes, Boolean(input.headers?.compression));
  const renderingRisk = buildRenderingRisk(input.meta, assetBreakdown);
  const serpPreview = buildSerpPreview(input.meta);
  const socialPresence = buildSocialPresence(input.meta);
  const findings: SEOFinding[] = [];
  const recommendations: SEORecommendation[] = [];

  addMetaAudit(findings, recommendations, input.meta, serpPreview);
  addTechnicalAudit(findings, recommendations, input.ssl, input.headers, input.meta, input.robots, input.sitemap);
  addPerformanceAudit(findings, recommendations, input.meta, assetBreakdown, renderingRisk);
  addSocialAudit(findings, recommendations, socialPresence, input.meta);
  addLinkAudit(findings, recommendations, input.meta, input.robots, input.sitemap);

  const categoryScores = buildCategoryScores(input, assetBreakdown, socialPresence, renderingRisk);
  const summary = buildSummary(categoryScores, recommendations.length);

  return {
    assetBreakdown,
    renderingRisk,
    serpPreview,
    socialPresence,
    findings: sortFindings(findings),
    recommendations: sortRecommendations(recommendations),
    categoryScores,
    summary,
  };
}

function buildAssetBreakdown(assets?: PageAsset[], htmlBytes?: number, compressed = false): AssetBreakdown | undefined {
  if (!assets?.length && !htmlBytes) {
    return undefined;
  }

  const categories: AssetBreakdown['resources'] = {
    scripts: emptyAssetCategory(),
    stylesheets: emptyAssetCategory(),
    images: emptyAssetCategory(),
    fonts: emptyAssetCategory(),
    other: emptyAssetCategory(),
  };

  let renderBlockingRequests = 0;

  for (const asset of assets ?? []) {
    const bucket = categories[toBucket(asset.type)];
    bucket.count += 1;
    if (asset.inline) {
      bucket.inlineCount += 1;
    } else {
      bucket.externalCount += 1;
    }
    if (asset.sizeKnown && asset.sizeBytes !== undefined) {
      bucket.knownBytes += asset.sizeBytes;
    } else {
      bucket.unknownSizeCount += 1;
    }
    if (asset.renderBlocking) {
      renderBlockingRequests += 1;
    }
  }

  const resources = Object.values(categories);
  const requests = resources.reduce((total, category) => total + category.count, 0);
  const knownBytes = resources.reduce((total, category) => total + category.knownBytes, 0);
  const unknownSizeCount = resources.reduce((total, category) => total + category.unknownSizeCount, 0);
  const sizeCoverageRatio = requests > 0 ? round((requests - unknownSizeCount) / requests) : 0;

  return {
    totals: {
      requests,
      renderBlockingRequests,
      knownBytes,
      unknownSizeCount,
      sizeCoverageRatio,
    },
    html: htmlBytes || compressed ? { bytes: htmlBytes, compressed } : undefined,
    resources: categories,
    sampledAssets: (assets ?? []).slice(0, 12).map((asset) => ({
      url: asset.url,
      type: asset.type,
      sizeBytes: asset.sizeBytes,
      sizeKnown: asset.sizeKnown,
      inline: asset.inline,
      renderBlocking: asset.renderBlocking,
    })),
  };
}

function buildRenderingRisk(meta?: MetaTags, assetBreakdown?: AssetBreakdown): RenderingRisk | undefined {
  if (!meta && !assetBreakdown) {
    return undefined;
  }

  const stylesheets = assetBreakdown?.resources.stylesheets.count ?? 0;
  const renderBlockingStylesheets = (meta?.assets ?? []).filter((asset) => asset.type === 'stylesheet' && asset.renderBlocking).length;
  const synchronousScripts = (meta?.assets ?? []).filter((asset) => asset.type === 'script' && !asset.async && !asset.defer).length;
  const largeHtmlDocument = (meta?.htmlBytes ?? 0) > 150_000;
  const missingViewport = !meta?.viewport;
  const reasons: string[] = [];
  let score = 100;

  if (renderBlockingStylesheets > 2) {
    reasons.push(`${renderBlockingStylesheets} render-blocking stylesheets detected`);
    score -= 25;
  } else if (renderBlockingStylesheets > 0) {
    reasons.push(`${renderBlockingStylesheets} render-blocking stylesheet detected`);
    score -= 10;
  }

  if (synchronousScripts > 2) {
    reasons.push(`${synchronousScripts} synchronous scripts may delay first paint`);
    score -= 25;
  } else if (synchronousScripts > 0) {
    reasons.push(`${synchronousScripts} synchronous script is loaded before rendering`);
    score -= 10;
  }

  if (largeHtmlDocument) {
    reasons.push('HTML document is large before any assets load');
    score -= 20;
  }

  if (missingViewport) {
    reasons.push('Viewport meta tag is missing');
    score -= 20;
  }

  if (stylesheets + synchronousScripts === 0 && !largeHtmlDocument && !missingViewport) {
    reasons.push('No major render-blocking risks observed from fetched HTML');
  }

  const normalizedScore = clamp(score);
  return {
    level: normalizedScore >= 80 ? 'low' : normalizedScore >= 50 ? 'medium' : 'high',
    score: normalizedScore,
    reasons,
    blockers: {
      renderBlockingStylesheets,
      synchronousScripts,
      largeHtmlDocument,
      missingViewport,
    },
  };
}

function buildSerpPreview(meta?: MetaTags): SERPPreview | undefined {
  if (!meta?.title && !meta?.description && !meta?.canonical && !meta?.finalUrl) {
    return undefined;
  }

  const title = meta?.title ?? 'Untitled page';
  const description = meta?.description ?? 'No meta description provided.';
  return {
    title,
    description,
    titleLength: title.length,
    descriptionLength: description.length,
    titleTruncated: title.length > 60,
    descriptionTruncated: description.length > 155,
    canonicalUrl: meta?.canonical,
    displayUrl: meta?.canonical ?? meta?.finalUrl,
    robots: meta?.robots,
  };
}

function buildSocialPresence(meta?: MetaTags): SocialPresence | undefined {
  if (!meta) {
    return undefined;
  }

  const missing: string[] = [];
  const ogComplete = Boolean(meta.ogTitle && meta.ogDescription && meta.ogImage);
  const twitterComplete = Boolean(meta.twitterCard && meta.twitterTitle && meta.twitterDescription && meta.twitterImage);
  const hasPreviewImage = Boolean(meta.ogImage || meta.twitterImage);

  if (!meta.ogTitle) missing.push('og:title');
  if (!meta.ogDescription) missing.push('og:description');
  if (!meta.ogImage) missing.push('og:image');
  if (!meta.twitterCard) missing.push('twitter:card');
  if (!meta.twitterTitle) missing.push('twitter:title');
  if (!meta.twitterDescription) missing.push('twitter:description');
  if (!meta.twitterImage) missing.push('twitter:image');

  const presentSignals = 7 - missing.length;

  return {
    openGraph: ogComplete,
    twitterCard: twitterComplete,
    hasPreviewImage,
    completenessScore: Math.round((presentSignals / 7) * 100),
    missing,
  };
}

function addMetaAudit(
  findings: SEOFinding[],
  recommendations: SEORecommendation[],
  meta: MetaTags | undefined,
  serpPreview: SERPPreview | undefined,
): void {
  if (!meta) {
    findings.push(makeFinding('page-fetch-unavailable', 'on-page', 'high', 'Page HTML could not be analyzed', 'Meta and page-structure signals are unavailable for this URL.', ['HTML fetch or parse failed'], 25));
    recommendations.push(makeRecommendation('page-fetch-unavailable', 'on-page', 'high', 'Allow the analyzer to fetch the canonical HTML response', 'Ensure the URL responds with crawlable HTML and does not block server-side requests.', 'Without HTML, title, description, headings, and page-structure issues cannot be verified.', ['HTML fetch or parse failed'], 25));
    return;
  }

  if (!meta.title) {
    findings.push(makeFinding('missing-title', 'on-page', 'high', 'Title tag is missing', 'Search engines and browsers do not have a clear page title to display.', ['No <title> element found'], 18));
    recommendations.push(makeRecommendation('missing-title', 'on-page', 'high', 'Add a unique title tag', 'Write a concise, keyword-relevant <title> around 30-60 characters.', 'A clear title improves rankings, click-through rate, and browser labeling.', ['No <title> element found'], 18));
  } else if ((serpPreview?.titleLength ?? 0) > 60 || (serpPreview?.titleLength ?? 0) < 25) {
    findings.push(makeFinding('title-length', 'on-page', 'medium', 'Title length is outside a healthy SERP range', `Current title length is ${serpPreview?.titleLength ?? 0} characters.`, [meta.title], 8));
    recommendations.push(makeRecommendation('title-length', 'on-page', 'medium', 'Tighten the title length', 'Keep the primary title focused and typically within 30-60 characters.', 'Balanced title length improves scanability and reduces truncation risk in search results.', [`Current title length: ${serpPreview?.titleLength ?? 0}`], 8));
  }

  if (!meta.description) {
    findings.push(makeFinding('missing-description', 'on-page', 'medium', 'Meta description is missing', 'The page lacks a controlled snippet for search result previews.', ['No meta[name="description"] found'], 12));
    recommendations.push(makeRecommendation('missing-description', 'on-page', 'high', 'Add a descriptive meta description', 'Write a human-readable description around 70-155 characters that reflects the page intent.', 'A better snippet can increase click-through rate and clarify topical relevance.', ['No meta[name="description"] found'], 12));
  } else if ((serpPreview?.descriptionLength ?? 0) > 155 || (serpPreview?.descriptionLength ?? 0) < 70) {
    findings.push(makeFinding('description-length', 'on-page', 'low', 'Meta description length is outside a healthy range', `Current description length is ${serpPreview?.descriptionLength ?? 0} characters.`, [meta.description], 5));
  }

  const h1Count = meta.headingCounts?.h1 ?? 0;
  if (h1Count !== 1) {
    findings.push(makeFinding('h1-structure', 'on-page', h1Count === 0 ? 'high' : 'medium', h1Count === 0 ? 'Primary H1 heading is missing' : 'Multiple H1 headings were found', h1Count === 0 ? 'The page has no clear primary heading.' : `The page contains ${h1Count} H1 headings.`, [`H1 count: ${h1Count}`], h1Count === 0 ? 14 : 8));
    recommendations.push(makeRecommendation('h1-structure', 'on-page', h1Count === 0 ? 'high' : 'medium', 'Use one clear H1 heading', 'Provide a single descriptive H1 that matches the page topic and supports the title tag.', 'A strong heading hierarchy improves content clarity for crawlers and users.', [`H1 count: ${h1Count}`], h1Count === 0 ? 14 : 8));
  }

  if ((meta.images?.withoutAlt ?? 0) > 0) {
    findings.push(makeFinding('missing-image-alt', 'usability', 'medium', 'Some images are missing alt text', `${meta.images?.withoutAlt ?? 0} of ${meta.images?.total ?? 0} images do not include alt text.`, [`Images without alt: ${meta.images?.withoutAlt ?? 0}`], 9));
    recommendations.push(makeRecommendation('missing-image-alt', 'usability', 'medium', 'Add descriptive alt text to meaningful images', 'Add concise alt attributes to content images and leave decorative images empty only when intentional.', 'Alt text improves accessibility and image search context.', [`Images without alt: ${meta.images?.withoutAlt ?? 0}`], 9));
  }

  if (!meta.canonical) {
    findings.push(makeFinding('missing-canonical', 'technical', 'medium', 'Canonical URL is missing', 'Search engines do not have an explicit preferred URL for this page.', ['No canonical link found'], 10));
    recommendations.push(makeRecommendation('missing-canonical', 'technical', 'medium', 'Add a canonical URL', 'Point the canonical tag to the preferred absolute URL for this page.', 'Canonical tags help consolidate duplicate signals and reduce indexing ambiguity.', ['No canonical link found'], 10));
  }

  if ((meta.wordCount ?? 0) < 150) {
    findings.push(makeFinding('thin-content-signal', 'on-page', 'low', 'Visible body copy appears light', `Observed word count is about ${meta.wordCount ?? 0} words.`, [`Estimated word count: ${meta.wordCount ?? 0}`], 4));
  }

  if (!meta.schemaOrg?.length) {
    findings.push(makeFinding('missing-schema', 'on-page', 'low', 'Structured data was not detected', 'No JSON-LD schema blocks were parsed from the page HTML.', ['No application/ld+json scripts found'], 5));
    recommendations.push(makeRecommendation('missing-schema', 'on-page', 'low', 'Add relevant structured data', 'Publish valid JSON-LD for the page type, such as Organization, Article, Product, or FAQ when appropriate.', 'Structured data can improve search understanding and eligibility for enhanced results.', ['No application/ld+json scripts found'], 5));
  }
}

function addTechnicalAudit(
  findings: SEOFinding[],
  recommendations: SEORecommendation[],
  ssl: SSLCertificate | undefined,
  headers: HTTPHeaders | undefined,
  meta: MetaTags | undefined,
  robots: RobotsData | undefined,
  sitemap: SitemapData | undefined,
): void {
  if (!ssl?.valid) {
    findings.push(makeFinding('ssl-invalid', 'technical', 'high', 'SSL certificate is invalid or unavailable', 'The site could not be validated as serving a healthy TLS certificate.', [ssl ? 'TLS handshake completed but certificate is not authorized' : 'SSL certificate details unavailable'], 20));
    recommendations.push(makeRecommendation('ssl-invalid', 'technical', 'high', 'Serve the page with a valid TLS certificate', 'Install and renew a trusted certificate for the primary host and redirect all traffic to HTTPS.', 'Invalid TLS harms trust, crawl stability, and browser security indicators.', [ssl?.validTo ? `Certificate expiry: ${ssl.validTo}` : 'SSL validation failed'], 20));
  } else if ((ssl.daysUntilExpiry ?? 365) < 30) {
    findings.push(makeFinding('ssl-expiring', 'technical', 'medium', 'SSL certificate expires soon', `Certificate expires in ${ssl.daysUntilExpiry ?? 0} days.`, [`Valid to: ${ssl.validTo ?? 'unknown'}`], 10));
  }

  const missingSecurityHeaders = [
    ['Strict-Transport-Security', headers?.securityHeaders.strictTransportSecurity],
    ['Content-Security-Policy', headers?.securityHeaders.contentSecurityPolicy],
    ['X-Frame-Options', headers?.securityHeaders.xFrameOptions],
    ['X-Content-Type-Options', headers?.securityHeaders.xContentTypeOptions],
    ['Referrer-Policy', headers?.securityHeaders.referrerPolicy],
  ] as Array<[string, string | undefined]>;

  const missingSecurityHeadersList = missingSecurityHeaders.filter(([, value]) => !value).map(([name]) => name);

  if (missingSecurityHeadersList.length > 0) {
    findings.push(makeFinding('security-headers', 'technical', missingSecurityHeadersList.length >= 3 ? 'high' : 'medium', 'Security headers are incomplete', `${missingSecurityHeadersList.length} recommended security headers are missing.`, missingSecurityHeadersList, missingSecurityHeadersList.length >= 3 ? 14 : 8));
    recommendations.push(makeRecommendation('security-headers', 'technical', 'medium', 'Add baseline security headers', 'Configure HSTS, CSP, X-Frame-Options, X-Content-Type-Options, and Referrer-Policy at the edge or app server.', 'These headers reduce common security risks and strengthen technical trust signals.', missingSecurityHeadersList, missingSecurityHeadersList.length >= 3 ? 14 : 8));
  }

  if (meta?.robots?.toLowerCase().includes('noindex')) {
    findings.push(makeFinding('robots-noindex', 'technical', 'high', 'Page asks search engines not to index it', 'The robots meta tag contains a noindex directive.', [meta.robots], 25));
    recommendations.push(makeRecommendation('robots-noindex', 'technical', 'high', 'Remove accidental noindex directives', 'Update the robots meta tag if this page should appear in search results.', 'Noindex blocks the page from standard indexing.', [meta.robots], 25));
  }

  if (!robots?.exists) {
    findings.push(makeFinding('missing-robots-txt', 'technical', 'low', 'robots.txt was not found', 'Crawlers do not have a published crawl policy file at the expected location.', ['GET /robots.txt did not return a successful response'], 4));
    recommendations.push(makeRecommendation('missing-robots-txt', 'technical', 'low', 'Publish a robots.txt file', 'Add a simple robots.txt that documents crawl rules and references your sitemap.', 'This gives crawlers a predictable entry point for crawl policy and sitemap discovery.', ['GET /robots.txt did not return a successful response'], 4));
  }

  if (!sitemap?.exists) {
    findings.push(makeFinding('missing-sitemap', 'links', 'medium', 'Sitemap was not found at the default location', 'The analyzer could not fetch sitemap.xml from the site root.', ['GET /sitemap.xml did not return a successful response'], 8));
    recommendations.push(makeRecommendation('missing-sitemap', 'links', 'medium', 'Publish or expose an XML sitemap', 'Serve a sitemap.xml file and reference it from robots.txt.', 'Sitemaps help crawlers discover canonical URLs more efficiently.', ['GET /sitemap.xml did not return a successful response'], 8));
  }
}

function addPerformanceAudit(
  findings: SEOFinding[],
  recommendations: SEORecommendation[],
  meta: MetaTags | undefined,
  assetBreakdown: AssetBreakdown | undefined,
  renderingRisk: RenderingRisk | undefined,
): void {
  if (!assetBreakdown && !meta) {
    return;
  }

  if ((meta?.fetchTimeMs ?? 0) > 2000) {
    findings.push(makeFinding('slow-html-response', 'performance', 'medium', 'Initial HTML response was slow during collection', `Observed HTML fetch time was ${meta?.fetchTimeMs}ms.`, [`Observed fetch time: ${meta?.fetchTimeMs}ms`], 10));
  }

  if ((assetBreakdown?.totals.renderBlockingRequests ?? 0) > 3) {
    findings.push(makeFinding('render-blockers', 'performance', 'high', 'Several render-blocking assets were detected', `${assetBreakdown?.totals.renderBlockingRequests ?? 0} assets can delay first paint.`, [`Render-blocking assets: ${assetBreakdown?.totals.renderBlockingRequests ?? 0}`], 14));
    recommendations.push(makeRecommendation('render-blockers', 'performance', 'high', 'Reduce render-blocking CSS and scripts', 'Inline only critical CSS, defer non-critical CSS, and mark non-essential scripts with defer or async.', 'Reducing render blockers improves perceived speed and early content visibility.', [`Render-blocking assets: ${assetBreakdown?.totals.renderBlockingRequests ?? 0}`], 14));
  }

  if ((assetBreakdown?.totals.unknownSizeCount ?? 0) > 0) {
    findings.push(makeFinding('partial-asset-coverage', 'performance', 'info', 'Some asset sizes could not be verified', `${assetBreakdown?.totals.unknownSizeCount ?? 0} assets did not expose a measurable content length.`, [`Coverage ratio: ${Math.round((assetBreakdown?.totals.sizeCoverageRatio ?? 0) * 100)}%`], 0));
  }

  if ((meta?.htmlBytes ?? 0) > 150_000) {
    findings.push(makeFinding('large-html', 'performance', 'medium', 'HTML document is relatively large', `Observed HTML size is ${(meta?.htmlBytes ?? 0) / 1024 >= 1 ? `${Math.round((meta?.htmlBytes ?? 0) / 1024)} KB` : `${meta?.htmlBytes} B`}.`, [`HTML bytes: ${meta?.htmlBytes ?? 0}`], 8));
    recommendations.push(makeRecommendation('large-html', 'performance', 'medium', 'Reduce initial HTML payload', 'Trim unused markup, server-render only essential content, and move repeated data into lazy-loaded requests where possible.', 'A lighter HTML document improves transfer size and parsing cost before assets load.', [`HTML bytes: ${meta?.htmlBytes ?? 0}`], 8));
  }

  if (renderingRisk?.blockers.missingViewport) {
    findings.push(makeFinding('missing-viewport', 'usability', 'high', 'Viewport meta tag is missing', 'Mobile browsers may render the page with a non-responsive default viewport.', ['No meta[name="viewport"] found'], 16));
    recommendations.push(makeRecommendation('missing-viewport', 'usability', 'high', 'Add a responsive viewport meta tag', 'Add `<meta name="viewport" content="width=device-width, initial-scale=1">` to the document head.', 'This is a baseline mobile usability signal and affects how the page renders on phones.', ['No meta[name="viewport"] found'], 16));
  }
}

function addSocialAudit(
  findings: SEOFinding[],
  recommendations: SEORecommendation[],
  socialPresence: SocialPresence | undefined,
  meta: MetaTags | undefined,
): void {
  if (!socialPresence || !meta) {
    return;
  }

  if (socialPresence.completenessScore < 60) {
    findings.push(makeFinding('social-preview-gaps', 'social', 'medium', 'Social preview tags are incomplete', `${socialPresence.missing.length} recommended Open Graph/Twitter tags are missing.`, socialPresence.missing, 12));
    recommendations.push(makeRecommendation('social-preview-gaps', 'social', 'medium', 'Complete social preview metadata', 'Add matching Open Graph and Twitter tags with a stable title, description, and preview image.', 'Complete social cards improve how links appear when shared across platforms.', socialPresence.missing, 12));
  }

  if (!socialPresence.hasPreviewImage) {
    findings.push(makeFinding('social-image-missing', 'social', 'medium', 'Social preview image is missing', 'Neither Open Graph nor Twitter image tags were found.', ['Missing og:image and twitter:image'], 10));
  }
}

function addLinkAudit(
  findings: SEOFinding[],
  recommendations: SEORecommendation[],
  meta: MetaTags | undefined,
  robots: RobotsData | undefined,
  sitemap: SitemapData | undefined,
): void {
  if ((meta?.links?.internal ?? 0) < 3) {
    findings.push(makeFinding('internal-link-light', 'links', 'low', 'Internal linking looks light on the fetched page', `Only ${meta?.links?.internal ?? 0} internal links were observed.`, [`Internal links observed: ${meta?.links?.internal ?? 0}`], 5));
    recommendations.push(makeRecommendation('internal-link-light', 'links', 'low', 'Strengthen internal linking from key templates', 'Add clear contextual links to related pages and important conversion or discovery paths.', 'Internal links help distribute authority and support crawl discovery.', [`Internal links observed: ${meta?.links?.internal ?? 0}`], 5));
  }

  if ((meta?.links?.missingAnchorText ?? 0) > 0) {
    findings.push(makeFinding('empty-anchor-text', 'links', 'low', 'Some links have weak or empty anchor text', `${meta?.links?.missingAnchorText ?? 0} links were missing visible anchor text.`, [`Links missing anchor text: ${meta?.links?.missingAnchorText ?? 0}`], 4));
  }

  if (robots?.exists && !robots.sitemaps?.length && !sitemap?.exists) {
    findings.push(makeFinding('robots-without-sitemap', 'links', 'low', 'robots.txt does not advertise a sitemap', 'The crawl policy file exists but no sitemap directive was found.', ['robots.txt present, no Sitemap directive'], 3));
  }
}

function buildCategoryScores(
  input: AuditInput,
  assetBreakdown?: AssetBreakdown,
  socialPresence?: SocialPresence,
  renderingRisk?: RenderingRisk,
): Partial<Record<SEOCategory, SEOCategoryScore>> {
  const hasMeta = Boolean(input.meta);
  const hasHeaders = Boolean(input.headers);
  const hasSSL = Boolean(input.ssl);
  const hasRobots = input.robots !== undefined;
  const hasSitemap = input.sitemap !== undefined;
  const hasSocial = Boolean(socialPresence);
  const hasAssets = Boolean(assetBreakdown);
  const hasRenderingRisk = Boolean(renderingRisk);

  return {
    'on-page': scoreCategory([
      signal(Boolean(input.meta?.title), 18, input.meta?.title ? 'Title tag present' : 'Missing title tag', hasMeta),
      signal(Boolean(input.meta?.description), 16, input.meta?.description ? 'Meta description present' : 'Missing meta description', hasMeta),
      signal((input.meta?.headingCounts?.h1 ?? 0) === 1, 14, `H1 count: ${input.meta?.headingCounts?.h1 ?? 0}`, hasMeta),
      signal(Boolean(input.meta?.canonical), 14, input.meta?.canonical ? 'Canonical tag present' : 'Missing canonical tag', hasMeta),
      signal(Boolean(input.meta?.schemaOrg?.length), 12, input.meta?.schemaOrg?.length ? 'Structured data detected' : 'No structured data detected', hasMeta),
      signal((input.meta?.wordCount ?? 0) >= 150, 10, `Estimated word count: ${input.meta?.wordCount ?? 0}`, hasMeta),
      signal((input.meta?.images?.withoutAlt ?? 0) === 0, 16, `Images without alt: ${input.meta?.images?.withoutAlt ?? 0}`, hasMeta),
    ]),
    technical: scoreCategory([
      signal(Boolean(input.ssl?.valid), 22, input.ssl?.valid ? 'Valid SSL certificate' : 'SSL invalid or unavailable', hasSSL),
      signal((input.headers?.securityHeaders.strictTransportSecurity ? 1 : 0) + (input.headers?.securityHeaders.contentSecurityPolicy ? 1 : 0) + (input.headers?.securityHeaders.xFrameOptions ? 1 : 0) + (input.headers?.securityHeaders.xContentTypeOptions ? 1 : 0) + (input.headers?.securityHeaders.referrerPolicy ? 1 : 0) >= 4, 20, 'Baseline security headers coverage', hasHeaders),
      signal(!(input.meta?.robots?.toLowerCase().includes('noindex') ?? false), 18, input.meta?.robots ? `Robots meta: ${input.meta.robots}` : 'No robots meta directive', hasMeta),
      signal(Boolean(input.robots?.exists), 12, input.robots?.exists ? 'robots.txt found' : 'robots.txt missing', hasRobots),
      signal(Boolean(input.sitemap?.exists), 14, input.sitemap?.exists ? 'Sitemap found' : 'Sitemap missing', hasSitemap),
      signal(Boolean(input.meta?.lang), 14, input.meta?.lang ? `Lang attribute: ${input.meta.lang}` : 'Missing lang attribute', hasMeta),
    ]),
    performance: scoreCategory([
      signal((input.meta?.fetchTimeMs ?? 0) > 0 && (input.meta?.fetchTimeMs ?? 0) <= 2000, 22, `Observed HTML fetch time: ${input.meta?.fetchTimeMs ?? 0}ms`, hasMeta),
      signal((assetBreakdown?.totals.renderBlockingRequests ?? 0) <= 2, 20, `Render-blocking assets: ${assetBreakdown?.totals.renderBlockingRequests ?? 0}`, hasAssets),
      signal((input.meta?.htmlBytes ?? 0) > 0 && (input.meta?.htmlBytes ?? 0) <= 150_000, 18, `HTML bytes: ${input.meta?.htmlBytes ?? 0}`, hasMeta),
      signal(Boolean(input.headers?.compression), 16, input.headers?.compression ? `Compression: ${input.headers.compression}` : 'Compression header missing', hasHeaders),
      signal((renderingRisk?.score ?? 0) >= 70, 24, `Rendering risk score: ${renderingRisk?.score ?? 0}`, hasRenderingRisk),
    ]),
    usability: scoreCategory([
      signal(Boolean(input.meta?.viewport), 28, input.meta?.viewport ? 'Viewport meta present' : 'Missing viewport meta', hasMeta),
      signal((input.meta?.images?.withoutAlt ?? 0) === 0, 18, `Images without alt: ${input.meta?.images?.withoutAlt ?? 0}`, hasMeta),
      signal((input.meta?.headingCounts?.h1 ?? 0) === 1, 18, `H1 count: ${input.meta?.headingCounts?.h1 ?? 0}`, hasMeta),
      signal(Boolean(input.meta?.lang), 18, input.meta?.lang ? `Lang attribute: ${input.meta.lang}` : 'Missing lang attribute', hasMeta),
      signal((input.meta?.links?.missingAnchorText ?? 0) === 0, 18, `Links missing anchor text: ${input.meta?.links?.missingAnchorText ?? 0}`, hasMeta),
    ]),
    social: scoreCategory([
      signal(Boolean(input.meta?.ogTitle), 18, input.meta?.ogTitle ? 'og:title present' : 'og:title missing', hasMeta),
      signal(Boolean(input.meta?.ogDescription), 18, input.meta?.ogDescription ? 'og:description present' : 'og:description missing', hasMeta),
      signal(Boolean(input.meta?.ogImage), 18, input.meta?.ogImage ? 'og:image present' : 'og:image missing', hasMeta),
      signal(Boolean(input.meta?.twitterCard), 18, input.meta?.twitterCard ? 'twitter:card present' : 'twitter:card missing', hasMeta),
      signal((socialPresence?.completenessScore ?? 0) >= 70, 28, `Social completeness: ${socialPresence?.completenessScore ?? 0}`, hasSocial),
    ]),
    links: scoreCategory([
      signal(Boolean(input.meta?.canonical), 18, input.meta?.canonical ? 'Canonical present' : 'Canonical missing', hasMeta),
      signal(Boolean(input.sitemap?.exists), 20, input.sitemap?.exists ? 'Sitemap present' : 'Sitemap missing', hasSitemap),
      signal(Boolean(input.robots?.sitemaps?.length || input.sitemap?.exists), 18, input.robots?.sitemaps?.length ? 'robots.txt references sitemap' : 'No sitemap directive found in robots.txt', hasRobots || hasSitemap),
      signal((input.meta?.links?.internal ?? 0) >= 3, 22, `Internal links: ${input.meta?.links?.internal ?? 0}`, hasMeta),
      signal((input.meta?.links?.missingAnchorText ?? 0) === 0, 22, `Links missing anchor text: ${input.meta?.links?.missingAnchorText ?? 0}`, hasMeta),
    ]),
  };
}

function buildSummary(categoryScores: Partial<Record<SEOCategory, SEOCategoryScore>>, recommendationCount: number): SEOAuditSummary | undefined {
  const scored = CATEGORY_ORDER
    .map((category) => ({ category, score: categoryScores[category]?.score }))
    .filter((item): item is { category: SEOCategory; score: number } => item.score !== undefined);

  if (!scored.length) {
    return undefined;
  }

  const strongestCategories = [...scored].sort((a, b) => b.score - a.score).slice(0, 2).map((item) => item.category);
  const weakestCategories = [...scored].sort((a, b) => a.score - b.score).slice(0, 2).map((item) => item.category);
  const averageScore = Math.round(scored.reduce((sum, item) => sum + item.score, 0) / scored.length);

  return {
    headline: averageScore >= 80 ? 'Healthy baseline SEO signals with a few targeted fixes remaining.' : averageScore >= 60 ? 'Mixed SEO health with several high-impact improvements available.' : 'Core SEO gaps are limiting discoverability and page quality signals.',
    strongestCategories,
    weakestCategories,
    recommendationCount,
  };
}

function scoreCategory(signals: Signal[]): SEOCategoryScore {
  const available = signals.filter((item) => item.available);
  const availableSignals = available.length;
  const totalPoints = available.reduce((sum, item) => sum + item.points, 0);
  const earnedPoints = available.reduce((sum, item) => sum + (item.passed ? item.points : 0), 0);
  const score = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
  return {
    score,
    status: availableSignals === 0 ? 'unknown' : score >= 80 ? 'good' : score >= 55 ? 'needs-attention' : 'poor',
    reasons: available.map((item) => item.reason),
    availableSignals,
    totalSignals: signals.length,
  };
}

function signal(passed: boolean, points: number, reason: string, available = true): Signal {
  return { available, passed, points, reason };
}

function makeFinding(
  id: string,
  category: SEOCategory,
  severity: AuditSeverity,
  title: string,
  detail: string,
  evidence: string[],
  scoreImpact?: number,
): SEOFinding {
  return { id, category, severity, title, detail, evidence, scoreImpact };
}

function makeRecommendation(
  id: string,
  category: SEOCategory,
  priority: AuditPriority,
  title: string,
  fix: string,
  impact: string,
  evidence: string[],
  scoreImpact?: number,
): SEORecommendation {
  return { id, category, priority, title, fix, impact, evidence, scoreImpact };
}

function sortFindings(findings: SEOFinding[]): SEOFinding[] {
  const severityRank: Record<AuditSeverity, number> = { high: 0, medium: 1, low: 2, info: 3 };
  return findings.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || (b.scoreImpact ?? 0) - (a.scoreImpact ?? 0));
}

function sortRecommendations(recommendations: SEORecommendation[]): SEORecommendation[] {
  const priorityRank: Record<AuditPriority, number> = { high: 0, medium: 1, low: 2 };
  return recommendations.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || (b.scoreImpact ?? 0) - (a.scoreImpact ?? 0));
}

function emptyAssetCategory(): AssetCategoryBreakdown {
  return { count: 0, knownBytes: 0, unknownSizeCount: 0, externalCount: 0, inlineCount: 0 };
}

function toBucket(type: PageAsset['type']): keyof AssetBreakdown['resources'] {
  switch (type) {
    case 'script':
      return 'scripts';
    case 'stylesheet':
      return 'stylesheets';
    case 'image':
      return 'images';
    case 'font':
      return 'fonts';
    default:
      return 'other';
  }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
