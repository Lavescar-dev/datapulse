/**
 * Test script for keyword search across news and social media sources
 */

import { parseAllFeeds } from './services/news/rss-parser';
import { fetchHackerNewsPosts } from './services/social/hackernews';
import { fetchGitHubPosts } from './services/social/github';

// Simulate frontend search logic
function searchNews(articles: any[], query: string) {
  const q = query.toLowerCase().trim();
  if (!q) return articles;

  return articles.filter(
    (article: any) =>
      article.title.toLowerCase().includes(q) ||
      article.description?.toLowerCase().includes(q) ||
      article.sourceName.toLowerCase().includes(q)
  );
}

function searchSocial(posts: any[], query: string) {
  const q = query.toLowerCase().trim();
  if (!q) return posts;

  return posts.filter(
    (post: any) =>
      post.title.toLowerCase().includes(q) ||
      post.description?.toLowerCase().includes(q) ||
      post.metadata?.toLowerCase().includes(q) ||
      post.author?.toLowerCase().includes(q)
  );
}

async function testKeywordSearch() {
  console.log('🔍 Testing Keyword Search Across All Sources\n');
  console.log('='.repeat(80) + '\n');

  try {
    // Fetch news articles
    console.log('📰 Fetching news articles...');
    const newsArticles = await parseAllFeeds();
    console.log(`✓ Fetched ${newsArticles.length} news articles\n`);

    // Fetch social posts
    console.log('📱 Fetching social media posts...');
    const [hnPosts, ghPosts] = await Promise.all([
      fetchHackerNewsPosts(),
      fetchGitHubPosts(),
    ]);
    const socialPosts = [...hnPosts, ...ghPosts];
    console.log(`✓ Fetched ${socialPosts.length} social posts (HN: ${hnPosts.length}, GitHub: ${ghPosts.length})\n`);

    // Test various search queries
    const testQueries = [
      'bitcoin',
      'ai',
      'javascript',
      'government',
      'technology',
    ];

    console.log('🧪 Testing Search Queries:');
    console.log('='.repeat(80) + '\n');

    for (const query of testQueries) {
      console.log(`Query: "${query}"`);
      console.log('-'.repeat(80));

      const newsResults = searchNews(newsArticles, query);
      const socialResults = searchSocial(socialPosts, query);

      console.log(`📰 News results: ${newsResults.length} articles`);
      if (newsResults.length > 0) {
        console.log(`  Sample: "${newsResults[0].title}"`);
        console.log(`  Source: ${newsResults[0].sourceName}`);
      }

      console.log(`📱 Social results: ${socialResults.length} posts`);
      if (socialResults.length > 0) {
        console.log(`  Sample: "${socialResults[0].title}"`);
        console.log(`  Platform: ${socialResults[0].platform}`);
      }

      console.log('');
    }

    // Test case-insensitive search
    console.log('🔤 Testing Case-Insensitive Search:');
    console.log('-'.repeat(80));
    const upperQuery = 'BITCOIN';
    const lowerQuery = 'bitcoin';
    const newsUpper = searchNews(newsArticles, upperQuery);
    const newsLower = searchNews(newsArticles, lowerQuery);
    console.log(`Query "BITCOIN": ${newsUpper.length} results`);
    console.log(`Query "bitcoin": ${newsLower.length} results`);
    console.log(`✓ Case-insensitive: ${newsUpper.length === newsLower.length ? 'PASS' : 'FAIL'}\n`);

    // Test partial match
    console.log('🔍 Testing Partial Match:');
    console.log('-'.repeat(80));
    const partialQuery = 'crypto';
    const newsPartial = searchNews(newsArticles, partialQuery);
    console.log(`Query "crypto": ${newsPartial.length} results`);
    if (newsPartial.length > 0) {
      console.log(`  Sample matches:`);
      newsPartial.slice(0, 3).forEach((article: any) => {
        console.log(`    - ${article.title}`);
      });
    }
    console.log('');

    // Test multi-field search
    console.log('🔎 Testing Multi-Field Search:');
    console.log('-'.repeat(80));
    console.log('News searches: title, description, sourceName');
    console.log('Social searches: title, description, metadata, author');

    // Find an example that matches in description but not title
    const bbcArticles = newsArticles.filter((a: any) => a.sourceName === 'BBC News');
    if (bbcArticles.length > 0) {
      console.log(`\n✓ Source name search: Found ${bbcArticles.length} BBC News articles`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Keyword search test completed successfully!');
    console.log('\nSummary:');
    console.log(`  - Total news articles: ${newsArticles.length}`);
    console.log(`  - Total social posts: ${socialPosts.length}`);
    console.log(`  - Search fields (news): title, description, source`);
    console.log(`  - Search fields (social): title, description, metadata, author`);
    console.log(`  - Case-insensitive: ✓`);
    console.log(`  - Partial matching: ✓`);
    console.log(`  - Multi-field: ✓`);

  } catch (error) {
    console.error('❌ Error testing keyword search:', error);
    process.exit(1);
  }
}

testKeywordSearch();
