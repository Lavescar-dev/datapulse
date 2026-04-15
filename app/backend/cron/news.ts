import { parseAllFeeds } from '../services/news/rss-parser';
import { newsCache } from '../cache/news-cache';

const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes in milliseconds

/**
 * Refresh news data from RSS feeds
 */
export async function refreshNewsData(): Promise<void> {
  try {
    console.log('🔄 Refreshing news data...');

    const articles = await parseAllFeeds();
    await newsCache.set(articles);

    console.log(`✓ News data refreshed: ${articles.length} articles loaded`);
  } catch (error) {
    console.error('❌ Error refreshing news data:', error);
  }
}

/**
 * Start the news refresh cron job
 */
export function startNewsCron(): void {
  // Initial fetch
  refreshNewsData();

  // Set up interval
  setInterval(refreshNewsData, REFRESH_INTERVAL);

  console.log(`✓ News cron job started (refresh every ${REFRESH_INTERVAL / 1000}s)`);
}

/**
 * Get data with cache fallback
 * Returns cached data if available, otherwise fetches fresh data
 */
export async function getNewsData() {
  try {
    // Try to get from cache first
    const cached = await newsCache.get();
    if (cached) {
      return cached;
    }

    // Cache miss or expired - fetch fresh data
    console.log('News cache miss - fetching fresh data');
    const articles = await parseAllFeeds();
    await newsCache.set(articles);

    return {
      articles,
      lastUpdated: Date.now(),
    };
  } catch (error) {
    console.error('Error getting news data:', error);

    // If we have stale cache data, return it as fallback
    const staleCache = await newsCache.get();
    if (staleCache) {
      console.log('⚠️ Returning stale news cache data due to API error');
      return staleCache;
    }

    throw error;
  }
}
