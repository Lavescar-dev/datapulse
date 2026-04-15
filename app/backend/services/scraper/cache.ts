// URL deduplication cache with 10-minute cooldown
interface CacheEntry {
  url: string;
  timestamp: number;
  jobId?: string;
}

class URLCache {
  private cache = new Map<string, CacheEntry>();
  private cooldownMs = 10 * 60 * 1000; // 10 minutes

  // Normalize URL for comparison (remove trailing slash, query params, etc.)
  private normalizeURL(url: string): string {
    try {
      const urlObj = new URL(url);
      // Use origin + pathname (ignore query and hash for deduplication)
      let normalized = urlObj.origin + urlObj.pathname;
      // Remove trailing slash
      if (normalized.endsWith('/') && normalized.length > 1) {
        normalized = normalized.slice(0, -1);
      }
      return normalized;
    } catch (err) {
      // If URL parsing fails, use original
      return url;
    }
  }

  // Check if URL is in cooldown
  isInCooldown(url: string): boolean {
    const normalized = this.normalizeURL(url);
    const entry = this.cache.get(normalized);

    if (!entry) {
      return false;
    }

    const now = Date.now();
    const elapsed = now - entry.timestamp;

    if (elapsed >= this.cooldownMs) {
      // Cooldown expired, remove from cache
      this.cache.delete(normalized);
      return false;
    }

    return true;
  }

  // Get remaining cooldown time in seconds
  getRemainingCooldown(url: string): number {
    const normalized = this.normalizeURL(url);
    const entry = this.cache.get(normalized);

    if (!entry) {
      return 0;
    }

    const now = Date.now();
    const elapsed = now - entry.timestamp;
    const remaining = this.cooldownMs - elapsed;

    if (remaining <= 0) {
      this.cache.delete(normalized);
      return 0;
    }

    return Math.ceil(remaining / 1000); // Convert to seconds
  }

  // Add URL to cache
  add(url: string, jobId?: string): void {
    const normalized = this.normalizeURL(url);
    this.cache.set(normalized, {
      url: normalized,
      timestamp: Date.now(),
      jobId,
    });
  }

  // Get cache entry
  get(url: string): CacheEntry | undefined {
    const normalized = this.normalizeURL(url);
    const entry = this.cache.get(normalized);

    if (!entry) {
      return undefined;
    }

    // Check if expired
    const now = Date.now();
    const elapsed = now - entry.timestamp;

    if (elapsed >= this.cooldownMs) {
      this.cache.delete(normalized);
      return undefined;
    }

    return entry;
  }

  // Clear expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= this.cooldownMs) {
        this.cache.delete(key);
      }
    }
  }

  // Get cache stats
  getStats() {
    return {
      size: this.cache.size,
      cooldownMinutes: this.cooldownMs / 60000,
    };
  }

  // Clear all cache
  clear(): void {
    this.cache.clear();
  }
}

// Singleton instance
export const urlCache = new URLCache();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  urlCache.cleanup();
}, 5 * 60 * 1000);

export default urlCache;
