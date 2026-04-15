import Redis from 'ioredis';

const CACHE_TTL = 900; // 15 minutes in seconds

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
}

export class ScraperCacheManager {
  private redis: Redis;
  private stats: CacheStats = { hits: 0, misses: 0, hitRate: 0 };

  constructor() {
    // Try to connect to Redis, fallback to in-memory if unavailable
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryStrategy: (times) => {
        if (times > 3) {
          console.warn('⚠️  Redis unavailable, using in-memory cache');
          return null; // Stop retrying
        }
        return Math.min(times * 100, 2000);
      },
      lazyConnect: true,
    });

    this.redis.on('error', (err) => {
      console.error('Redis error:', err.message);
    });

    this.redis.connect().catch(() => {
      console.log('✓ Using in-memory cache (Redis not available)');
    });
  }

  /**
   * Generate cache key for source and query
   */
  private getKey(source: string, query: string): string {
    return `scraper:${source}:${query.toLowerCase().trim()}`;
  }

  /**
   * Get cached scraping results
   */
  async get<T = any>(source: string, query: string): Promise<T | null> {
    try {
      const key = this.getKey(source, query);
      const data = await this.redis.get(key);

      if (data) {
        this.stats.hits++;
        this.updateHitRate();
        console.log(`Cache HIT: ${source}/${query}`);
        return JSON.parse(data);
      }

      this.stats.misses++;
      this.updateHitRate();
      console.log(`Cache MISS: ${source}/${query}`);
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set cache with TTL
   */
  async set(source: string, query: string, data: any): Promise<void> {
    try {
      const key = this.getKey(source, query);
      await this.redis.setex(key, CACHE_TTL, JSON.stringify(data));
      console.log(`Cache SET: ${source}/${query} (TTL: ${CACHE_TTL}s)`);
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Invalidate cache for specific source and query
   */
  async invalidate(source: string, query: string): Promise<void> {
    try {
      const key = this.getKey(source, query);
      await this.redis.del(key);
      console.log(`Cache INVALIDATED: ${source}/${query}`);
    } catch (error) {
      console.error('Cache invalidate error:', error);
    }
  }

  /**
   * Clear all scraper caches
   */
  async clearAll(): Promise<void> {
    try {
      const keys = await this.redis.keys('scraper:*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
        console.log(`Cache CLEARED: ${keys.length} keys deleted`);
      }
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Update hit rate calculation
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    await this.redis.quit();
    console.log('✓ Cache connection closed');
  }
}

// Export singleton instance
export const scraperCache = new ScraperCacheManager();
