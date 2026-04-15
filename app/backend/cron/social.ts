import { fetchRedditPosts } from '../services/social/reddit';
import { fetchHackerNewsPosts } from '../services/social/hackernews';
import { fetchGitHubPosts } from '../services/social/github';
import { fetchYouTubePosts, isYouTubeConfigured } from '../services/social/youtube';
import { socialCache } from '../cache/social-cache';

const REFRESH_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Refresh social media data from all platforms
 */
export async function refreshSocialData(): Promise<void> {
  try {
    console.log('🔄 Refreshing social media data...');

    // Fetch from all platforms in parallel
    const [redditPosts, hackerNewsPosts, githubPosts, youtubePosts] = await Promise.all([
      fetchRedditPosts(),
      fetchHackerNewsPosts(),
      fetchGitHubPosts(),
      isYouTubeConfigured() ? fetchYouTubePosts() : Promise.resolve([]),
    ]);

    // Combine all social posts
    const allPosts = [
      ...redditPosts,
      ...hackerNewsPosts,
      ...githubPosts,
      ...youtubePosts,
    ];

    // Sort by score (highest first)
    allPosts.sort((a, b) => b.score - a.score);

    await socialCache.set(allPosts);

    console.log(`✓ Social data refreshed: ${allPosts.length} posts loaded (Reddit: ${redditPosts.length}, HN: ${hackerNewsPosts.length}, GitHub: ${githubPosts.length}, YouTube: ${youtubePosts.length})`);
  } catch (error) {
    console.error('❌ Error refreshing social data:', error);
  }
}

/**
 * Start the social media refresh cron job
 */
export function startSocialCron(): void {
  // Initial fetch
  refreshSocialData();

  // Set up interval
  setInterval(refreshSocialData, REFRESH_INTERVAL);

  console.log(`✓ Social cron job started (refresh every ${REFRESH_INTERVAL / 1000}s)`);
}

/**
 * Get data with cache fallback
 * Returns cached data if available, otherwise fetches fresh data
 */
export async function getSocialData() {
  try {
    // Try to get from cache first
    const cached = await socialCache.get();
    if (cached) {
      return cached;
    }

    // Cache miss or expired - fetch fresh data
    console.log('Social cache miss - fetching fresh data');
    const [redditPosts, hackerNewsPosts, githubPosts, youtubePosts] = await Promise.all([
      fetchRedditPosts(),
      fetchHackerNewsPosts(),
      fetchGitHubPosts(),
      isYouTubeConfigured() ? fetchYouTubePosts() : Promise.resolve([]),
    ]);

    const allPosts = [
      ...redditPosts,
      ...hackerNewsPosts,
      ...githubPosts,
      ...youtubePosts,
    ];

    allPosts.sort((a, b) => b.score - a.score);

    await socialCache.set(allPosts);

    return {
      posts: allPosts,
      lastUpdated: Date.now(),
    };
  } catch (error) {
    console.error('Error getting social data:', error);

    // If we have stale cache data, return it as fallback
    const staleCache = await socialCache.get();
    if (staleCache) {
      console.log('⚠️ Returning stale social cache data due to API error');
      return staleCache;
    }

    throw error;
  }
}
