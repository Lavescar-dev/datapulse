import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { NewsCache, NewsArticle } from '../../shared/types/news';

const CACHE_FILE_PATH = join(__dirname, 'news.json');
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

export class NewsCacheManager {
  private cache: NewsCache | null = null;
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
      console.log('✓ News cache initialized');
    } catch (error) {
      console.error('Error initializing news cache:', error);
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
        console.log('✓ Loaded news cache from file');
      }
    } catch (error) {
      console.error('Error loading news cache from file:', error);
      this.cache = null;
    }
  }

  /**
   * Save cache to JSON file
   */
  private async saveToFile(cache: NewsCache): Promise<void> {
    try {
      await writeFile(CACHE_FILE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
      console.log('✓ Saved news cache to file');
    } catch (error) {
      console.error('Error saving news cache to file:', error);
    }
  }

  /**
   * Get cached data if valid
   */
  async get(): Promise<NewsCache | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.cache) {
      return null;
    }

    const now = Date.now();
    const cacheAge = now - this.cache.lastUpdated;

    if (cacheAge > CACHE_DURATION) {
      console.log('News cache expired, returning null');
      return null;
    }

    console.log(`News cache hit (age: ${Math.round(cacheAge / 1000)}s)`);
    return this.cache;
  }

  /**
   * Update cache with new data
   */
  async set(articles: NewsArticle[]): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    const cache: NewsCache = {
      articles,
      lastUpdated: Date.now(),
    };

    this.cache = cache;
    await this.saveToFile(cache);
    console.log('✓ News cache updated with fresh data');
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
        console.log('✓ News cache cleared');
      }
    } catch (error) {
      console.error('Error clearing news cache:', error);
    }
  }

  /**
   * Get cache age in seconds
   */
  getCacheAge(): number | null {
    if (!this.cache) return null;
    return Math.round((Date.now() - this.cache.lastUpdated) / 1000);
  }

  /**
   * Get article count
   */
  getArticleCount(): number {
    return this.cache?.articles.length || 0;
  }
}

export const newsCache = new NewsCacheManager();
