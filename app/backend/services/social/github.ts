import type { SocialPost } from '../../../shared/types/social';

/**
 * GitHub repository interface from search API
 */
interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  created_at: string;
  updated_at: string;
  pushed_at: string;
}

interface GitHubSearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubRepo[];
}

interface GitHubSearchOptions {
  language?: string;
  query: string;
  sort: 'stars' | 'updated';
  perPage: number;
  label: string;
}

const TRENDING_WINDOW_DAYS = 30;
const RECENT_ACTIVITY_WINDOW_DAYS = 7;
const FINAL_GITHUB_POST_LIMIT = 30;

function formatDateDaysAgo(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0] ?? '';
}

async function fetchGitHubRepos(options: GitHubSearchOptions): Promise<GitHubRepo[]> {
  const { language = '', query, sort, perPage, label } = options;

  try {
    const fullQuery = language ? `${query} language:${language}` : query;
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(fullQuery)}&sort=${sort}&order=desc&per_page=${perPage}`;

    console.log(`🔍 Fetching GitHub ${label}${language ? ` for ${language}` : ''}...`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DataPulse-App/1.0',
        'Accept': 'application/vnd.github.v3+json',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json() as GitHubSearchResponse;

    console.log(`✓ Fetched ${data.items.length} GitHub ${label}${language ? ` for ${language}` : ''}`);
    return data.items;
  } catch (error) {
    console.error(`❌ Error fetching GitHub ${label}${language ? ` for ${language}` : ''}:`, error);
    return [];
  }
}

/**
 * Fetch trending repositories from GitHub using the official Search API
 * Uses a date-based search query to find recently popular repositories
 */
async function fetchTrendingRepos(language: string = ''): Promise<GitHubRepo[]> {
  const createdAfter = formatDateDaysAgo(TRENDING_WINDOW_DAYS);

  return fetchGitHubRepos({
    language,
    query: `created:>${createdAfter} stars:>100 archived:false`,
    sort: 'stars',
    perPage: 20,
    label: `trending repos (created after ${createdAfter})`,
  });
}

async function fetchRecentlyActiveRepos(language: string = ''): Promise<GitHubRepo[]> {
  const pushedAfter = formatDateDaysAgo(RECENT_ACTIVITY_WINDOW_DAYS);

  return fetchGitHubRepos({
    language,
    query: `pushed:>${pushedAfter} stars:>25 archived:false`,
    sort: 'updated',
    perPage: language ? 8 : 12,
    label: `recently active repos (pushed after ${pushedAfter})`,
  });
}

function getGitHubActivityTimestamp(repo: GitHubRepo): number {
  return new Date(repo.pushed_at || repo.updated_at || repo.created_at).getTime();
}

function getGitHubHybridScore(repo: GitHubRepo): number {
  const activityTimestamp = getGitHubActivityTimestamp(repo);
  const ageHours = Math.max(0, (Date.now() - activityTimestamp) / (1000 * 60 * 60));
  const starScore = Math.log10(repo.stargazers_count + 1) * 30;
  const forkScore = Math.log10(repo.forks_count + 1) * 5;
  const freshnessScore = Math.max(0, 45 - ageHours / 6);
  const recentPushBonus = ageHours <= 48 ? 15 : ageHours <= 24 * 7 ? 5 : 0;

  return starScore + forkScore + freshnessScore + recentPushBonus;
}

/**
 * Convert GitHub repo to unified SocialPost format
 */
function githubRepoToSocialPost(repo: GitHubRepo): SocialPost {
  // GitHub activity is better represented by the latest push/update than repo creation.
  const activityTimestamp = repo.pushed_at || repo.updated_at || repo.created_at;

  return {
    id: `github_${repo.id}`,
    platform: 'GitHub',
    title: repo.full_name,
    url: repo.html_url,
    score: repo.stargazers_count,
    metadata: repo.language || 'Unknown',
    timestamp: new Date(activityTimestamp).getTime(),
    author: repo.owner.login,
    thumbnail: repo.owner.avatar_url,
    description: repo.description || undefined,
  };
}

/**
 * Fetch trending repositories from multiple categories using GitHub's official API
 */
export async function fetchGitHubPosts(): Promise<SocialPost[]> {
  console.log('🔄 Fetching GitHub trending repositories...');

  try {
    // Fetch both star-heavy trending repos and recently active repos.
    const [
      allTrending,
      javascriptTrending,
      pythonTrending,
      typescriptTrending,
      goTrending,
      rustTrending,
      allRecent,
      javascriptRecent,
      pythonRecent,
      typescriptRecent,
    ] = await Promise.all([
      fetchTrendingRepos(''),
      fetchTrendingRepos('javascript'),
      fetchTrendingRepos('python'),
      fetchTrendingRepos('typescript'),
      fetchTrendingRepos('go'),
      fetchTrendingRepos('rust'),
      fetchRecentlyActiveRepos(''),
      fetchRecentlyActiveRepos('javascript'),
      fetchRecentlyActiveRepos('python'),
      fetchRecentlyActiveRepos('typescript'),
    ]);

    // Combine all results
    const combined = [
      ...allTrending,
      ...javascriptTrending,
      ...pythonTrending,
      ...typescriptTrending,
      ...goTrending,
      ...rustTrending,
      ...allRecent,
      ...javascriptRecent,
      ...pythonRecent,
      ...typescriptRecent,
    ];

    // Deduplicate by repo ID
    const reposMap = new Map<number, GitHubRepo>();
    for (const repo of combined) {
      if (!reposMap.has(repo.id)) {
        reposMap.set(repo.id, repo);
      }
    }

    // Rank with a hybrid score so the list keeps notable repos while surfacing fresh pushes.
    const rankedRepos = Array.from(reposMap.values()).sort(
      (a, b) => getGitHubHybridScore(b) - getGitHubHybridScore(a)
    );

    const finalPosts = rankedRepos
      .slice(0, FINAL_GITHUB_POST_LIMIT)
      .map(githubRepoToSocialPost);

    console.log(`✓ Successfully fetched ${finalPosts.length} unique GitHub trending repos`);
    return finalPosts;
  } catch (error) {
    console.error('❌ Error fetching GitHub posts:', error);
    return [];
  }
}
