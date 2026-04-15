import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { CryptoCache, CoinData, FearGreedIndex, MarketStats } from '../../shared/types/crypto';

const CACHE_FILE_PATH = join(__dirname, 'crypto.json');
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds

export class CryptoCacheManager {
  private cache: CryptoCache | null = null;
  private initialized = false;

  /**
   * Initialize cache directory
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Ensure cache directory exists
      const cacheDir = join(__dirname);
      if (!existsSync(cacheDir)) {
        await mkdir(cacheDir, { recursive: true });
      }

      // Load existing cache if available
      await this.loadFromFile();
      this.initialized = true;
      console.log('✓ Crypto cache initialized');
    } catch (error) {
      console.error('Error initializing crypto cache:', error);
      this.initialized = true; // Continue anyway
    }
  }

  /**
   * Load cache from JSON file
   */
  private async loadFromFile(): Promise<void> {
    try {
      if (existsSync(CACHE_FILE_PATH)) {
        const data = await readFile(CACHE_FILE_PATH, 'utf-8');
        this.cache = JSON.parse(data);
        console.log('✓ Loaded crypto cache from file');
      }
    } catch (error) {
      console.error('Error loading cache from file:', error);
      this.cache = null;
    }
  }

  /**
   * Save cache to JSON file
   */
  private async saveToFile(cache: CryptoCache): Promise<void> {
    try {
      await writeFile(CACHE_FILE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
      console.log('✓ Saved crypto cache to file');
    } catch (error) {
      console.error('Error saving cache to file:', error);
    }
  }

  /**
   * Get cached data if valid
   */
  async get(): Promise<CryptoCache | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.cache) {
      return null;
    }

    const now = Date.now();
    const cacheAge = now - this.cache.lastUpdated;

    if (cacheAge > CACHE_DURATION) {
      console.log('Cache expired, returning null');
      return null;
    }

    console.log(`Cache hit (age: ${Math.round(cacheAge / 1000)}s)`);
    return this.cache;
  }

  /**
   * Get cached data regardless of expiration
   */
  async getStale(): Promise<CryptoCache | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.cache) {
      return null;
    }

    const cacheAge = Math.round((Date.now() - this.cache.lastUpdated) / 1000);
    console.log(`Returning stale cache (age: ${cacheAge}s)`);
    return this.cache;
  }

  /**
   * Update cache with new data
   */
  async set(data: {
    coins: CoinData[];
    fearGreedIndex: FearGreedIndex;
    marketStats: MarketStats;
  }): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    const cache: CryptoCache = {
      coins: data.coins,
      fearGreedIndex: data.fearGreedIndex,
      marketStats: data.marketStats,
      lastUpdated: Date.now(),
    };

    this.cache = cache;
    await this.saveToFile(cache);
    console.log('✓ Cache updated with fresh data');
  }

  /**
   * Check if cache is valid
   */
  async isValid(): Promise<boolean> {
    const cache = await this.get();
    return cache !== null;
  }

  /**
   * Force clear cache
   */
  async clear(): Promise<void> {
    this.cache = null;
    try {
      if (existsSync(CACHE_FILE_PATH)) {
        await writeFile(CACHE_FILE_PATH, JSON.stringify(null), 'utf-8');
        console.log('✓ Cache cleared');
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Get cache age in seconds
   */
  getCacheAge(): number | null {
    if (!this.cache) return null;
    return Math.round((Date.now() - this.cache.lastUpdated) / 1000);
  }
}

export const cryptoCache = new CryptoCacheManager();
