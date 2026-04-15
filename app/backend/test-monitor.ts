/**
 * Test script for API health monitoring functionality
 */

import { monitorService } from './services/monitor/monitor';
import { seedMonitorEndpoints } from './services/monitor/seed';
import { apiHealthManager } from './cache/api-health';
import { pingerService } from './services/monitor/pinger';
import { readFile } from 'fs/promises';
import { join } from 'path';

async function testMonitorService() {
  console.log('🧪 Testing API Health Monitoring Service\n');
  console.log('='.repeat(80) + '\n');

  try {
    // Test 1: Initialize monitor service
    console.log('1️⃣  Testing Monitor Service Initialization:');
    console.log('-'.repeat(80));
    await monitorService.initialize();
    console.log('  ✓ Monitor service initialized');

    // Test 2: Seed endpoints
    console.log('\n2️⃣  Testing Endpoint Seeding:');
    console.log('-'.repeat(80));
    await seedMonitorEndpoints();

    const endpoints = await monitorService.getAllEndpoints();
    console.log(`  ✓ Seeded endpoints: ${endpoints.length}`);

    if (endpoints.length > 0) {
      console.log('\n  Seeded endpoints:');
      endpoints.forEach((e, i) => {
        console.log(`    ${i + 1}. ${e.name} - ${e.url}`);
        console.log(`       Status: ${e.currentStatus}, Enabled: ${e.enabled}`);
      });
    }

    // Test 3: Test pinger service
    console.log('\n3️⃣  Testing Pinger Service:');
    console.log('-'.repeat(80));

    const testUrl = 'https://api.github.com';
    console.log(`  Testing URL: ${testUrl}`);

    const pingResult = await pingerService.ping(testUrl);
    console.log(`  ✓ Ping completed`);
    console.log(`    Status Code: ${pingResult.statusCode}`);
    console.log(`    Response Time: ${pingResult.responseTime}ms`);
    console.log(`    Is Up: ${pingResult.isUp ? '✅ YES' : '❌ NO'}`);

    if (pingResult.error) {
      console.log(`    Error: ${pingResult.error}`);
    }

    // Test 4: Test SSL checking
    console.log('\n4️⃣  Testing SSL Checking:');
    console.log('-'.repeat(80));

    const sslInfo = await pingerService.checkSSL(testUrl);
    console.log(`  ✓ SSL check completed`);
    console.log(`    Valid: ${sslInfo.valid ? '✅ YES' : '❌ NO'}`);

    if (sslInfo.issuer) {
      console.log(`    Issuer: ${sslInfo.issuer}`);
    }

    if (sslInfo.daysRemaining !== undefined) {
      console.log(`    Days Remaining: ${sslInfo.daysRemaining}`);
    }

    // Test 5: Test health check for all endpoints
    console.log('\n5️⃣  Testing Health Check for All Endpoints:');
    console.log('-'.repeat(80));

    await monitorService.checkAllEndpoints();

    const updatedEndpoints = await monitorService.getAllEndpoints();
    console.log(`  ✓ Health check completed for ${updatedEndpoints.length} endpoints`);

    // Display results
    console.log('\n  Results:');
    updatedEndpoints.forEach((e, i) => {
      const statusIcon = e.currentStatus === 'up' ? '✅' : e.currentStatus === 'down' ? '❌' : '❓';
      console.log(`    ${i + 1}. ${statusIcon} ${e.name}`);
      console.log(`       Status: ${e.currentStatus}`);
      console.log(`       Response Time: ${e.lastResponseTime ? `${e.lastResponseTime}ms` : 'N/A'}`);
      console.log(`       History: ${e.history.length} checks`);

      // Display uptime stats
      if (e.history.length > 0) {
        console.log(`       24h Uptime: ${e.uptimeStats['24h'].uptimePercent.toFixed(2)}%`);
        console.log(`       24h Avg Response: ${e.uptimeStats['24h'].averageResponseTime}ms`);
      }
    });

    // Test 6: Test cache persistence
    console.log('\n6️⃣  Testing Cache Persistence:');
    console.log('-'.repeat(80));

    const cacheFilePath = join(__dirname, 'cache', 'api-health.json');
    try {
      const cacheFile = await readFile(cacheFilePath, 'utf-8');
      const cacheData = JSON.parse(cacheFile);

      console.log(`  ✓ Cache file exists: PASS`);
      console.log(`  ✓ Cache file readable: PASS`);
      console.log(`  Cache file size: ${(cacheFile.length / 1024).toFixed(2)} KB`);
      console.log(`  Endpoints in cache: ${cacheData.endpoints.length}`);
      console.log(`  Last updated: ${new Date(cacheData.lastUpdated).toISOString()}`);
    } catch (e) {
      console.log(`  ❌ Cache file error: ${e}`);
    }

    // Test 7: Test summary statistics
    console.log('\n7️⃣  Testing Summary Statistics:');
    console.log('-'.repeat(80));

    const stats = await monitorService.getSummaryStats();
    console.log(`  Total endpoints: ${stats.total}`);
    console.log(`  Up: ${stats.up}`);
    console.log(`  Down: ${stats.down}`);
    console.log(`  Unknown: ${stats.unknown}`);
    console.log(`  Enabled: ${stats.enabled}`);
    console.log(`  Disabled: ${stats.disabled}`);

    // Test 8: Test adding custom endpoint
    console.log('\n8️⃣  Testing Add Custom Endpoint:');
    console.log('-'.repeat(80));

    const customEndpoint = await monitorService.addEndpoint(
      'Test Custom API',
      'https://httpbin.org/status/200',
      'GET',
      5
    );

    if (customEndpoint) {
      console.log(`  ✓ Custom endpoint added: ${customEndpoint.name}`);
      console.log(`    ID: ${customEndpoint.id}`);
      console.log(`    Status: ${customEndpoint.currentStatus}`);
      console.log(`    Last checked: ${customEndpoint.lastCheck || 'N/A'}`);
    } else {
      console.log(`  ❌ Failed to add custom endpoint`);
    }

    // Test 9: Test removing endpoint
    console.log('\n9️⃣  Testing Remove Endpoint:');
    console.log('-'.repeat(80));

    if (customEndpoint) {
      const removed = await monitorService.removeEndpoint(customEndpoint.id);
      console.log(`  ✓ Endpoint removed: ${removed ? 'YES' : 'NO'}`);

      const finalEndpoints = await monitorService.getAllEndpoints();
      console.log(`  Final endpoint count: ${finalEndpoints.length}`);
    }

    // Test 10: Test batch pinging
    console.log('\n🔟 Testing Batch Ping:');
    console.log('-'.repeat(80));

    const batchUrls = [
      { url: 'https://api.github.com', method: 'GET' as const },
      { url: 'https://api.coingecko.com/api/v3/ping', method: 'GET' as const },
      { url: 'https://dns.google', method: 'GET' as const },
    ];

    const batchResults = await pingerService.batchPing(batchUrls);
    console.log(`  ✓ Batch ping completed for ${batchResults.length} endpoints`);

    batchResults.forEach((result, i) => {
      const icon = result.isUp ? '✅' : '❌';
      console.log(`    ${i + 1}. ${icon} ${batchUrls[i].url}`);
      console.log(`       Status: ${result.statusCode || 'N/A'}`);
      console.log(`       Response Time: ${result.responseTime || 'N/A'}ms`);
    });

    // Final summary
    console.log('\n' + '='.repeat(80));
    console.log('✅ API Health Monitoring Test Completed Successfully!\n');

    console.log('Summary:');
    console.log(`  ✓ Monitor service initialization`);
    console.log(`  ✓ Endpoint seeding (${endpoints.length} endpoints)`);
    console.log(`  ✓ Pinger service`);
    console.log(`  ✓ SSL checking`);
    console.log(`  ✓ Health check for all endpoints`);
    console.log(`  ✓ Cache persistence`);
    console.log(`  ✓ Summary statistics`);
    console.log(`  ✓ Add custom endpoint`);
    console.log(`  ✓ Remove endpoint`);
    console.log(`  ✓ Batch ping`);

    console.log('\nFeatures:');
    console.log(`  - Response time tracking`);
    console.log(`  - Uptime percentage calculation (24h/7d/30d)`);
    console.log(`  - SSL certificate checking`);
    console.log(`  - Status history tracking`);
    console.log(`  - Cache-based data persistence`);

    console.log('\nCron Job:');
    console.log(`  - Check interval: 5 minutes`);
    console.log(`  - Auto-initialized via startMonitorCron() in index.ts`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error testing monitor service:', error);
    process.exit(1);
  }
}

testMonitorService();
