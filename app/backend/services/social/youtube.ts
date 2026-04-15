import type { SocialPost } from '../../../shared/types/social';

// YouTube API key from environment variable (optional)
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

/**
 * YouTube video interface from API
 */
interface YouTubeVideo {
  id: string | {
    kind: string;
    videoId: string;
  };
  snippet: {
    publishedAt: string;
    channelId: string;
    channelTitle: string;
    title: string;
    description: string;
    thumbnails: {
      default?: { url: string };
      medium?: { url: string };
      high?: { url: string };
    };
  };
  statistics?: {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  };
}

interface YouTubeApiResponse {
  items?: YouTubeVideo[];
}

/**
 * Fetch trending videos from YouTube Data API v3
 * Requires API key from environment variable YOUTUBE_API_KEY
 */
async function fetchYouTubeTrending(): Promise<YouTubeVideo[]> {
  if (!YOUTUBE_API_KEY) {
    console.warn('⚠️  YouTube API key not configured (YOUTUBE_API_KEY). Skipping YouTube data.');
    return [];
  }

  try {
    // Fetch most popular videos (trending)
    const url = `${YOUTUBE_API_BASE}/videos?part=snippet,statistics&chart=mostPopular&regionCode=US&maxResults=50&key=${YOUTUBE_API_KEY}`;

    console.log('📺 Fetching YouTube trending videos...');

    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`YouTube API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json() as YouTubeApiResponse;

    if (!data.items || !Array.isArray(data.items)) {
      console.warn('⚠️  No videos found in YouTube API response');
      return [];
    }

    console.log(`✓ Fetched ${data.items.length} YouTube trending videos`);
    return data.items;
  } catch (error) {
    console.error('❌ Error fetching YouTube trending:', error);
    return [];
  }
}

/**
 * Convert YouTube video to unified SocialPost format
 */
function youtubeVideoToSocialPost(video: YouTubeVideo): SocialPost {
  // Extract video ID
  const videoId = typeof video.id === 'string' ? video.id : video.id.videoId;

  // Parse statistics
  const viewCount = parseInt(video.statistics?.viewCount || '0', 10);
  const likeCount = parseInt(video.statistics?.likeCount || '0', 10);
  const commentCount = parseInt(video.statistics?.commentCount || '0', 10);

  // Use view count as score (normalized to be comparable with other platforms)
  // Divide by 1000 to get a reasonable score range
  const score = Math.floor(viewCount / 1000);

  return {
    id: `youtube_${videoId}`,
    platform: 'YouTube',
    title: video.snippet.title,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    score: score,
    metadata: video.snippet.channelTitle,
    timestamp: new Date(video.snippet.publishedAt).getTime(),
    author: video.snippet.channelTitle,
    thumbnail: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url,
    description: video.snippet.description,
    commentsCount: commentCount,
  };
}

/**
 * Fetch trending YouTube videos and convert to unified format
 */
export async function fetchYouTubePosts(): Promise<SocialPost[]> {
  console.log('🔄 Fetching YouTube trending videos...');

  try {
    const videos = await fetchYouTubeTrending();

    if (videos.length === 0) {
      console.log('ℹ️  No YouTube videos to process');
      return [];
    }

    // Convert to social posts
    const posts = videos.map(youtubeVideoToSocialPost);

    // Sort by score (view count / 1000)
    posts.sort((a, b) => b.score - a.score);

    // Take top 30
    const finalPosts = posts.slice(0, 30);

    console.log(`✓ Successfully fetched ${finalPosts.length} YouTube trending videos`);
    return finalPosts;
  } catch (error) {
    console.error('❌ Error fetching YouTube posts:', error);
    return [];
  }
}

/**
 * Check if YouTube API is configured
 */
export function isYouTubeConfigured(): boolean {
  return YOUTUBE_API_KEY !== '';
}
