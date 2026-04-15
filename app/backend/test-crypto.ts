import { coinGeckoClient } from './services/crypto/coingecko';
import { cryptoCache } from './cache/crypto-cache';
import { getCryptoData } from './cron/crypto';

async function testCryptoIntegration() {
  console.log('\n=== Testing CoinGecko API Integration ===\n');

  try {
    // Test 1: Initialize cache
    console.log('1. Initializing cache...');
    await cryptoCache.initialize();
    console.log('✓ Cache initialized\n');

    // Test 2: Fetch top coins
    console.log('2. Fetching top 10 coins from CoinGecko...');
    const coins = await coinGeckoClient.getTopCoins(10);
    console.log(`✓ Fetched ${coins.length} coins`);
    console.log('Top 3 coins:');
    coins.slice(0, 3).forEach((coin, i) => {
      console.log(`  ${i + 1}. ${coin.name} (${coin.symbol.toUpperCase()}): $${coin.current_price.toLocaleString()}`);
    });
    console.log();

    // Test 3: Fetch Fear & Greed Index
    console.log('3. Fetching Fear & Greed Index...');
    const fearGreed = await coinGeckoClient.getFearGreedIndex();
    console.log(`✓ Fear & Greed Index: ${fearGreed.value} (${fearGreed.value_classification})`);
    console.log();

    // Test 4: Fetch Market Stats
    console.log('4. Fetching market statistics...');
    const marketStats = await coinGeckoClient.getMarketStats();
    console.log(`✓ Total Market Cap: $${(marketStats.total_market_cap / 1e12).toFixed(2)}T`);
    console.log(`  BTC Dominance: ${marketStats.btc_dominance.toFixed(2)}%`);
    console.log(`  ETH Dominance: ${marketStats.eth_dominance.toFixed(2)}%`);
    console.log();

    // Test 5: Test cache write and read
    console.log('5. Testing cache...');
    const allData = await coinGeckoClient.fetchAllData();
    await cryptoCache.set(allData);
    console.log('✓ Data cached');

    const cachedData = await cryptoCache.get();
    if (cachedData) {
      console.log(`✓ Cache read successful (${cachedData.coins.length} coins, age: ${cryptoCache.getCacheAge()}s)`);
    } else {
      console.log('⚠️ Cache read failed');
    }
    console.log();

    // Test 6: Test getCryptoData function
    console.log('6. Testing getCryptoData function...');
    const data = await getCryptoData();
    console.log(`✓ getCryptoData returned ${data.coins.length} coins`);
    console.log(`  Last updated: ${new Date(data.lastUpdated).toISOString()}`);
    console.log();

    console.log('=== All Tests Passed ✓ ===\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
testCryptoIntegration();
