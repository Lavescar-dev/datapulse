import { BaseScraper, type ProductResult } from './base';
import * as cheerio from 'cheerio';
import { SCRAPER_CONFIG } from '../config/scrapers';
import { fetchPageWithBrowser } from './browser';

export class HepsiburadaScraper extends BaseScraper {
  private readonly baseUrl = 'https://www.hepsiburada.com';

  getSource(): string {
    return 'hepsiburada';
  }

  async search(query: string): Promise<ProductResult[]> {
    return this.retry(async () => {
      await this.rateLimit();

      const searchUrl = `${this.baseUrl}/ara?q=${encodeURIComponent(query)}`;
      console.log(`Fetching: ${searchUrl}`);
      const userAgent = this.getRandomUserAgent();
      let html = '';

      try {
        const response = await fetch(searchUrl, {
          headers: {
            'User-Agent': userAgent,
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
            'Cache-Control': 'no-cache',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        html = await response.text();
      } catch (error) {
        console.warn(`Hepsiburada static search failed, trying browser fallback...`, error instanceof Error ? error.message : error);
        html = await fetchPageWithBrowser(searchUrl, userAgent);
      }

      return this.parseProducts(html);
    });
  }

  private parseProducts(html: string): ProductResult[] {
    const $ = cheerio.load(html);
    const products: ProductResult[] = [];

    // Hepsiburada product cards
    $('article[class*="productCard-module_article"], li[class*="productListContent"]').each((_, element) => {
      try {
        const $el = $(element);

        // Product name
        const nameEl = $el.find('[class*="title-module_titleText"], .product-title');
        const name = this.cleanProductName(nameEl.text());

        if (!name) return;

        // Price
        const priceEl = $el.find(
          '[class*="price-module_finalPrice"], [class*="priceSimple-module_priceValue"], [data-test-id="price-current-price"]'
        );
        const priceText = priceEl.text().trim();
        const price = this.normalizePrice(priceText);

        if (price === 0) return;

        // Product URL
        const linkEl = $el.find('a[href*="-p-"], a[href*="/p-"]').first();
        const relativeUrl = linkEl.attr('href');
        const url = relativeUrl
          ? relativeUrl.startsWith('http')
            ? relativeUrl
            : `${this.baseUrl}${relativeUrl}`
          : '';

        // Image
        const imgEl = $el.find('img[src*="productimages.hepsiburada.net"], img[data-test-id="product-card-image"]');
        const imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || '';

        // Stock status
        const inStock = !/stokta yok|tukendi|tükendi/i.test($el.text());

        // Rating
        const ratingEl = $el.find('[class*="rate-module_rating"], [data-test-id="review-rating"]');
        const ratingText = ratingEl.text().trim().replace(',', '.');
        const rating = parseFloat(ratingText) || undefined;

        // Review count
        const reviewEl = $el.find('[class*="rate-module_count"], [data-test-id="review-count"]');
        const reviewText = reviewEl.text().replace(/[()]/g, '').trim();
        const reviewCount = parseInt(reviewText.replace(/[^\d]/g, '')) || undefined;

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
        console.warn('Error parsing Hepsiburada product:', error);
      }
    });

    console.log(`Parsed ${products.length} products from Hepsiburada`);
    return products.slice(0, SCRAPER_CONFIG.MAX_PRODUCTS_PER_SOURCE);
  }

  async getProductDetails(url: string): Promise<ProductResult | null> {
    return this.retry(async () => {
      await this.rateLimit();

      const response = await fetch(url, {
        headers: {
          'User-Agent': this.getRandomUserAgent(),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const name = this.cleanProductName($('h1[id="product-name"]').text());
      const priceText = $('[data-test-id="price-current-price"]').text();
      const price = this.normalizePrice(priceText);

      const inStock = !$('.out-of-stock').length;
      const imageUrl = $('img[data-test-id="product-detail-image"]').attr('src') || '';

      const ratingText = $('.rating-star').text();
      const rating = parseFloat(ratingText) || undefined;

      return {
        name,
        price,
        currency: 'TRY',
        inStock,
        url,
        imageUrl,
        rating,
      };
    });
  }
}
