// Puppeteer-based web scraper engine with browser pool management
import puppeteer, { Browser, Page } from 'puppeteer';

interface BrowserInstance {
  browser: Browser;
  inUse: boolean;
  lastUsed: number;
}

class BrowserPool {
  private pool: BrowserInstance[] = [];
  private maxInstances = 2;
  private idleTimeout = 60000; // 1 minute idle timeout

  async getBrowser(): Promise<Browser> {
    // Find an available browser
    const available = this.pool.find(instance => !instance.inUse);

    if (available) {
      available.inUse = true;
      available.lastUsed = Date.now();
      return available.browser;
    }

    // Create new browser if under max limit
    if (this.pool.length < this.maxInstances) {
      const browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
        ],
      });

      const instance: BrowserInstance = {
        browser,
        inUse: true,
        lastUsed: Date.now(),
      };

      this.pool.push(instance);
      return browser;
    }

    // Wait for an available browser
    await new Promise(resolve => setTimeout(resolve, 1000));
    return this.getBrowser();
  }

  releaseBrowser(browser: Browser) {
    const instance = this.pool.find(i => i.browser === browser);
    if (instance) {
      instance.inUse = false;
      instance.lastUsed = Date.now();
    }
  }

  async cleanup() {
    const now = Date.now();
    for (let i = this.pool.length - 1; i >= 0; i--) {
      const instance = this.pool[i];
      if (!instance) continue;
      if (!instance.inUse && now - instance.lastUsed > this.idleTimeout) {
        await instance.browser.close();
        this.pool.splice(i, 1);
      }
    }
  }

  async closeAll() {
    await Promise.all(this.pool.map(instance => instance.browser.close()));
    this.pool = [];
  }
}

// Singleton browser pool
const browserPool = new BrowserPool();

// Clean up idle browsers every minute
setInterval(() => browserPool.cleanup(), 60000);

export interface ScrapeOptions {
  url: string;
  selector?: string;
  autoDetect?: boolean;
  waitForSelector?: string;
  timeout?: number;
}

export interface ScrapedData {
  [key: string]: string | null;
}

type ScrapeFailureStage = 'launch' | 'navigation' | 'extraction' | 'unknown';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

function isBrowserUnavailableError(message: string): boolean {
  const normalized = message.toLowerCase();

  return [
    'could not find chrome',
    'could not find expected browser',
    'browser was not found',
    'failed to launch the browser process',
    'failed to launch chrome',
    'chrome executable',
    'spawn',
    'enoent',
  ].some(fragment => normalized.includes(fragment));
}

function getFailureStage(error: unknown, page: Page | null): ScrapeFailureStage {
  const message = getErrorMessage(error).toLowerCase();

  if (!page || isBrowserUnavailableError(message)) {
    return 'launch';
  }

  if (message.includes('navigation') || message.includes('net::') || message.includes('timeout')) {
    return 'navigation';
  }

  return 'extraction';
}

// Common patterns for auto-detection
const AUTO_DETECT_PATTERNS = [
  // E-commerce products
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
  // News articles
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
  // Tables
  {
    name: 'table-rows',
    container: 'table tbody tr',
    fields: {
      cells: 'td',
    },
  },
  // Lists
  {
    name: 'list-items',
    container: 'ul li, ol li, .list-item',
    fields: {
      text: '*',
      link: 'a',
    },
  },
];

