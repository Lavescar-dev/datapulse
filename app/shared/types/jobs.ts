// Job queue types for BullMQ

export type JobType = 'scrape' | 'seo-analyze';

export interface ScrapeJobData {
  url: string;
  selector?: string;
  autoDetect?: boolean;
  sessionId: string;
  isAdmin: boolean;
}

export interface ScrapeJobResult {
  success: boolean;
  data?: any[];
  error?: string;
  url: string;
  scrapedAt: number;
  itemCount?: number;
  pattern?: string;
  engine?: 'puppeteer' | 'cheerio';
  fallbackUsed?: boolean;
  warning?: string;
  attemptedEngine?: 'puppeteer';
}

export interface SEOAnalyzeJobData {
  url: string;
  sessionId: string;
  isAdmin: boolean;
}

export interface SEOAnalyzeJobResult {
  success: boolean;
  report?: SEOReport;
  error?: string;
  url: string;
  analyzedAt: number;
}

export interface SEOReport {
  url: string;
  whois?: WhoisData;
  dns?: DNSRecords;
  ssl?: SSLCertificate;
  headers?: HTTPHeaders;
  meta?: MetaTags;
  techStack?: TechDetection[];
  robots?: RobotsData;
  sitemap?: SitemapData;
  performanceScore?: PerformanceScore;
  categoryScores?: Partial<Record<SEOCategory, SEOCategoryScore>>;
  recommendations?: SEORecommendation[];
  findings?: SEOFinding[];
  assetBreakdown?: AssetBreakdown;
  renderingRisk?: RenderingRisk;
  serpPreview?: SERPPreview;
  socialPresence?: SocialPresence;
  summary?: SEOAuditSummary;
}

export type SEOCategory = 'on-page' | 'technical' | 'performance' | 'usability' | 'social' | 'links';

export type AuditSeverity = 'info' | 'low' | 'medium' | 'high';

export type AuditPriority = 'low' | 'medium' | 'high';

export interface SEOCategoryScore {
  score: number;
  status: 'good' | 'needs-attention' | 'poor' | 'unknown';
  reasons: string[];
  availableSignals: number;
  totalSignals: number;
}

export interface SEOFinding {
  id: string;
  category: SEOCategory;
  severity: AuditSeverity;
  title: string;
  detail: string;
  evidence: string[];
  scoreImpact?: number;
}

export interface SEORecommendation {
  id: string;
  category: SEOCategory;
  priority: AuditPriority;
  title: string;
  fix: string;
  impact: string;
  evidence: string[];
  scoreImpact?: number;
}

export interface AssetBreakdown {
  totals: {
    requests: number;
    renderBlockingRequests: number;
    knownBytes: number;
    unknownSizeCount: number;
    sizeCoverageRatio: number;
  };
  html?: {
    bytes?: number;
    compressed: boolean;
  };
  resources: {
    scripts: AssetCategoryBreakdown;
    stylesheets: AssetCategoryBreakdown;
    images: AssetCategoryBreakdown;
    fonts: AssetCategoryBreakdown;
    other: AssetCategoryBreakdown;
  };
  sampledAssets?: AssetSample[];
}

export interface AssetCategoryBreakdown {
  count: number;
  knownBytes: number;
  unknownSizeCount: number;
  externalCount: number;
  inlineCount: number;
}

export interface AssetSample {
  url?: string;
  type: PageAssetType;
  sizeBytes?: number;
  sizeKnown: boolean;
  inline: boolean;
  renderBlocking: boolean;
}

export interface RenderingRisk {
  level: 'low' | 'medium' | 'high' | 'unknown';
  score: number;
  reasons: string[];
  blockers: {
    renderBlockingStylesheets: number;
    synchronousScripts: number;
    largeHtmlDocument: boolean;
    missingViewport: boolean;
  };
}

export interface SERPPreview {
  title: string;
  description: string;
  titleLength: number;
  descriptionLength: number;
  titleTruncated: boolean;
  descriptionTruncated: boolean;
  canonicalUrl?: string;
  displayUrl?: string;
  robots?: string;
}

