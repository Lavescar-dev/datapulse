import type { SocialPost } from '../../../shared/types/social';

const HN_API_BASE = 'https://hacker-news.firebaseio.com/v0';
const ITEMS_TO_FETCH = 30; // Fetch top 30 stories

interface HNItem {
  id: number;
  deleted?: boolean;
  type: 'job' | 'story' | 'comment' | 'poll' | 'pollopt';
  by?: string;
  time: number;
  text?: string;
  dead?: boolean;
  parent?: number;
  poll?: number;
  kids?: number[];
  url?: string;
  score?: number;
  title?: string;
  parts?: number[];
  descendants?: number; // Comment count
}

/**
 * Fetch a single item from Hacker News API
 */
async function fetchHNItem(id: number): Promise<HNItem | null> {
  try {
    const response = await fetch(`${HN_API_BASE}/item/${id}.json`, {
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      throw new Error(`HN API error: ${response.status} ${response.statusText}`);
    }

    return await response.json() as HNItem;
  } catch (error) {
    console.error(`Error fetching HN item ${id}:`, error);
    return null;
  }
}

/**
 * Fetch story IDs from a specific endpoint
 */
async function fetchStoryIds(endpoint: 'topstories' | 'beststories' | 'newstories'): Promise<number[]> {
  try {
    const response = await fetch(`${HN_API_BASE}/${endpoint}.json`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`HN API error: ${response.status} ${response.statusText}`);
    }

    return await response.json() as number[];
  } catch (error) {
    console.error(`Error fetching HN ${endpoint}:`, error);
    return [];
  }
}

/**
 * Convert HN item to unified SocialPost format
 */
function hnItemToSocialPost(item: HNItem): SocialPost | null {
  // Skip items without title or that are deleted/dead
  if (!item.title || item.deleted || item.dead) {
    return null;
  }

  return {
    id: `hn_${item.id}`,
    platform: 'HackerNews',
    title: item.title,
    url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
    score: item.score || 0,
    metadata: 'Hacker News',
    timestamp: item.time * 1000, // Convert to milliseconds
    author: item.by,
    commentsCount: item.descendants,
    description: item.text,
  };
}

/**
 * Fetch top stories from Hacker News
 */
export async function fetchTopStories(limit: number = ITEMS_TO_FETCH): Promise<SocialPost[]> {
  console.log('📰 Fetching Hacker News top stories...');

  try {
    // Get story IDs
    const storyIds = await fetchStoryIds('topstories');
    const limitedIds = storyIds.slice(0, limit);

    // Fetch story details in parallel
    const items = await Promise.all(
      limitedIds.map(id => fetchHNItem(id))
    );

    // Convert to social posts and filter out nulls
    const posts: SocialPost[] = [];
    for (const item of items) {
      if (item && item.type === 'story') {
        const post = hnItemToSocialPost(item);
        if (post) {
          posts.push(post);
        }
      }
    }

    console.log(`✓ Fetched ${posts.length} Hacker News top stories`);
    return posts;
  } catch (error) {
    console.error('❌ Error fetching HN top stories:', error);
    return [];
  }
}

/**
 * Fetch best stories from Hacker News
 */
export async function fetchBestStories(limit: number = ITEMS_TO_FETCH): Promise<SocialPost[]> {
  console.log('📰 Fetching Hacker News best stories...');

  try {
    // Get story IDs
    const storyIds = await fetchStoryIds('beststories');
    const limitedIds = storyIds.slice(0, limit);

    // Fetch story details in parallel
    const items = await Promise.all(
      limitedIds.map(id => fetchHNItem(id))
    );

    // Convert to social posts and filter out nulls
    const posts: SocialPost[] = [];
    for (const item of items) {
      if (item && item.type === 'story') {
        const post = hnItemToSocialPost(item);
        if (post) {
          posts.push(post);
        }
      }
    }

    console.log(`✓ Fetched ${posts.length} Hacker News best stories`);
    return posts;
  } catch (error) {
    console.error('❌ Error fetching HN best stories:', error);
    return [];
  }
}

/**
 * Fetch combined top and best stories from Hacker News
 * Deduplicates by story ID and sorts by score
 */
export async function fetchHackerNewsPosts(): Promise<SocialPost[]> {
  console.log('🔄 Fetching Hacker News posts...');

  const [topStories, bestStories] = await Promise.all([
    fetchTopStories(20),
    fetchBestStories(20),
  ]);

  // Combine and deduplicate by ID
  const postsMap = new Map<string, SocialPost>();

  for (const post of [...topStories, ...bestStories]) {
    if (!postsMap.has(post.id)) {
      postsMap.set(post.id, post);
    }
  }

  const allPosts = Array.from(postsMap.values());

  // Sort by score (highest first)
  allPosts.sort((a, b) => b.score - a.score);

  // Take top 30
  const finalPosts = allPosts.slice(0, 30);

  console.log(`✓ Successfully fetched ${finalPosts.length} unique Hacker News posts`);
  return finalPosts;
}
