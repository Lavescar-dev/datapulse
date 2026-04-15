/**
 * Test script for dashboard builder functionality
 */

import { dashboardManager } from './cache/dashboard';
import { widgetService } from './services/dashboard/widgets';
import {
  getAllTemplates,
  getTemplateById,
  createDashboardFromTemplate,
} from './services/dashboard/templates';
import type { WidgetConfig } from '../shared/types/dashboard';

async function testDashboardService() {
  console.log('🧪 Testing Dashboard Builder Service\n');
  console.log('='.repeat(80) + '\n');

  try {
    // Test 1: Initialize dashboard manager
    console.log('1️⃣  Testing Dashboard Manager Initialization:');
    console.log('-'.repeat(80));
    await dashboardManager.initialize();
    console.log('  ✓ Dashboard manager initialized');

    const metadata = await dashboardManager.getCacheMetadata();
    console.log(`  Total Dashboards: ${metadata.totalDashboards}`);
    console.log(`  Template Dashboards: ${metadata.templateDashboards}`);
    console.log(`  Admin Dashboards: ${metadata.adminDashboards}`);
    console.log(`  Demo Dashboards: ${metadata.demoDashboards}`);

    // Test 2: Test dashboard templates
    console.log('\n2️⃣  Testing Dashboard Templates:');
    console.log('-'.repeat(80));

    const templates = getAllTemplates();
    console.log(`  ✓ Found ${templates.length} pre-made templates`);

    templates.forEach((template, i) => {
      console.log(`\n  ${i + 1}. ${template.name}`);
      console.log(`     ID: ${template.id}`);
      console.log(`     Category: ${template.category}`);
      console.log(`     Description: ${template.description}`);
      console.log(`     Widgets: ${template.widgets.length}`);
    });

    // Test 3: Create dashboard from template
    console.log('\n3️⃣  Testing Create Dashboard from Template:');
    console.log('-'.repeat(80));

    const templateId = 'crypto-overview';
    const templateData = createDashboardFromTemplate(templateId, 'My Crypto Dashboard');

    if (templateData) {
      console.log(`  ✓ Created dashboard from template: ${templateId}`);
      console.log(`    Name: ${templateData.name}`);
      console.log(`    Widgets: ${templateData.widgets.length}`);

      const dashboard = await dashboardManager.createDashboard({
        ...templateData,
        createdBy: 'demo',
      });

      console.log(`    Dashboard ID: ${dashboard.id}`);
      console.log(`    Created At: ${dashboard.createdAt}`);
    }

    // Test 4: Create custom dashboard
    console.log('\n4️⃣  Testing Create Custom Dashboard:');
    console.log('-'.repeat(80));

    const customDashboard = await dashboardManager.createDashboard({
      name: 'Test Custom Dashboard',
      description: 'A custom test dashboard',
      widgets: [
        {
          id: 'test-widget-1',
          type: 'stat',
          source: 'crypto',
          title: 'Test Widget',
          x: 0,
          y: 0,
          w: 4,
          h: 2,
        },
      ],
      createdBy: 'admin',
    });

    console.log(`  ✓ Created custom dashboard: ${customDashboard.name}`);
    console.log(`    ID: ${customDashboard.id}`);
    console.log(`    Widgets: ${customDashboard.widgets.length}`);

    // Test 5: Update dashboard
    console.log('\n5️⃣  Testing Update Dashboard:');
    console.log('-'.repeat(80));

    const updatedDashboard = await dashboardManager.updateDashboard(customDashboard.id, {
      name: 'Updated Custom Dashboard',
      description: 'Updated description',
    });

    if (updatedDashboard) {
      console.log(`  ✓ Updated dashboard: ${updatedDashboard.name}`);
      console.log(`    New Description: ${updatedDashboard.description}`);
      console.log(`    Updated At: ${updatedDashboard.updatedAt}`);
    }

    // Test 6: Add widget to dashboard
    console.log('\n6️⃣  Testing Add Widget to Dashboard:');
    console.log('-'.repeat(80));

    const newWidget: WidgetConfig = {
      id: 'test-widget-2',
      type: 'chart',
      source: 'news',
      title: 'News Chart',
      x: 4,
      y: 0,
      w: 6,
      h: 3,
      chartType: 'line',
      limit: 10,
    };

    const dashboardWithNewWidget = await dashboardManager.addWidget(
      customDashboard.id,
      newWidget
    );

    if (dashboardWithNewWidget) {
      console.log(`  ✓ Added widget to dashboard`);
      console.log(`    Total Widgets: ${dashboardWithNewWidget.widgets.length}`);
    }

    // Test 7: Remove widget from dashboard
    console.log('\n7️⃣  Testing Remove Widget from Dashboard:');
    console.log('-'.repeat(80));

    const dashboardAfterRemoval = await dashboardManager.removeWidget(
      customDashboard.id,
      'test-widget-1'
    );

    if (dashboardAfterRemoval) {
      console.log(`  ✓ Removed widget from dashboard`);
      console.log(`    Remaining Widgets: ${dashboardAfterRemoval.widgets.length}`);
    }

    // Test 8: Test widget data fetching (crypto)
    console.log('\n8️⃣  Testing Widget Data Fetching (Crypto):');
    console.log('-'.repeat(80));

    try {
      const cryptoWidget: WidgetConfig = {
        id: 'test-crypto-widget',
        type: 'table',
        source: 'crypto',
        title: 'Top Cryptos',
        x: 0,
        y: 0,
        w: 6,
        h: 4,
        limit: 5,
      };

      const cryptoData = await widgetService.fetchWidgetData(cryptoWidget);
      console.log(`  ✓ Fetched crypto widget data`);
      console.log(`    Coins: ${cryptoData.coins?.length || 0}`);

      if (cryptoData.coins && cryptoData.coins.length > 0) {
        console.log('\n    Top 3 Coins:');
        cryptoData.coins.slice(0, 3).forEach((coin, i) => {
          console.log(`      ${i + 1}. ${coin.name} (${coin.symbol})`);
          console.log(`         Price: $${coin.price.toLocaleString()}`);
          console.log(`         24h Change: ${coin.change24h.toFixed(2)}%`);
        });
      }
    } catch (error) {
      console.log(`  ⚠️  Crypto data not available (cache may be empty): ${error.message}`);
    }

    // Test 9: Test widget data fetching (news)
    console.log('\n9️⃣  Testing Widget Data Fetching (News):');
    console.log('-'.repeat(80));

    try {
      const newsWidget: WidgetConfig = {
        id: 'test-news-widget',
        type: 'list',
        source: 'news',
        title: 'Latest News',
        x: 0,
        y: 0,
        w: 6,
        h: 4,
        limit: 5,
        filters: { category: 'Tech' },
      };

      const newsData = await widgetService.fetchWidgetData(newsWidget);
      console.log(`  ✓ Fetched news widget data`);
      console.log(`    Articles: ${newsData.articles?.length || 0}`);
      console.log(`    Total Count: ${newsData.totalCount}`);

      if (newsData.articles && newsData.articles.length > 0) {
        console.log('\n    Recent Articles:');
        newsData.articles.slice(0, 3).forEach((article, i) => {
          console.log(`      ${i + 1}. ${article.title}`);
          console.log(`         Source: ${article.source}`);
          console.log(`         Category: ${article.category}`);
        });
      }
    } catch (error) {
      console.log(`  ⚠️  News data not available (cache may be empty): ${error.message}`);
    }

    // Test 10: Test widget data fetching (price)
    console.log('\n🔟  Testing Widget Data Fetching (Price):');
    console.log('-'.repeat(80));

    try {
      const priceWidget: WidgetConfig = {
        id: 'test-price-widget',
        type: 'table',
        source: 'price',
        title: 'Tracked Products',
        x: 0,
        y: 0,
        w: 8,
        h: 4,
        limit: 5,
      };

      const priceData = await widgetService.fetchWidgetData(priceWidget);
      console.log(`  ✓ Fetched price widget data`);
      console.log(`    Products: ${priceData.products?.length || 0}`);
      console.log(`    Total Count: ${priceData.totalCount}`);

      if (priceData.products && priceData.products.length > 0) {
        console.log('\n    Tracked Products:');
        priceData.products.slice(0, 3).forEach((product, i) => {
          console.log(`      ${i + 1}. ${product.name}`);
          console.log(`         Price: ${product.currentPrice} ${product.currency}`);
          console.log(`         Marketplace: ${product.marketplace}`);
          if (product.priceChangePercent) {
            console.log(`         Change: ${product.priceChangePercent.toFixed(2)}%`);
          }
        });
      }
    } catch (error) {
      console.log(`  ⚠️  Price data not available (cache may be empty): ${error.message}`);
    }

    // Test 11: Test widget data fetching (monitor)
    console.log('\n1️⃣1️⃣  Testing Widget Data Fetching (Monitor):');
    console.log('-'.repeat(80));

    try {
      const monitorWidget: WidgetConfig = {
        id: 'test-monitor-widget',
        type: 'table',
        source: 'monitor',
        title: 'API Status',
        x: 0,
        y: 0,
        w: 8,
        h: 3,
        limit: 5,
      };

      const monitorData = await widgetService.fetchWidgetData(monitorWidget);
      console.log(`  ✓ Fetched monitor widget data`);
      console.log(`    Endpoints: ${monitorData.endpoints?.length || 0}`);
      console.log(`    Summary - Total: ${monitorData.summary.total}, Up: ${monitorData.summary.up}, Down: ${monitorData.summary.down}`);

      if (monitorData.endpoints && monitorData.endpoints.length > 0) {
        console.log('\n    Monitored Endpoints:');
        monitorData.endpoints.slice(0, 3).forEach((endpoint, i) => {
          const statusIcon =
            endpoint.status === 'up' ? '✅' : endpoint.status === 'down' ? '❌' : '❓';
          console.log(`      ${i + 1}. ${statusIcon} ${endpoint.name}`);
          console.log(`         URL: ${endpoint.url}`);
          console.log(`         Status: ${endpoint.status}`);
          if (endpoint.uptime24h) {
            console.log(`         24h Uptime: ${endpoint.uptime24h.toFixed(2)}%`);
          }
        });
      }
    } catch (error) {
      console.log(`  ⚠️  Monitor data not available (cache may be empty): ${error.message}`);
    }

    // Test 12: Test multiple widget fetch
    console.log('\n1️⃣2️⃣  Testing Fetch Multiple Widgets:');
    console.log('-'.repeat(80));

    const multipleWidgets: WidgetConfig[] = [
      {
        id: 'multi-crypto',
        type: 'stat',
        source: 'crypto',
        title: 'Fear & Greed',
        x: 0,
        y: 0,
        w: 4,
        h: 2,
        dataKey: 'fearGreedIndex',
      },
      {
        id: 'multi-news',
        type: 'list',
        source: 'news',
        title: 'News',
        x: 4,
        y: 0,
        w: 4,
        h: 2,
        limit: 5,
      },
    ];

    const multipleResults = await widgetService.fetchMultipleWidgets(multipleWidgets);
    console.log(`  ✓ Fetched data for ${multipleResults.size} widgets`);

    multipleResults.forEach((data, widgetId) => {
      if (data.error) {
        console.log(`    ${widgetId}: ⚠️  ${data.error}`);
      } else {
        console.log(`    ${widgetId}: ✓ Success`);
      }
    });

    // Test 13: Clone dashboard
    console.log('\n1️⃣3️⃣  Testing Clone Dashboard:');
    console.log('-'.repeat(80));

    const clonedDashboard = await dashboardManager.cloneDashboard(
      customDashboard.id,
      'Cloned Dashboard',
      'demo'
    );

    if (clonedDashboard) {
      console.log(`  ✓ Cloned dashboard: ${clonedDashboard.name}`);
      console.log(`    Original ID: ${customDashboard.id}`);
      console.log(`    Cloned ID: ${clonedDashboard.id}`);
      console.log(`    Widgets: ${clonedDashboard.widgets.length}`);
    }

    // Test 14: Export dashboard
    console.log('\n1️⃣4️⃣  Testing Export Dashboard:');
    console.log('-'.repeat(80));

    const exportedJson = await dashboardManager.exportDashboard(customDashboard.id);

    if (exportedJson) {
      console.log(`  ✓ Exported dashboard to JSON`);
      console.log(`    JSON Length: ${exportedJson.length} characters`);
    }

    // Test 15: Import dashboard
    console.log('\n1️⃣5️⃣  Testing Import Dashboard:');
    console.log('-'.repeat(80));

    if (exportedJson) {
      const importedDashboard = await dashboardManager.importDashboard(exportedJson, 'admin');

      if (importedDashboard) {
        console.log(`  ✓ Imported dashboard from JSON`);
        console.log(`    Name: ${importedDashboard.name}`);
        console.log(`    ID: ${importedDashboard.id}`);
        console.log(`    Widgets: ${importedDashboard.widgets.length}`);
      }
    }

    // Test 16: Get all dashboards
    console.log('\n1️⃣6️⃣  Testing Get All Dashboards:');
    console.log('-'.repeat(80));

    const allDashboards = await dashboardManager.getAllDashboards();
    console.log(`  ✓ Retrieved ${allDashboards.length} dashboards`);

    console.log('\n  Dashboard List:');
    allDashboards.forEach((dashboard, i) => {
      console.log(`    ${i + 1}. ${dashboard.name}`);
      console.log(`       ID: ${dashboard.id}`);
      console.log(`       Widgets: ${dashboard.widgets.length}`);
      console.log(`       Created By: ${dashboard.createdBy || 'N/A'}`);
      console.log(`       Created At: ${dashboard.createdAt}`);
    });

    // Test 17: Final cache metadata
    console.log('\n1️⃣7️⃣  Final Cache Metadata:');
    console.log('-'.repeat(80));

    const finalMetadata = await dashboardManager.getCacheMetadata();
    console.log(`  Total Dashboards: ${finalMetadata.totalDashboards}`);
    console.log(`  Template Dashboards: ${finalMetadata.templateDashboards}`);
    console.log(`  Admin Dashboards: ${finalMetadata.adminDashboards}`);
    console.log(`  Demo Dashboards: ${finalMetadata.demoDashboards}`);

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('✅ All Dashboard Tests Completed Successfully!\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    throw error;
  }
}

// Run tests
testDashboardService()
  .then(() => {
    console.log('🎉 Dashboard service tests completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Dashboard service tests failed:', error);
    process.exit(1);
  });
