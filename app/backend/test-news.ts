/**
 * Test script for news RSS parsing, categorization, and sentiment analysis
 */

import { parseAllFeeds } from './services/news/rss-parser';
import { getCategoryCounts } from './services/news/categorizer';
import { getSentimentDistribution, calculateSentimentScore } from './services/news/sentiment';

async function testNews() {
  console.log('🧪 Testing News RSS Parser, Categorizer, and Sentiment Analysis\n');
  console.log('='.repeat(80) + '\n');

  try {
    // Parse all RSS feeds
    const articles = await parseAllFeeds();

    console.log('\n📊 RSS Feed Parsing Results:');
    console.log('-'.repeat(80));
    console.log(`Total articles parsed: ${articles.length}`);

    if (articles.length === 0) {
      console.log('❌ No articles were parsed. Check RSS sources and network connectivity.');
      return;
    }

    // Test categorization
    console.log('\n📂 Category Distribution:');
    console.log('-'.repeat(80));
    const categoryCounts = getCategoryCounts(articles);
    for (const [category, count] of Object.entries(categoryCounts)) {
      console.log(`  ${category.padEnd(10)}: ${count} articles`);
    }

    // Test sentiment analysis
    console.log('\n😊 Sentiment Analysis:');
    console.log('-'.repeat(80));
    const sentimentDist = getSentimentDistribution(articles);
    console.log(`  Positive: ${sentimentDist.positive} articles`);
    console.log(`  Negative: ${sentimentDist.negative} articles`);
    console.log(`  Neutral:  ${sentimentDist.neutral} articles`);
    const overallScore = calculateSentimentScore(articles);
    console.log(`  Overall Sentiment Score: ${overallScore}/100`);

    // Sample articles from each category
    console.log('\n📰 Sample Articles (showing 3 per category):');
    console.log('-'.repeat(80));

    const categories = ['Tech', 'Finance', 'Crypto', 'World', 'Turkey', 'General'] as const;
    for (const category of categories) {
      const categoryArticles = articles.filter(a => a.category === category).slice(0, 3);
      if (categoryArticles.length > 0) {
        console.log(`\n[${category}]:`);
        for (const article of categoryArticles) {
          console.log(`  - ${article.title}`);
          console.log(`    Source: ${article.sourceName} | Sentiment: ${article.sentiment}`);
          console.log(`    ${article.description.substring(0, 100)}...`);
        }
      }
    }

    // Test sentiment assignments
    console.log('\n🎯 Sentiment Assignment Verification:');
    console.log('-'.repeat(80));
    console.log('Sample positive articles:');
    const positiveArticles = articles.filter(a => a.sentiment === 'positive').slice(0, 2);
    for (const article of positiveArticles) {
      console.log(`  ✅ ${article.title} (${article.sourceName})`);
    }

    console.log('\nSample negative articles:');
    const negativeArticles = articles.filter(a => a.sentiment === 'negative').slice(0, 2);
    for (const article of negativeArticles) {
      console.log(`  ❌ ${article.title} (${article.sourceName})`);
    }

    console.log('\nSample neutral articles:');
    const neutralArticles = articles.filter(a => a.sentiment === 'neutral').slice(0, 2);
    for (const article of neutralArticles) {
      console.log(`  ⚪ ${article.title} (${article.sourceName})`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ News module test completed successfully!');

  } catch (error) {
    console.error('❌ Error testing news module:', error);
    process.exit(1);
  }
}

testNews();
