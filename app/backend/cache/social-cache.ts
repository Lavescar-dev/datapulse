import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type { SocialCache, SocialPost } from '../../shared/types/social';

const CACHE_FILE_PATH = join(__dirname, 'social.json');
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

export class SocialCacheManager {
  private cache: SocialCache | null = null;
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
      console.log('✓ Social cache initialized');
    } catch (error) {
      console.error('Error initializing social cache:', error);
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
        console.log('✓ Loaded social cache from file');
      }
    } catch (error) {
      console.error('Error loading social cache from file:', error);
      this.cache = null;
    }
  }

  /**
   * Save cache to JSON file
   */
  private async saveToFile(cache: SocialCache): Promise<void> {
    try {
      await writeFile(CACHE_FILE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
      console.log('✓ Saved social cache to file');
    } catch (error) {
      console.error('Error saving social cache to file:', error);
    }
  }

  /**
   * Get cached data if valid
   */
  async get(): Promise<SocialCache | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!this.cache) {
      return null;
    }

    const now = Date.now();
    const cacheAge = now - this.cache.lastUpdated;

    if (cacheAge > CACHE_DURATION) {
      console.log('Social cache expired, returning null');
      return null;
    }

    console.log(`Social cache hit (age: ${Math.round(cacheAge / 1000)}s)`);
    return this.cache;
  }

  /**
   * Update cache with new data
   */
  async set(posts: SocialPost[]): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    const cache: SocialCache = {
      posts,
      lastUpdated: Date.now(),
    };

    this.cache = cache;
    await this.saveToFile(cache);
    console.log('✓ Social cache updated with fresh data');
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
        console.log('✓ Social cache cleared');
      }
    } catch (error) {
      console.error('Error clearing social cache:', error);
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
   * Get post count
   */
  getPostCount(): number {
    return this.cache?.posts.length || 0;
  }

  /**
   * Get posts by platform
   */
  async getByPlatform(platform: string): Promise<SocialPost[]> {
    const cache = await this.get();
    if (!cache) return [];

    return cache.posts.filter(post => post.platform === platform);
  }
}

export const socialCache = new SocialCacheManager();