export interface SocialPresence {
  openGraph: boolean;
  twitterCard: boolean;
  hasPreviewImage: boolean;
  completenessScore: number;
  missing: string[];
}

export interface SEOAuditSummary {
  headline: string;
  strongestCategories: SEOCategory[];
  weakestCategories: SEOCategory[];
  recommendationCount: number;
}

export interface WhoisData {
  domain: string;
  registrar?: string;
  createdDate?: string;
  expiryDate?: string;
  updatedDate?: string;
  nameServers?: string[];
  status?: string[];
  registrant?: {
    organization?: string;
    country?: string;
  };
}

export interface DNSRecords {
  A?: string[];
  AAAA?: string[];
  MX?: { priority: number; exchange: string }[];
  TXT?: string[];
  CNAME?: string[];
  NS?: string[];
}

export interface SSLCertificate {
  valid: boolean;
  issuer?: string;
  subject?: string;
  validFrom?: string;
  validTo?: string;
  daysUntilExpiry?: number;
  protocol?: string;
  cipher?: string;
}

export interface HTTPHeaders {
  server?: string;
  poweredBy?: string;
  contentType?: string;
  securityHeaders: {
    strictTransportSecurity?: string;
    contentSecurityPolicy?: string;
    xFrameOptions?: string;
    xContentTypeOptions?: string;
    referrerPolicy?: string;
    permissionsPolicy?: string;
  };
  caching: {
    cacheControl?: string;
    expires?: string;
    etag?: string;
  };
  compression?: string;
}

export interface MetaTags {
  title?: string;
  description?: string;
  keywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
  twitterCard?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  canonical?: string;
  robots?: string;
  schemaOrg?: any[];
  finalUrl?: string;
  statusCode?: number;
  contentType?: string;
  lang?: string;
  charset?: string;
  viewport?: string;
  favicon?: string;
  htmlBytes?: number;
  textBytes?: number;
  wordCount?: number;
  fetchTimeMs?: number;
  headingCounts?: HeadingCounts;
  h1?: string[];
  images?: PageImageSummary;
  links?: PageLinkSummary;
  schemaTypes?: string[];
  assets?: PageAsset[];
}

export interface HeadingCounts {
  h1: number;
  h2: number;
  h3: number;
  h4: number;
  h5: number;
  h6: number;
}

export interface PageImageSummary {
  total: number;
  withoutAlt: number;
}

export interface PageLinkSummary {
  total: number;
  internal: number;
  external: number;
  missingAnchorText: number;
}

export type PageAssetType = 'script' | 'stylesheet' | 'image' | 'font' | 'other';

export interface PageAsset {
  type: PageAssetType;
  url?: string;
  inline: boolean;
  async?: boolean;
  defer?: boolean;
  renderBlocking: boolean;
  sizeBytes?: number;
  sizeKnown: boolean;
}

export interface TechDetection {
  name: string;
  category: string;
  version?: string;
  confidence: number;
}

export interface RobotsData {
  exists: boolean;
  content?: string;
  userAgents?: { agent: string; rules: string[] }[];
  sitemaps?: string[];
}

export interface SitemapData {
  exists: boolean;
  urls?: string[];
  urlCount?: number;
  lastModified?: string;
}

export interface PerformanceScore {
  overall: number; // 0-100
  ssl: number;
  securityHeaders: number;
  metaCompleteness: number;
  loadTime?: number;
  breakdown: {
    ssl: { score: number; reason: string };
    securityHeaders: { score: number; present: string[]; missing: string[] };
    meta: { score: number; present: string[]; missing: string[] };
    observed?: {
      htmlBytes?: number;
      assetRequests?: number;
      renderBlockingRequests?: number;
      knownAssetBytes?: number;
      sizeCoverageRatio?: number;
      fetchTimeMs?: number;
    };
  };
}

export interface JobStatus {
  id: string;
  type: JobType;
  status: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed';
  progress?: number;
  data?: ScrapeJobData | SEOAnalyzeJobData;
  result?: ScrapeJobResult | SEOAnalyzeJobResult;
  error?: string;
  createdAt: number;
  processedAt?: number;
  finishedAt?: number;
}
