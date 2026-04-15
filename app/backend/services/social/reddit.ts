import type { RedditPost, SocialPost, SubredditConfig } from '../../../shared/types/social';

/**
 * Default subreddit configuration
 */
export const DEFAULT_SUBREDDITS: SubredditConfig[] = [
  { name: 'programming', displayName: 'r/programming', sort: 'hot' },
  { name: 'technology', displayName: 'r/technology', sort: 'hot' },
  { name: 'CryptoCurrency', displayName: 'r/CryptoCurrency', sort: 'hot' },
  { name: 'worldnews', displayName: 'r/worldnews', sort: 'hot' },
  { name: 'science', displayName: 'r/science', sort: 'hot' },
  { name: 'dataisbeautiful', displayName: 'r/dataisbeautiful', sort: 'hot' },
];

interface RedditApiListing {
  data?: {
    children?: Array<{
      kind?: string;
      data: {
        id: string;
        title: string;
        score?: number;
        num_comments?: number;
        subreddit: string;
        author: string;
        permalink: string;
        url: string;
        created_utc: number;
        thumbnail?: string;
        selftext?: string;
        removed_by_category?: string | null;
      };
    }>;
  };
}

/**
 * Fetch posts from a single subreddit using Reddit's JSON API
 */
export async function fetchSubreddit(config: SubredditConfig): Promise<RedditPost[]> {
  try {
    const { name, sort = 'hot', timeRange } = config;

    // Build URL for Reddit JSON API (no auth required)
    // Using old.reddit.com which is more permissive for API access
    let url = `https://old.reddit.com/r/${name}/${sort}.json?limit=25`;

    // Add time range for 'top' sort
    if (sort === 'top' && timeRange) {
      url += `&t=${timeRange}`;
    }

    console.log(`📱 Fetching Reddit: r/${name} (${sort})`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as RedditApiListing;
    const posts: RedditPost[] = [];

    // Parse Reddit's JSON structure
    if (data?.data?.children) {
      for (const child of data.data.children) {
        if (child.kind !== 't3') continue; // Skip non-post items

        const post = child.data;

        // Skip removed/deleted posts
        if (post.removed_by_category || post.author === '[deleted]') continue;

        const redditPost: RedditPost = {
          id: post.id,
          title: post.title,
          score: post.score || 0,
          numComments: post.num_comments || 0,
          subreddit: post.subreddit,
          author: post.author,
          permalink: `https://www.reddit.com${post.permalink}`,
          url: post.url,
          created: post.created_utc,
          thumbnail: post.thumbnail && post.thumbnail.startsWith('http') ? post.thumbnail : undefined,
          selftext: post.selftext || undefined,
        };

        posts.push(redditPost);
      }
    }

    console.log(`✓ Fetched ${posts.length} posts from r/${name}`);
    return posts;
  } catch (error) {
    console.error(`❌ Error fetching r/${config.name}:`, error);
    return [];
  }
}

/**
 * Fetch posts from all configured subreddits
 */
export async function fetchAllSubreddits(
  configs: SubredditConfig[] = DEFAULT_SUBREDDITS
): Promise<RedditPost[]> {
  console.log(`🔄 Fetching ${configs.length} subreddits...`);

  const results = await Promise.allSettled(
    configs.map(config => fetchSubreddit(config))
  );

  const allPosts: RedditPost[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allPosts.push(...result.value);
    }
  }

  // Sort by score (highest first)
  allPosts.sort((a, b) => b.score - a.score);

  console.log(`✓ Successfully fetched ${allPosts.length} total Reddit posts`);
  return allPosts;
}

/**
 * Convert Reddit post to unified SocialPost format
 */
export function redditToSocialPost(post: RedditPost): SocialPost {
  return {
    id: `reddit_${post.id}`,
    platform: 'Reddit',
    title: post.title,
    url: post.permalink,
    score: post.score,
    metadata: `r/${post.subreddit}`,
    timestamp: post.created * 1000, // Convert to milliseconds
    author: post.author,
    thumbnail: post.thumbnail,
    description: post.selftext,
    commentsCount: post.numComments,
  };
}

/**
 * Fetch and convert Reddit posts to unified format
 */
export async function fetchRedditPosts(
  configs: SubredditConfig[] = DEFAULT_SUBREDDITS
): Promise<SocialPost[]> {
  const redditPosts = await fetchAllSubreddits(configs);
  return redditPosts.map(redditToSocialPost);
}
