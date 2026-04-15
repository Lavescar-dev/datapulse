import { priceTrackerService } from '../services/price/tracker';

const REFRESH_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

/**
 * Update prices for all tracked products
 */
export async function updateTrackedPrices(): Promise<void> {
  try {
    console.log('🔄 Updating tracked product prices...');

    await priceTrackerService.updateAllProducts();

    console.log('✓ Tracked product prices updated');
  } catch (error) {
    console.error('❌ Error updating tracked prices:', error);
  }
}

/**
 * Start the price tracking cron job
 */
export function startPriceCron(): void {
  // Initial update after a short delay to let the server start
  setTimeout(() => {
    updateTrackedPrices();
  }, 10000); // 10 seconds delay

  // Set up interval (every 6 hours)
  setInterval(updateTrackedPrices, REFRESH_INTERVAL);

  console.log(`✓ Price tracking cron job started (refresh every ${REFRESH_INTERVAL / (60 * 60 * 1000)} hours)`);
}
