// Redis connection settings for BullMQ job queue and caching
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Parse Redis URL to get connection options
function parseRedisUrl(url: string) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname,
      port: parseInt(parsed.port) || 6379,
      password: parsed.password || undefined,
      db: parsed.pathname ? parseInt(parsed.pathname.slice(1)) || 0 : 0,
    };
  } catch {
    // Fallback for simple host:port format
    return {
      host: 'localhost',
      port: 6379,
    };
  }
}

const connectionOptions = parseRedisUrl(REDIS_URL);

export const redisOptions = {
  ...connectionOptions,
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
};

export async function probeRedisConnection(timeoutMs = 1500): Promise<boolean> {
  const client = new Redis({
    ...redisOptions,
    lazyConnect: true,
    connectTimeout: timeoutMs,
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
  });

  try {
    await client.connect();
    await client.ping();
    console.log('✅ Redis connected successfully');
    return true;
  } catch (error) {
    console.warn('⚠️ Redis unavailable, queue jobs will run inline');
    return false;
  } finally {
    client.disconnect();
  }
}

export default redisOptions;
