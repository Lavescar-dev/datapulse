import { monitorService } from './monitor';

/**
 * Seed pre-configured popular API endpoints for demo purposes
 */
export async function seedMonitorEndpoints(): Promise<void> {
  console.log('🌱 Seeding pre-configured API endpoints...');

  const existingEndpoints = await monitorService.getAllEndpoints();

  if (existingEndpoints.length > 0) {
    console.log('✓ Endpoints already seeded, skipping...');
    return;
  }

  const endpoints = [
    {
      name: 'GitHub API',
      url: 'https://api.github.com',
      method: 'GET' as const,
      checkInterval: 5,
    },
    {
      name: 'CoinGecko API',
      url: 'https://api.coingecko.com/api/v3/ping',
      method: 'GET' as const,
      checkInterval: 5,
    },
    {
      name: 'Reddit API',
      url: 'https://www.reddit.com/api/v1/me',
      method: 'GET' as const,
      checkInterval: 5,
    },
    {
      name: 'News API',
      url: 'https://newsapi.org/v2/top-headlines?country=us&apiKey=demo',
      method: 'GET' as const,
      checkInterval: 5,
    },
    {
      name: 'Google DNS',
      url: 'https://dns.google',
      method: 'GET' as const,
      checkInterval: 5,
    },
    {
      name: 'Cloudflare DNS',
      url: 'https://1.1.1.1',
      method: 'GET' as const,
      checkInterval: 5,
    },
  ];

  let successCount = 0;
  let failCount = 0;

  for (const endpoint of endpoints) {
    try {
      const added = await monitorService.addEndpoint(
        endpoint.name,
        endpoint.url,
        endpoint.method,
        endpoint.checkInterval
      );

      if (added) {
        console.log(`  ✓ Added: ${endpoint.name}`);
        successCount++;
      } else {
        console.log(`  ✗ Failed: ${endpoint.name}`);
        failCount++;
      }

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`  ✗ Error adding ${endpoint.name}:`, error);
      failCount++;
    }
  }

  console.log(`\n✓ Endpoint seeding complete: ${successCount} added, ${failCount} failed\n`);
}
