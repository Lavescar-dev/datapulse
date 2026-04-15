import { monitorService } from '../services/monitor/monitor';

const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Check health of all monitored endpoints
 */
export async function checkMonitoredEndpoints(): Promise<void> {
  try {
    console.log('🔄 Checking monitored API endpoints...');

    await monitorService.checkAllEndpoints();

    console.log('✓ API endpoint checks completed');
  } catch (error) {
    console.error('❌ Error checking monitored endpoints:', error);
  }
}

/**
 * Start the API monitoring cron job
 */
export function startMonitorCron(): void {
  // Initial check after a short delay to let the server start
  setTimeout(() => {
    checkMonitoredEndpoints();
  }, 15000); // 15 seconds delay

  // Set up interval (every 5 minutes)
  setInterval(checkMonitoredEndpoints, CHECK_INTERVAL);

  console.log(`✓ API monitoring cron job started (check every ${CHECK_INTERVAL / (60 * 1000)} minutes)`);
}
