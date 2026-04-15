// News article data types

export type NewsCategory = 'Tech' | 'Finance' | 'Crypto' | 'World' | 'Turkey' | 'General';
export type SentimentType = 'positive' | 'negative' | 'neutral';

export interface NewsArticle {
  id: string;
  title: string;
  description: string;
  link: string;
  source: string;
  sourceName: string;
  category: NewsCategory;
  sentiment: SentimentType;
  pubDate: string;
  author?: string;
  imageUrl?: string;
  content?: string;
  contentSource?: 'feed' | 'page';
  imageSource?: 'feed' | 'page';
  isEnriched?: boolean;
}

export interface NewsCache {
  articles: NewsArticle[];
  lastUpdated: number;
}

export interface RSSFeedSource {
  name: string;
  url: string;
  defaultCategory?: NewsCategory;
}
