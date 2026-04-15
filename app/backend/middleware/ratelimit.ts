import type { Context, Next } from 'hono';

const DEMO_RATE_LIMIT_ENABLED = false;
const DISABLED_REMAINING_SESSIONS = 999;

/**
 * IP-based rate limiting store
 * Tracks session creation attempts per IP address
 */
interface RateLimitEntry {
  count: number;
  firstAttempt: number;
  lastAttempt: number;
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private readonly maxSessionsPerDay = 3;
  private readonly windowMs = 24 * 60 * 60 * 1000; // 24 hours in ms
  private readonly cleanupInterval = 60 * 60 * 1000; // Clean up every hour

  constructor() {
    // Periodic cleanup of old entries
    setInterval(() => this.cleanup(), this.cleanupInterval);
  }

  /**
   * Check if IP has exceeded rate limit
   */
  isRateLimited(ip: string): boolean {
    if (!DEMO_RATE_LIMIT_ENABLED) {
      return false;
    }

    const entry = this.store.get(ip);

    if (!entry) {
      return false;
    }

    const now = Date.now();
    const windowStart = now - this.windowMs;

    // If first attempt is outside the window, reset
    if (entry.firstAttempt < windowStart) {
      this.store.delete(ip);
      return false;
    }

    // Check if limit exceeded
    return entry.count >= this.maxSessionsPerDay;
  }

  /**
   * Record a session creation attempt
   */
  recordAttempt(ip: string): void {
    if (!DEMO_RATE_LIMIT_ENABLED) {
      return;
    }

    const now = Date.now();
    const entry = this.store.get(ip);

    if (!entry) {
      this.store.set(ip, {
        count: 1,
        firstAttempt: now,
        lastAttempt: now,
      });
      return;
    }

    const windowStart = now - this.windowMs;

    // If first attempt is outside the window, reset
    if (entry.firstAttempt < windowStart) {
      this.store.set(ip, {
        count: 1,
        firstAttempt: now,
        lastAttempt: now,
      });
      return;
    }

    // Increment count
    entry.count++;
    entry.lastAttempt = now;
  }

  /**
   * Get remaining sessions for an IP
   */
  getRemainingSessions(ip: string): number {
    if (!DEMO_RATE_LIMIT_ENABLED) {
      return DISABLED_REMAINING_SESSIONS;
    }

    const entry = this.store.get(ip);

    if (!entry) {
      return this.maxSessionsPerDay;
    }

    const now = Date.now();
    const windowStart = now - this.windowMs;

    // If first attempt is outside the window, full limit available
    if (entry.firstAttempt < windowStart) {
      return this.maxSessionsPerDay;
    }

    return Math.max(0, this.maxSessionsPerDay - entry.count);
  }

  /**
   * Get time until rate limit resets (in seconds)
   */
  getResetTime(ip: string): number {
    if (!DEMO_RATE_LIMIT_ENABLED) {
      return 0;
    }

    const entry = this.store.get(ip);

    if (!entry) {
      return 0;
    }

    const now = Date.now();
    const resetAt = entry.firstAttempt + this.windowMs;
    const secondsRemaining = Math.max(0, Math.floor((resetAt - now) / 1000));

    return secondsRemaining;
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    for (const [ip, entry] of this.store.entries()) {
      if (entry.firstAttempt < windowStart) {
        this.store.delete(ip);
      }
    }
  }

  /**
   * Get current store size (for monitoring)
   */
  getStoreSize(): number {
    return this.store.size;
  }

  /**
   * Clear all entries (for testing)
   */
  clear(): void {
    this.store.clear();
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();

/**
 * Rate limiting middleware for session creation
 * Limits to 3 demo sessions per IP per day
 */
export async function rateLimitMiddleware(c: Context, next: Next) {
  if (!DEMO_RATE_LIMIT_ENABLED) {
    await next();
    return;
  }

  const ip = getClientIP(c);

  if (rateLimiter.isRateLimited(ip)) {
    const resetTime = rateLimiter.getResetTime(ip);
    const hours = Math.floor(resetTime / 3600);
    const minutes = Math.floor((resetTime % 3600) / 60);

    return c.json(
      {
        error: 'Rate limit exceeded',
        message: `Maximum 3 demo sessions per day. Try again in ${hours}h ${minutes}m.`,
        resetTime,
      },
      429
    );
  }

  await next();
}

/**
 * Extract client IP address from request
 * Checks various headers for proxy scenarios
 */
export function getClientIP(c: Context): string {
  // Check X-Forwarded-For header (from proxies/load balancers)
  const forwardedFor = c.req.header('x-forwarded-for');
  if (forwardedFor) {
    // Take the first IP in the chain
    return forwardedFor.split(',')[0]?.trim() || 'unknown';
  }

  // Check X-Real-IP header (nginx)
  const realIP = c.req.header('x-real-ip');
  if (realIP) {
    return realIP;
  }

  // Check CF-Connecting-IP (Cloudflare)
  const cfIP = c.req.header('cf-connecting-ip');
  if (cfIP) {
    return cfIP;
  }

  // Fallback to direct connection IP
  // Note: This may not be accurate behind proxies
  return 'unknown';
}
