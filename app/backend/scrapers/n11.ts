import { BaseScraper, type ProductResult } from './base';
import * as cheerio from 'cheerio';
import { SCRAPER_CONFIG } from '../config/scrapers';
import { fetchPageWithBrowser } from './browser';

export class N11Scraper extends BaseScraper {
  private readonly baseUrl = 'https://www.n11.com';

  getSource(): string {
    return 'n11';
  }

  async search(query: string): Promise<ProductResult[]> {
    return this.retry(async () => {
      await this.rateLimit();

      const searchUrl = `${this.baseUrl}/arama?q=${encodeURIComponent(query)}`;
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
        console.warn(`N11 static search failed, trying browser fallback...`, error instanceof Error ? error.message : error);
        html = await fetchPageWithBrowser(searchUrl, userAgent);
      }

      return this.parseProducts(html);
    });
  }

  private parseProducts(html: string): ProductResult[] {
    const $ = cheerio.load(html);
    const products: ProductResult[] = [];

    // N11 product cards
    $('.searchResultContainer .searchResults a.product-item, .columnContent li.column').each((_, element) => {
      try {
        const $el = $(element);

        // Product name
        const nameEl = $el.find('.product-item-title, .productName, h3.title');
        const name = this.cleanProductName(nameEl.text());

        if (!name) return;

        // Price
        const priceEl = $el.find('.basket-price .price, .newPrice, .priceContainer ins').first();
        const priceText = priceEl.text().trim();
        const price = this.normalizePrice(priceText);

        if (price === 0) return;

        // Product URL
        const relativeUrl = $el.is('a[href*="/urun/"]')
          ? $el.attr('href')
          : $el.find('a[href*="/urun/"]').first().attr('href');
        const url = relativeUrl && relativeUrl.startsWith('http')
          ? relativeUrl
          : relativeUrl
          ? `${this.baseUrl}${relativeUrl}`
          : '';

        // Image
        const imgEl = $el.find('img.listing-items-image, img.lazy, img.productImage').first();
        const imageUrl = imgEl.attr('src') || imgEl.attr('data-original') || '';

        // Stock status
        const inStock = !$el.find('.soldOut, .stokta-yok').length && !/stokta yok|tükendi|tukendi/i.test($el.text());

        // Rating
        const ratingWidth = $el.find('.rate-stars-active').attr('style') || '';
        const ratingMatch = ratingWidth.match(/width:\s*([0-9.]+)%/i);
        const rating = ratingMatch?.[1] ? Number(ratingMatch[1]) / 20 : undefined;

        // Review count
        const reviewEl = $el.find('.rate-number-text, .ratingCont em, .commentCount').first();
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
        console.warn('Error parsing N11 product:', error);
      }
    });

    console.log(`Parsed ${products.length} products from N11`);
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

      const name = this.cleanProductName($('h1.proName').text());
      const priceText = $('.newPrice, ins').text();
      const price = this.normalizePrice(priceText);

      const inStock = !$('.soldOut').length;
      const imageUrl = $('#imgZoom').attr('src') || '';

      const ratingText = $('.ratingCont span').text();
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
