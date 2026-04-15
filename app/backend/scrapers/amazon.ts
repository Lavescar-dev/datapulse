import { BaseScraper, type ProductResult } from './base';
import * as cheerio from 'cheerio';
import puppeteer, { type Browser, type Page } from 'puppeteer';
import { SCRAPER_CONFIG } from '../config/scrapers';

export class AmazonTRScraper extends BaseScraper {
  private readonly baseUrl = 'https://www.amazon.com.tr';
  private browser: Browser | null = null;

  getSource(): string {
    return 'amazon';
  }

  /**
   * Initialize Puppeteer browser
   */
  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        ...SCRAPER_CONFIG.PUPPETEER_OPTIONS,
        args: [...SCRAPER_CONFIG.PUPPETEER_OPTIONS.args],
      });
    }
    return this.browser;
  }

  /**
   * Close browser instance
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('✓ Amazon browser closed');
    }
  }

  async search(query: string): Promise<ProductResult[]> {
    return this.retry(async () => {
      await this.rateLimit();

      const browser = await this.getBrowser();
      const page = await browser.newPage();

      try {
        // Set user agent and viewport
        await page.setUserAgent(this.getRandomUserAgent());
        await page.setViewport({ width: 1920, height: 1080 });

        const searchUrl = `${this.baseUrl}/s?k=${encodeURIComponent(query)}`;
        console.log(`Fetching: ${searchUrl}`);

        // Navigate with timeout
        await page.goto(searchUrl, {
          waitUntil: 'domcontentloaded',
          timeout: SCRAPER_CONFIG.SCRAPER_TIMEOUT,
        });
        await page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 }).catch(() => undefined);

        // Wait for product grid to load
        await page.waitForSelector('[data-component-type="s-search-result"]', {
          timeout: 10000,
        }).catch(() => {
          console.warn('Amazon product grid not found, attempting to parse anyway');
        });

        // Get page HTML
        const html = await page.content();

        return this.parseProducts(html);
      } finally {
        await page.close();
      }
    });
  }

  private parseProducts(html: string): ProductResult[] {
    const $ = cheerio.load(html);
    const products: ProductResult[] = [];

    // Amazon product cards
    $('[data-component-type="s-search-result"]').each((_, element) => {
      try {
        const $el = $(element);

        // Product name
        const nameEl = $el.find('h2 a span, .a-text-normal');
        const name = this.cleanProductName(nameEl.first().text());

        if (!name) return;

        // Price - Amazon has multiple price formats
        let priceText = $el.find('.a-price-whole').first().text();
        if (!priceText) {
          priceText = $el.find('.a-price .a-offscreen').first().text();
        }

        const price = this.normalizePrice(priceText);

        if (price === 0) return;

        // Product URL
        const linkEl = $el.find('a[href*="/dp/"]').first();
        const relativeUrl = linkEl.attr('href');
        const url = relativeUrl && relativeUrl.startsWith('http')
          ? relativeUrl
          : relativeUrl
          ? `${this.baseUrl}${relativeUrl}`
          : '';

        // Image
        const imgEl = $el.find('img.s-image');
        const imageUrl = imgEl.attr('src') || '';

        // Stock status (if no price or "Currently unavailable" text)
        const unavailableText = $el.find('.a-color-price, .a-text-unavailable').text();
        const inStock = !unavailableText.toLowerCase().includes('unavailable') &&
                        !unavailableText.toLowerCase().includes('stokta yok');

        // Rating
        const ratingEl = $el.find('.a-icon-star-small span.a-icon-alt');
        const ratingText = ratingEl.text().trim();
        const ratingMatch = ratingText.match(/(\d+[.,]\d+)/);
        const rating = ratingMatch?.[1] ? parseFloat(ratingMatch[1].replace(',', '.')) : undefined;

        // Review count
        const reviewEl = $el.find('[aria-label*="değerlendirme"], [aria-label*="ratings"]');
        const reviewText = reviewEl.attr('aria-label') || '';
        const reviewMatch = reviewText.match(/(\d+[\d.,]*)/);
        const reviewCount = reviewMatch?.[1]
          ? parseInt(reviewMatch[1].replace(/[.,]/g, ''))
          : undefined;

        products.push({
          name,
          price,
          currency: 'TRY',
          inStock,
          url,
          imageUrl,
          rating,
          reviewCount,
        });
      } catch (error) {
        console.warn('Error parsing Amazon product:', error);
      }
    });

    console.log(`Parsed ${products.length} products from Amazon TR`);
    return products.slice(0, SCRAPER_CONFIG.MAX_PRODUCTS_PER_SOURCE);
  }

  async getProductDetails(url: string): Promise<ProductResult | null> {
    return this.retry(async () => {
      await this.rateLimit();

      const browser = await this.getBrowser();
      const page = await browser.newPage();

      try {
        await page.setUserAgent(this.getRandomUserAgent());
        await page.setViewport({ width: 1920, height: 1080 });

        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: SCRAPER_CONFIG.SCRAPER_TIMEOUT,
        });
        await page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 }).catch(() => undefined);

        const html = await page.content();
        const $ = cheerio.load(html);

        const name = this.cleanProductName($('#productTitle').text());

        let priceText = $('.a-price-whole').first().text();
        if (!priceText) {
          priceText = $('.a-price .a-offscreen').first().text();
        }
        const price = this.normalizePrice(priceText);

        const availabilityText = $('#availability span').text().toLowerCase();
        const inStock = !availabilityText.includes('unavailable') &&
                        !availabilityText.includes('stokta yok');

        const imageUrl = $('#landingImage').attr('src') || '';

        const ratingText = $('.a-icon-star span').first().text();
        const ratingMatch = ratingText.match(/(\d+[.,]\d+)/);
        const rating = ratingMatch?.[1] ? parseFloat(ratingMatch[1].replace(',', '.')) : undefined;

        return {
          name,
          price,
          currency: 'TRY',
          inStock,
          url,
          imageUrl,
          rating,
        };
      } finally {
        await page.close();
      }
    });
  }
}
