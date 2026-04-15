import { coinGeckoClient } from '../services/crypto/coingecko';
import { cryptoCache } from '../cache/crypto-cache';

const REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Refresh crypto data from CoinGecko API
 */
export async function refreshCryptoData(): Promise<void> {
  try {
    console.log('🔄 Refreshing crypto data...');

    const data = await coinGeckoClient.fetchAllData();
    await cryptoCache.set(data);

    console.log(`✓ Crypto data refreshed: ${data.coins.length} coins loaded`);
  } catch (error) {
    console.error('❌ Error refreshing crypto data:', error);
  }
}

/**
 * Start the crypto refresh cron job
 */
export function startCryptoCron(): void {
  // Initial fetch
  refreshCryptoData();

  // Set up interval
  setInterval(refreshCryptoData, REFRESH_INTERVAL);

  console.log(`✓ Crypto cron job started (refresh every ${REFRESH_INTERVAL / 1000}s)`);
}

/**
 * Get data with cache fallback
 * Returns cached data if available, otherwise fetches fresh data
 */
export async function getCryptoData() {
  try {
    // Try to get from cache first
    const cached = await cryptoCache.get();
    if (cached) {
      return cached;
    }

    // Cache miss or expired - fetch fresh data
    console.log('Cache miss - fetching fresh data');
    const data = await coinGeckoClient.fetchAllData();
    await cryptoCache.set(data);

    return {
      coins: data.coins,
      fearGreedIndex: data.fearGreedIndex,
      marketStats: data.marketStats,
      lastUpdated: Date.now(),
    };
  } catch (error) {
    console.error('Error getting crypto data:', error);

    // If we have stale cache data, return it as fallback
    const staleCache = await cryptoCache.getStale();
    if (staleCache) {
      console.log('⚠️ Returning stale cache data due to API error');
      return staleCache;
    }

    throw error;
  }
}
