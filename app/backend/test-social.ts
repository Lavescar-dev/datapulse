/**
 * Test script for social media integrations
 * Run with: bun run app/backend/test-social.ts
 */

import { fetchRedditPosts } from './services/social/reddit';
import { fetchHackerNewsPosts } from './services/social/hackernews';
import { fetchGitHubPosts } from './services/social/github';
import { fetchYouTubePosts, isYouTubeConfigured } from './services/social/youtube';

async function testSocialIntegrations() {
  console.log('🧪 Testing Social Media Integrations...\n');

  // Test Reddit
  console.log('=' .repeat(60));
  console.log('Testing Reddit Integration');
  console.log('=' .repeat(60));
  const redditPosts = await fetchRedditPosts();
  console.log(`\n✓ Reddit: ${redditPosts.length} posts fetched`);
  if (redditPosts.length > 0) {
    console.log(`  Sample: "${redditPosts[0].title}"`);
    console.log(`  Platform: ${redditPosts[0].platform}`);
    console.log(`  Score: ${redditPosts[0].score}`);
    console.log(`  Metadata: ${redditPosts[0].metadata}`);
  }

  // Test Hacker News
  console.log('\n' + '=' .repeat(60));
  console.log('Testing Hacker News Integration');
  console.log('=' .repeat(60));
  const hackerNewsPosts = await fetchHackerNewsPosts();
  console.log(`\n✓ Hacker News: ${hackerNewsPosts.length} posts fetched`);
  if (hackerNewsPosts.length > 0) {
    console.log(`  Sample: "${hackerNewsPosts[0].title}"`);
    console.log(`  Platform: ${hackerNewsPosts[0].platform}`);
    console.log(`  Score: ${hackerNewsPosts[0].score}`);
    console.log(`  Metadata: ${hackerNewsPosts[0].metadata}`);
    console.log(`  Comments: ${hackerNewsPosts[0].commentsCount}`);
  }

  // Test GitHub
  console.log('\n' + '=' .repeat(60));
  console.log('Testing GitHub Integration');
  console.log('=' .repeat(60));
  const githubPosts = await fetchGitHubPosts();
  console.log(`\n✓ GitHub: ${githubPosts.length} posts fetched`);
  if (githubPosts.length > 0) {
    console.log(`  Sample: "${githubPosts[0].title}"`);
    console.log(`  Platform: ${githubPosts[0].platform}`);
    console.log(`  Score: ${githubPosts[0].score} (stars this period)`);
    console.log(`  Language: ${githubPosts[0].metadata}`);
    console.log(`  Description: ${githubPosts[0].description?.substring(0, 80)}...`);
  }

  // Test YouTube
  console.log('\n' + '=' .repeat(60));
  console.log('Testing YouTube Integration');
  console.log('=' .repeat(60));
  if (isYouTubeConfigured()) {
    const youtubePosts = await fetchYouTubePosts();
    console.log(`\n✓ YouTube: ${youtubePosts.length} posts fetched`);
    if (youtubePosts.length > 0) {
      console.log(`  Sample: "${youtubePosts[0].title}"`);
      console.log(`  Platform: ${youtubePosts[0].platform}`);
      console.log(`  Score: ${youtubePosts[0].score} (views/1000)`);
      console.log(`  Channel: ${youtubePosts[0].metadata}`);
    }
  } else {
    console.log('\n⚠️  YouTube API key not configured');
    console.log('  Set YOUTUBE_API_KEY in .env to enable YouTube trending');
    console.log('  Get a free API key at: https://console.developers.google.com/');
  }

  // Summary
  console.log('\n' + '=' .repeat(60));
  console.log('Summary');
  console.log('=' .repeat(60));
  const total = redditPosts.length + hackerNewsPosts.length + githubPosts.length;
  console.log(`Total posts fetched: ${total}`);
  console.log(`  - Reddit: ${redditPosts.length}`);
  console.log(`  - Hacker News: ${hackerNewsPosts.length}`);
  console.log(`  - GitHub: ${githubPosts.length}`);
  if (isYouTubeConfigured()) {
    const youtubePosts = await fetchYouTubePosts();
    console.log(`  - YouTube: ${youtubePosts.length}`);
  } else {
    console.log(`  - YouTube: 0 (not configured)`);
  }

  console.log('\n✅ Social media integration tests complete!\n');
}

// Run tests
testSocialIntegrations().catch(console.error);
