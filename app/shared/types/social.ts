// Social media data types

export type SocialPlatform = 'Reddit' | 'HackerNews' | 'GitHub' | 'YouTube';

export interface RedditPost {
  id: string;
  title: string;
  score: number;
  numComments: number;
  subreddit: string;
  author: string;
  permalink: string;
  url: string;
  created: number;
  thumbnail?: string;
  selftext?: string;
}

export interface SocialPost {
  id: string;
  platform: SocialPlatform;
  title: string;
  url: string;
  score: number; // upvotes/stars/likes depending on platform
  metadata: string; // e.g., "r/programming" or "typescript" or "channel name"
  timestamp: number; // Unix epoch timestamp in milliseconds
  author?: string;
  thumbnail?: string;
  description?: string;
  commentsCount?: number;
}

export interface SocialCache {
  posts: SocialPost[];
  lastUpdated: number;
}

export interface SubredditConfig {
  name: string;
  displayName: string;
  sort?: 'hot' | 'top' | 'new' | 'rising';
  timeRange?: 'hour' | 'day' | 'week' | 'month' | 'year' | 'all';
}
