/**
 * Product Normalization and Validation
 * Ensures data consistency across different scraper sources
 */

import type { ProductResult } from './base';

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class ProductNormalizer {
  private readonly MIN_PRICE = 1;
  private readonly MAX_PRICE = 1000000;
  private readonly MIN_NAME_LENGTH = 3;
  private readonly MAX_NAME_LENGTH = 500;

  /**
   * Validate a product result
   */
  validate(product: ProductResult): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required fields
    if (!product.name || product.name.trim().length === 0) {
      errors.push('Product name is required');
    } else if (product.name.length < this.MIN_NAME_LENGTH) {
      errors.push(`Product name too short (min ${this.MIN_NAME_LENGTH} chars)`);
    } else if (product.name.length > this.MAX_NAME_LENGTH) {
      warnings.push(`Product name very long (${product.name.length} chars)`);
    }

    if (typeof product.price !== 'number' || isNaN(product.price)) {
      errors.push('Price must be a valid number');
    } else if (product.price < this.MIN_PRICE) {
      errors.push(`Price too low (min ${this.MIN_PRICE})`);
    } else if (product.price > this.MAX_PRICE) {
      warnings.push(`Price very high (${product.price})`);
    }

    if (!product.currency) {
      errors.push('Currency is required');
    } else if (!['TRY', 'USD', 'EUR', 'GBP'].includes(product.currency)) {
      warnings.push(`Unusual currency: ${product.currency}`);
    }

    if (typeof product.inStock !== 'boolean') {
      errors.push('inStock must be a boolean');
    }

    if (!product.url) {
      warnings.push('Product URL is missing');
    } else {
      try {
        new URL(product.url);
      } catch {
        errors.push('Invalid product URL format');
      }
    }

    // Optional fields
    if (product.imageUrl) {
      try {
        new URL(product.imageUrl);
      } catch {
        warnings.push('Invalid image URL format');
      }
    }

    if (product.rating !== undefined) {
      if (typeof product.rating !== 'number' || isNaN(product.rating)) {
        warnings.push('Rating should be a number');
      } else if (product.rating < 0 || product.rating > 5) {
        warnings.push('Rating should be between 0 and 5');
      }
    }

    if (product.reviewCount !== undefined) {
      if (typeof product.reviewCount !== 'number' || isNaN(product.reviewCount)) {
        warnings.push('Review count should be a number');
      } else if (product.reviewCount < 0) {
        warnings.push('Review count should be non-negative');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Normalize a product result
   */
  normalize(product: ProductResult): ProductResult {
    return {
      ...product,
      name: this.normalizeName(product.name),
      price: this.normalizePrice(product.price),
      currency: product.currency.toUpperCase(),
      url: this.normalizeUrl(product.url),
      imageUrl: product.imageUrl ? this.normalizeUrl(product.imageUrl) : undefined,
      rating: product.rating !== undefined ? this.normalizeRating(product.rating) : undefined,
      reviewCount: product.reviewCount !== undefined ? Math.max(0, Math.floor(product.reviewCount)) : undefined,
    };
  }

  /**
   * Normalize product name
   */
  private normalizeName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .replace(/[^\w\s\-.,()\/]/g, '') // Remove special chars except common ones
      .substring(0, this.MAX_NAME_LENGTH);
  }

  /**
   * Normalize price
   */
  private normalizePrice(price: number): number {
    // Round to 2 decimal places
    return Math.round(price * 100) / 100;
  }

  /**
   * Normalize rating
   */
  private normalizeRating(rating: number): number {
    // Clamp between 0 and 5, round to 1 decimal
    const clamped = Math.max(0, Math.min(5, rating));
    return Math.round(clamped * 10) / 10;
  }

  /**
   * Normalize URL
   */
  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // Remove tracking parameters
      const trackingParams = ['ref', 'utm_source', 'utm_medium', 'utm_campaign', 'fbclid', 'gclid'];
      trackingParams.forEach(param => parsed.searchParams.delete(param));
      return parsed.toString();
    } catch {
      return url;
    }
  }

  /**
   * Batch validate and normalize products
   */
  processProducts(products: ProductResult[]): {
    valid: ProductResult[];
    invalid: Array<{ product: ProductResult; errors: string[] }>;
    warnings: Array<{ product: ProductResult; warnings: string[] }>;
  } {
    const valid: ProductResult[] = [];
    const invalid: Array<{ product: ProductResult; errors: string[] }> = [];
    const warnings: Array<{ product: ProductResult; warnings: string[] }> = [];

    for (const product of products) {
      const validation = this.validate(product);

      if (validation.valid) {
        const normalized = this.normalize(product);
        valid.push(normalized);

        if (validation.warnings.length > 0) {
          warnings.push({
            product: normalized,
            warnings: validation.warnings,
          });
        }
      } else {
        invalid.push({
          product,
          errors: validation.errors,
        });
      }
    }

    return { valid, invalid, warnings };
  }

  /**
   * Deduplicate products by similarity
   */
  deduplicate(products: ProductResult[]): ProductResult[] {
    const seen = new Set<string>();
    const unique: ProductResult[] = [];

    for (const product of products) {
      // Create a signature based on normalized name and similar price
      const signature = this.createProductSignature(product);

      if (!seen.has(signature)) {
        seen.add(signature);
        unique.push(product);
      }
    }

    return unique;
  }

  /**
   * Create a product signature for deduplication
   */
  private createProductSignature(product: ProductResult): string {
    // Normalize name: lowercase, remove special chars, remove extra spaces
    const normalizedName = product.name
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Round price to nearest 10 for fuzzy matching
    const fuzzyPrice = Math.round(product.price / 10) * 10;

    return `${normalizedName}:${fuzzyPrice}`;
  }

  /**
   * Sort products by relevance and price
   */
  sort(
    products: ProductResult[],
    criteria: 'price_asc' | 'price_desc' | 'rating' | 'popularity' = 'price_asc'
  ): ProductResult[] {
    const sorted = [...products];

    switch (criteria) {
      case 'price_asc':
        sorted.sort((a, b) => a.price - b.price);
        break;

      case 'price_desc':
        sorted.sort((a, b) => b.price - a.price);
        break;

      case 'rating':
        sorted.sort((a, b) => {
          const ratingA = a.rating ?? 0;
          const ratingB = b.rating ?? 0;
          return ratingB - ratingA;
        });
        break;

      case 'popularity':
        sorted.sort((a, b) => {
          const popA = (a.reviewCount ?? 0) * (a.rating ?? 0);
          const popB = (b.reviewCount ?? 0) * (b.rating ?? 0);
          return popB - popA;
        });
        break;
    }

    return sorted;
  }

  /**
   * Filter products by criteria
   */
  filter(
    products: ProductResult[],
    filters: {
      minPrice?: number;
      maxPrice?: number;
      inStockOnly?: boolean;
      minRating?: number;
      sources?: string[];
    }
  ): ProductResult[] {
    let filtered = [...products];

    if (filters.minPrice !== undefined) {
      filtered = filtered.filter(p => p.price >= filters.minPrice!);
    }

    if (filters.maxPrice !== undefined) {
      filtered = filtered.filter(p => p.price <= filters.maxPrice!);
    }

    if (filters.inStockOnly) {
      filtered = filtered.filter(p => p.inStock);
    }

    if (filters.minRating !== undefined) {
      filtered = filtered.filter(p => (p.rating ?? 0) >= filters.minRating!);
    }

    return filtered;
  }
}

// Export singleton instance
export const productNormalizer = new ProductNormalizer();
