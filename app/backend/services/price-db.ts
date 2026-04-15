import { getDatabase } from '../db/init';
import type { Database } from 'bun:sqlite';

export interface Product {
  id: number;
  name: string;
  query: string;
  created_at: string;
}

export interface PriceRecord {
  id: number;
  product_id: number;
  source: string;
  price: number;
  currency: string;
  in_stock: boolean;
  url: string | null;
  scraped_at: string;
}

export interface PriceHistoryEntry {
  date: string;
  source: string;
  avg_price: number;
  min_price: number;
  max_price: number;
}

interface PriceRecordInput {
  productId: number;
  source: string;
  price: number;
  currency: string;
  inStock: boolean;
  url: string;
}

/**
 * Database service for price tracking
 */
export class PriceDatabase {
  private db: Database;

  constructor() {
    this.db = getDatabase();
  }

  /**
   * Save or get existing product by query
   */
  saveProduct(name: string, query: string): Product {
    const normalizedQuery = query.toLowerCase().trim();

    // Check if product exists
    const existing = this.db
      .prepare('SELECT * FROM products WHERE query = ?')
      .get(normalizedQuery) as Product | undefined;

    if (existing) {
      return existing;
    }

    // Insert new product
    this.db
      .prepare('INSERT INTO products (name, query) VALUES (?, ?)')
      .run(name, normalizedQuery);

    const id = this.db.query('SELECT last_insert_rowid() as id').get() as { id: number };

    return {
      id: id.id,
      name,
      query: normalizedQuery,
      created_at: new Date().toISOString(),
    };
  }

  /**
   * Save price record for a product
   */
  savePriceRecord(
    productId: number,
    source: string,
    price: number,
    currency: string,
    inStock: boolean,
    url: string
  ): PriceRecord {
    this.db
      .prepare(
        `INSERT INTO price_records (product_id, source, price, currency, in_stock, url)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(productId, source, price, currency, inStock ? 1 : 0, url);

    const id = this.db.query('SELECT last_insert_rowid() as id').get() as { id: number };

    return {
      id: id.id,
      product_id: productId,
      source,
      price,
      currency,
      in_stock: inStock,
      url,
      scraped_at: new Date().toISOString(),
    };
  }

  /**
   * Save multiple price records in a transaction
   */
  savePriceRecordsBatch(
    records: PriceRecordInput[]
  ): void {
    const insert = this.db.prepare(
      `INSERT INTO price_records (product_id, source, price, currency, in_stock, url)
       VALUES (?, ?, ?, ?, ?, ?)`
    );

    const transaction = this.db.transaction((batch: PriceRecordInput[]) => {
      for (const record of batch) {
        insert.run(
          record.productId,
          record.source,
          record.price,
          record.currency,
          record.inStock ? 1 : 0,
          record.url
        );
      }
    });

    transaction(records);
  }

  /**
   * Get latest prices for a product across all sources
   */
  getLatestPrices(productId: number): PriceRecord[] {
    return this.db
      .prepare(
        `SELECT pr.*
         FROM price_records pr
         INNER JOIN (
           SELECT source, MAX(scraped_at) as max_scraped_at
           FROM price_records
           WHERE product_id = ?
           GROUP BY source
         ) latest ON pr.source = latest.source AND pr.scraped_at = latest.max_scraped_at
         WHERE pr.product_id = ?
         ORDER BY pr.price ASC`
      )
      .all(productId, productId) as PriceRecord[];
  }

  /**
   * Get price history for a product from a specific source
   */
  getPriceHistory(
    productId: number,
    source: string,
    days = 30
  ): PriceHistoryEntry[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // First try to get from aggregated history table
    const history = this.db
      .prepare(
        `SELECT date, source, avg_price, min_price, max_price
         FROM price_history
         WHERE product_id = ? AND source = ? AND date >= ?
         ORDER BY date DESC`
      )
      .all(productId, source, cutoffDate.toISOString().split('T')[0] ?? cutoffDate.toISOString()) as PriceHistoryEntry[];

    if (history.length > 0) {
      return history;
    }

    // Fallback: aggregate from price_records
    return this.db
      .prepare(
        `SELECT
           DATE(scraped_at) as date,
           source,
           AVG(price) as avg_price,
           MIN(price) as min_price,
           MAX(price) as max_price
         FROM price_records
         WHERE product_id = ? AND source = ? AND scraped_at >= ?
         GROUP BY DATE(scraped_at), source
         ORDER BY date DESC`
      )
      .all(productId, source, cutoffDate.toISOString()) as PriceHistoryEntry[];
  }

  /**
   * Get all price history for a product (all sources)
   */
  getAllPriceHistory(productId: number, days = 30): PriceHistoryEntry[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return this.db
      .prepare(
        `SELECT
           DATE(scraped_at) as date,
           source,
           AVG(price) as avg_price,
           MIN(price) as min_price,
           MAX(price) as max_price
         FROM price_records
         WHERE product_id = ? AND scraped_at >= ?
         GROUP BY DATE(scraped_at), source
         ORDER BY date DESC, source`
      )
      .all(productId, cutoffDate.toISOString()) as PriceHistoryEntry[];
  }

  /**
   * Find product by query
   */
  findProductByQuery(query: string): Product | null {
    const normalizedQuery = query.toLowerCase().trim();
    return (
      (this.db
        .prepare('SELECT * FROM products WHERE query = ?')
        .get(normalizedQuery) as Product | undefined) || null
    );
  }

  /**
   * Clean old price records (keep only last N days)
   */
  cleanOldRecords(daysToKeep = 90): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = this.db
      .prepare(
        'DELETE FROM price_records WHERE scraped_at < ?'
      )
      .run(cutoffDate.toISOString());

    console.log(`✓ Cleaned ${result.changes} old price records`);
    return result.changes;
  }

  /**
   * Aggregate daily price history
   * Should be run daily to populate price_history table
   */
  aggregateDailyHistory(): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO price_history (product_id, source, date, avg_price, min_price, max_price)
         SELECT
           product_id,
           source,
           DATE(scraped_at) as date,
           AVG(price) as avg_price,
           MIN(price) as min_price,
           MAX(price) as max_price
         FROM price_records
         WHERE DATE(scraped_at) = DATE('now', '-1 day')
         GROUP BY product_id, source, DATE(scraped_at)`
      )
      .run();

    console.log('✓ Daily price history aggregated');
  }

  /**
   * Get database statistics
   */
  getStats() {
    const productCount = (
      this.db.prepare('SELECT COUNT(*) as count FROM products').get() as {
        count: number;
      }
    ).count;

    const priceRecordCount = (
      this.db.prepare('SELECT COUNT(*) as count FROM price_records').get() as {
        count: number;
      }
    ).count;

    const historyCount = (
      this.db.prepare('SELECT COUNT(*) as count FROM price_history').get() as {
        count: number;
      }
    ).count;

    return {
      products: productCount,
      priceRecords: priceRecordCount,
      historyEntries: historyCount,
    };
  }
}

// Export singleton instance
export const priceDb = new PriceDatabase();
