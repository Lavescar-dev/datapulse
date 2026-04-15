// Cheerio-based static HTML scraper for simple websites
import * as cheerio from 'cheerio';

export interface StaticScrapeOptions {
  html: string;
  baseUrl?: string;
  selector?: string;
  autoDetect?: boolean;
}

export interface ScrapedData {
  [key: string]: string | null;
}

interface AutoDetectPattern {
  name: string;
  container: string;
  fields: Record<string, string>;
}

const TRACKING_HOST_SNIPPETS = ['adservice.', '/event/api/', 'googleadservices', 'doubleclick'];

function normalizeText(value?: string | null) {
  const cleaned = value?.replace(/\s+/g, ' ').trim();
  return cleaned ? cleaned : null;
}

function resolveUrl(baseUrl: string | undefined, value?: string | null) {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('javascript:') || trimmed.startsWith('data:')) {
    return null;
  }

  try {
    return new URL(trimmed, baseUrl).toString();
  } catch {
    return null;
  }
}

function isTrackingUrl(value?: string | null) {
  if (!value) return false;
  const lower = value.toLowerCase();
  return TRACKING_HOST_SNIPPETS.some((snippet) => lower.includes(snippet));
}

function isImageLikeUrl(value?: string | null) {
  if (!value) return false;
  return /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(value);
}

