import { BaseScraper, type ProductResult } from './base';
import * as cheerio from 'cheerio';
import { SCRAPER_CONFIG } from '../config/scrapers';
import { evaluateInBrowser, fetchPageWithBrowser } from './browser';

export class TrendyolScraper extends BaseScraper {
  private readonly baseUrl = 'https://www.trendyol.com';

  getSource(): string {
    return 'trendyol';
  }

  async search(query: string): Promise<ProductResult[]> {
    return this.retry(async () => {
      await this.rateLimit();

      const searchUrl = `${this.baseUrl}/sr?q=${encodeURIComponent(query)}`;
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
        console.warn(`Trendyol static search failed, trying browser fallback...`, error instanceof Error ? error.message : error);
      }

      const staticResults = html ? this.parseProducts(html) : [];
      if (staticResults.length > 0) {
        return staticResults;
      }

      const browserResults = await evaluateInBrowser(searchUrl, userAgent, () => {
        const state = (window as any)['__single-search-result__PROPS'];
        const products = state?.data?.products || [];

        return products.slice(0, 24).map((product: any) => ({
          name: [product?.brand, product?.name].filter(Boolean).join(' ').trim(),
          price: product?.price?.discountedPrice || product?.price?.current || 0,
          currency: product?.price?.currency || 'TRY',
          inStock: !product?.tagStockBar?.isSoldOut,
          url: product?.url ? `https://www.trendyol.com${product.url}` : '',
          imageUrl: product?.image || '',
          rating: product?.ratingScore?.averageRating,
          reviewCount: product?.ratingScore?.totalCount,
        }));
      });

      if (browserResults.some((product) => product.name && product.price > 0)) {
        return browserResults
          .filter((product) => product.name && product.price > 0)
          .slice(0, SCRAPER_CONFIG.MAX_PRODUCTS_PER_SOURCE);
      }

      html = await fetchPageWithBrowser(searchUrl, userAgent);
      return this.parseProducts(html);
    });
  }

  private parseProducts(html: string): ProductResult[] {
    const $ = cheerio.load(html);
    const products: ProductResult[] = [];

    // Trendyol product cards
    $('.p-card-wrppr, .p-card-chldrn-cntnr').each((_, element) => {
      try {
        const $el = $(element);

        // Product name
        const nameEl = $el.find('.prdct-desc-cntnr-name, .product-name');
        const name = this.cleanProductName(nameEl.text());

        if (!name) return;

        // Price
        const priceEl = $el.find('.prc-box-dscntd, .price-box');
        const priceText = priceEl.text().trim();
        const price = this.normalizePrice(priceText);

        if (price === 0) return;

        // Product URL
        const linkEl = $el.find('a[href*="/p-"]');
        const relativeUrl = linkEl.attr('href');
        const url = relativeUrl
          ? `${this.baseUrl}${relativeUrl}`
          : '';

        // Image
        const imgEl = $el.find('img.p-card-img');
        const imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || '';

        // Stock status
        const inStock = !$el.find('.stokta-yok, .out-of-stock').length;

        // Rating
        const ratingEl = $el.find('.rating-score, .stars');
        const ratingText = ratingEl.text().trim();
        const rating = parseFloat(ratingText) || undefined;

        // Review count
        const reviewEl = $el.find('.ratings-count, .comment-count');
        const reviewText = reviewEl.text().replace(/[()]/g, '').trim();
        const reviewCount = parseInt(reviewText) || undefined;

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
        console.warn('Error parsing Trendyol product:', error);
      }
    });

    if (products.length === 0) {
      const scriptedProducts = this.parseProductsFromScriptState(html);
      if (scriptedProducts.length > 0) {
        console.log(`Parsed ${scriptedProducts.length} products from Trendyol script state`);
        return scriptedProducts.slice(0, SCRAPER_CONFIG.MAX_PRODUCTS_PER_SOURCE);
      }
    }

    console.log(`Parsed ${products.length} products from Trendyol`);
    return products.slice(0, SCRAPER_CONFIG.MAX_PRODUCTS_PER_SOURCE);
  }

  private parseProductsFromScriptState(html: string): ProductResult[] {
    const stateMatch = html.match(/window\["__single-search-result__PROPS"\]=({[\s\S]*?});/);
    if (!stateMatch?.[1]) return [];

    try {
      const state = JSON.parse(stateMatch[1]) as {
        data?: {
          products?: Array<{
            brand?: string;
            name?: string;
            price?: {
              current?: number;
              discountedPrice?: number;
              currency?: string;
            };
            tagStockBar?: {
              isSoldOut?: boolean;
            };
            image?: string;
            ratingScore?: {
              averageRating?: number;
              totalCount?: number;
            };
            url?: string;
          }>;
        };
      };

      return (state.data?.products || [])
        .map((product) => {
          const productName = [product.brand, product.name]
            .filter(Boolean)
            .join(' ')
            .trim();
          const price = product.price?.discountedPrice || product.price?.current || 0;

          return {
            name: this.cleanProductName(productName),
            price,
            currency: product.price?.currency || 'TRY',
            inStock: !product.tagStockBar?.isSoldOut,
            url: product.url ? `${this.baseUrl}${product.url}` : '',
            imageUrl: product.image || '',
            rating: product.ratingScore?.averageRating,
            reviewCount: product.ratingScore?.totalCount,
          } satisfies ProductResult;
        })
        .filter((product) => product.name && product.price > 0);
    } catch (error) {
      console.warn('Error parsing Trendyol script state:', error);
      return [];
    }
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

      const name = this.cleanProductName($('h1.pr-new-br').text());
      const priceText = $('.prc-box-dscntd, .price-box').text();
      const price = this.normalizePrice(priceText);

      const inStock = !$('.stokta-yok').length;
      const imageUrl = $('img.product-image').attr('src') || '';

      const ratingText = $('.rating-score').text();
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