function finalizeDynamicPattern(patternName: string | undefined, rows: ScrapedData[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const title = row.title ?? row.text;
    const link = row.link;
    const image = row.image;

    if (typeof link === 'string') {
      const lower = link.toLowerCase();
      if (lower.startsWith('#') || lower.startsWith('javascript:') || lower.includes('adservice.') || lower.includes('/event/api/') || /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(lower)) {
        row.link = null;
      }
    }

    if (typeof image === 'string') {
      const lower = image.toLowerCase();
      if (lower.includes('adservice.') || lower.includes('/event/api/') || lower.includes('/banners/') || lower.includes('badge_copy')) {
        row.image = null;
      }
    }

    if (patternName === 'products') {
      if (!title || String(title).length < 12) return false;
      if (!row.link && !row.price) return false;
      if (typeof row.link === 'string' && !(/\/[^\s"']+-p-[a-z0-9]+/i.test(row.link) || /\/p-[a-z0-9]+/i.test(row.link) || /HBCV/i.test(row.link))) {
        row.link = null;
        if (!row.price) return false;
      }
    }

    const key = `${row.title ?? row.text ?? ''}::${row.link ?? row.image ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function extractData(page: Page, selector: string): Promise<ScrapedData[]> {
  return await page.evaluate((sel) => {
    const elements = Array.from(document.querySelectorAll(sel));
    return elements.map((el) => {
      const element = el as Element;
      const data: { [key: string]: string | null } = {};

      // Extract text content
      data.text = element.textContent?.trim() || null;

      // Extract href if it's a link or contains a link
      const link = element.tagName === 'A' ? element : element.querySelector('a');
      if (link) {
        data.link = (link as HTMLAnchorElement).href;
      }

      // Extract image if present
      const img = element.tagName === 'IMG' ? element : element.querySelector('img');
      if (img) {
        data.image = (img as HTMLImageElement).src;
        data.imageAlt = (img as HTMLImageElement).alt;
      }

      // Extract data attributes
      Array.from(element.attributes).forEach((attr) => {
        if (attr.name.startsWith('data-')) {
          data[attr.name] = attr.value;
        }
      });

      return data;
    });
  }, selector);
}

async function autoDetectAndExtract(page: Page): Promise<{ pattern: string; data: ScrapedData[] }> {
  for (const pattern of AUTO_DETECT_PATTERNS) {
    try {
      const containerCount = await page.evaluate((sel) => {
        return document.querySelectorAll(sel).length;
      }, pattern.container);

      // Pattern is valid if we find at least 3 instances
      if (containerCount >= 3) {
        const data = await page.evaluate((pat) => {
          const containers = Array.from(document.querySelectorAll(pat.container));
          return containers.map((containerNode) => {
            const container = containerNode as Element;
            const result: { [key: string]: string | null } = {};

            for (const [fieldName, fieldSelector] of Object.entries(pat.fields)) {
              if (fieldSelector === '*') {
                result[fieldName] = container.textContent?.trim() || null;
              } else if (fieldSelector === 'td') {
                // Special handling for table cells
                const cells = Array.from(container.querySelectorAll('td'));
                cells.forEach((cellNode, index) => {
                  const cell = cellNode as Element;
                  result[`column_${index}`] = cell.textContent?.trim() || null;
                });
              } else {
                const el = container.querySelector(fieldSelector);
                if (el) {
                  if (el.tagName === 'IMG') {
                    result[fieldName] = (el as HTMLImageElement).src;
                  } else if (el.tagName === 'A') {
                    result[fieldName] = (el as HTMLAnchorElement).href;
                  } else {
                    result[fieldName] = el.textContent?.trim() || null;
                  }
                }
              }
            }

            return result;
          });
        }, pattern);

        const finalized = finalizeDynamicPattern(pattern.name, data);
        if (finalized.length > 0) {
          console.log(`ℹ️ Puppeteer scraper selected pattern '${pattern.name}' with ${finalized.length}/${data.length} rows`);
          return { pattern: pattern.name, data: finalized };
        }
      }
    } catch (err) {
      // Pattern didn't match, continue to next
      continue;
    }
  }

  // Fallback: extract all text content from body
  const fallbackData = await page.evaluate(() => {
    return [{
      title: document.title,
      text: document.body.textContent?.trim() || '',
    }];
  });

  return { pattern: 'fallback', data: fallbackData };
}

export async function scrapeWithPuppeteer(options: ScrapeOptions): Promise<{
  success: boolean;
  data?: ScrapedData[];
  pattern?: string;
  error?: string;
  html?: string;
  browserUnavailable?: boolean;
  failureStage?: ScrapeFailureStage;
  userMessage?: string;
}> {
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    browser = await browserPool.getBrowser();
    page = await browser.newPage();

    // Set reasonable viewport
    await page.setViewport({ width: 1920, height: 1080 });

    // Set user agent to avoid bot detection
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Navigate to URL
    await page.goto(options.url, {
      waitUntil: 'networkidle0',
      timeout: options.timeout || 30000,
    });

    // Wait for specific selector if provided
    if (options.waitForSelector) {
      await page.waitForSelector(options.waitForSelector, {
        timeout: 10000,
      });
    }

    // Get page HTML for fallback
    const html = await page.content();

    let result: { pattern?: string; data: ScrapedData[] };

    if (options.autoDetect) {
      // Auto-detect common patterns
      result = await autoDetectAndExtract(page);
    } else if (options.selector) {
      // Use provided selector
      const data = await extractData(page, options.selector);
      result = { data };
    } else {
      // Default: try auto-detect
      result = await autoDetectAndExtract(page);
    }

    await page.close();

    return {
      success: true,
      data: result.data,
      pattern: result.pattern,
      html,
    };
  } catch (error) {
    console.error('Puppeteer scraping error:', error);

    const errorMessage = getErrorMessage(error);
    const browserUnavailable = isBrowserUnavailableError(errorMessage);
    const failureStage = getFailureStage(error, page);

    if (page) {
      try {
        await page.close();
      } catch (e) {
        // Ignore close errors
      }
    }

    return {
      success: false,
      error: errorMessage,
      browserUnavailable,
      failureStage,
      userMessage: browserUnavailable
        ? 'Tarayici motoru mevcut degil, statik HTML modu deneniyor.'
        : 'Dinamik tarama tamamlanamadi, statik HTML modu deneniyor.',
    };
  } finally {
    if (browser) {
      browserPool.releaseBrowser(browser);
    }
  }
}

// Cleanup on process exit
process.on('SIGINT', async () => {
  await browserPool.closeAll();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await browserPool.closeAll();
  process.exit(0);
});

export { browserPool };