function isLikelyProductLink(value?: string | null) {
  if (!value) return false;
  return /\/[^\s"']+-p-[a-z0-9]+/i.test(value) || /\/p-[a-z0-9]+/i.test(value) || /HBCV/i.test(value);
}

function sanitizeImage(baseUrl: string | undefined, value?: string | null) {
  const resolved = resolveUrl(baseUrl, value);
  if (!resolved || isTrackingUrl(resolved)) return null;
  const lower = resolved.toLowerCase();
  if (lower.includes('/banners/') || lower.includes('badge_copy')) return null;
  return resolved;
}

function sanitizeLink(baseUrl: string | undefined, value?: string | null, patternName?: string) {
  const resolved = resolveUrl(baseUrl, value);
  if (!resolved || isTrackingUrl(resolved) || isImageLikeUrl(resolved)) return null;
  if (patternName === 'products' && !isLikelyProductLink(resolved)) return null;
  return resolved;
}

function finalizePatternData(baseUrl: string | undefined, patternName: string | undefined, rows: ScrapedData[]) {
  const seen = new Set<string>();
  const sanitized = rows
    .map((row) => {
      const next: ScrapedData = {};

      for (const [key, rawValue] of Object.entries(row)) {
        if (key === 'title' || key === 'description' || key === 'text' || key === 'date' || key.startsWith('column_') || key === 'price') {
          next[key] = normalizeText(rawValue);
        } else if (key === 'link') {
          next[key] = sanitizeLink(baseUrl, rawValue, patternName);
        } else if (key === 'image') {
          next[key] = sanitizeImage(baseUrl, rawValue);
        } else if (key === 'imageAlt') {
          next[key] = normalizeText(rawValue);
        } else {
          next[key] = rawValue;
        }
      }

      return next;
    })
    .filter((row) => {
      const title = row.title ?? row.text;

      if (patternName === 'products') {
        if (!title || String(title).length < 12) return false;
        if (!row.link && !row.price) return false;
      }

      if (patternName === 'articles') {
        if (!title || String(title).length < 12) return false;
      }

      const dedupeKey = `${row.title ?? row.text ?? ''}::${row.link ?? row.image ?? ''}`;
      if (seen.has(dedupeKey)) return false;
      seen.add(dedupeKey);
      return true;
    });

  return sanitized;
}

// Same auto-detect patterns as engine.ts
const AUTO_DETECT_PATTERNS: AutoDetectPattern[] = [
  {
    name: 'products',
    container: '.productListContent-zAP0Y5msy8OHn5z7T_K_ li, li[class*="productListContent"], .product, .product-item, [data-product], .item, .listing-item, [data-test-id="product-card"], [class*="product-card"]',
    fields: {
      title: '.product-title, [data-test-id="product-card-name"], h2, h3, .title, .name, .product-name',
      price: '[data-test-id="price-current-price"], .price, .product-price, [data-price], .amount',
      image: 'img[data-test-id="product-card-image"], img',
      link: 'a[href*="-p-"], a[href*="/p-"], a[href*="HBCV"], a',
    },
  },
  {
    name: 'articles',
    container: 'article, .article, .post, .news-item, .story',
    fields: {
      title: 'h1, h2, h3, .title, .headline',
      description: 'p, .excerpt, .summary, .description',
      date: 'time, .date, .published',
      link: 'a',
      image: 'img',
    },
  },
  {
    name: 'table-rows',
    container: 'table tbody tr',
    fields: {
      cells: 'td',
    },
  },
  {
    name: 'list-items',
    container: 'ul li, ol li, .list-item',
    fields: {
      text: '*',
      link: 'a',
    },
  },
];

function extractData($: cheerio.CheerioAPI, selector: string): ScrapedData[] {
  const results: ScrapedData[] = [];

  $(selector).each((_, element) => {
    const $el = $(element);
    const data: ScrapedData = {};

    // Extract text content
    data.text = $el.text().trim() || null;

    // Extract href
    const link = $el.is('a') ? $el : $el.find('a').first();
    if (link.length) {
      data.link = link.attr('href') || null;
    }

    // Extract image
    const img = $el.is('img') ? $el : $el.find('img').first();
    if (img.length) {
      data.image = img.attr('src') || null;
      data.imageAlt = img.attr('alt') || null;
    }

    // Extract data attributes
    const attrs = ((element as { attribs?: Record<string, string> }).attribs ?? {}) as Record<string, string>;
    Object.keys(attrs).forEach(key => {
      if (key.startsWith('data-')) {
        data[key] = attrs[key] ?? null;
      }
    });

    results.push(data);
  });

  return results;
}

function autoDetectAndExtract($: cheerio.CheerioAPI, baseUrl?: string): { pattern: string; data: ScrapedData[] } {
  for (const pattern of AUTO_DETECT_PATTERNS) {
    try {
      const containers = $(pattern.container);

      // Pattern is valid if we find at least 3 instances
      if (containers.length >= 3) {
        const data: ScrapedData[] = [];

        containers.each((_, container) => {
          const $container = $(container);
          const result: ScrapedData = {};

          for (const [fieldName, fieldSelector] of Object.entries(pattern.fields)) {
            if (fieldSelector === '*') {
              result[fieldName] = $container.text().trim() || null;
            } else if (fieldSelector === 'td') {
              // Special handling for table cells
              $container.find('td').each((index, cell) => {
                result[`column_${index}`] = $(cell).text().trim() || null;
              });
            } else {
              const $el = $container.find(fieldSelector).first();
              if ($el.length) {
                if ($el.is('img')) {
                  result[fieldName] = $el.attr('src') || null;
                } else if ($el.is('a')) {
                  result[fieldName] = $el.attr('href') || null;
                } else {
                  result[fieldName] = $el.text().trim() || null;
                }
              }
            }
          }

          data.push(result);
        });

        const finalized = finalizePatternData(baseUrl, pattern.name, data);

        if (finalized.length > 0) {
          console.log(`ℹ️ Static scraper selected pattern '${pattern.name}' with ${finalized.length}/${data.length} rows`);
          return { pattern: pattern.name, data: finalized };
        }
      }
    } catch (err) {
      // Pattern didn't match, continue to next
      continue;
    }
  }

  // Fallback: extract basic page info
  const fallbackData: ScrapedData[] = [{
    title: $('title').text().trim() || null,
    text: $('body').text().trim() || null,
  }];

  return { pattern: 'fallback', data: fallbackData };
}

export function scrapeWithCheerio(options: StaticScrapeOptions): {
  success: boolean;
  data?: ScrapedData[];
  pattern?: string;
  error?: string;
} {
  try {
    const $ = cheerio.load(options.html);

    let result: { pattern?: string; data: ScrapedData[] };

    if (options.autoDetect) {
      // Auto-detect common patterns
      result = autoDetectAndExtract($, options.baseUrl);
    } else if (options.selector) {
      // Use provided selector
      const data = extractData($, options.selector);
      result = { data: finalizePatternData(options.baseUrl, 'custom', data) };
    } else {
      // Default: try auto-detect
      result = autoDetectAndExtract($, options.baseUrl);
    }

    return {
      success: true,
      data: result.data,
      pattern: result.pattern,
    };
  } catch (error) {
    console.error('Cheerio scraping error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Helper function to fetch HTML and scrape with Cheerio
export async function fetchAndScrape(url: string, options: Omit<StaticScrapeOptions, 'html'>) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const html = await response.text();
    return {
      ...scrapeWithCheerio({ ...options, html, baseUrl: url }),
      html,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
