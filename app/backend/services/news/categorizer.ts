import type { NewsArticle, NewsCategory } from '../../../shared/types/news';

const CATEGORY_KEYWORDS: Record<NewsCategory, string[]> = {
	Tech: [
		'technology', 'tech', 'software', 'hardware', 'artificial intelligence', 'machine learning',
		'programming', 'developer', 'github', 'startup', 'silicon valley', 'application', 'app ',
		'mobile', 'web', 'internet', 'cyber', 'cybersecurity', 'digital', 'cloud', 'data',
		'algorithm', 'computer', 'apple', 'google', 'microsoft', 'meta', 'facebook', 'social media',
		'innovation', 'robot', 'semiconductor', 'chip', 'openai', 'tesla', 'hacker news',
	],
	Finance: [
		'finance', 'financial', 'market', 'stock', 'stocks', 'trading', 'investment', 'investor',
		'economy', 'economic', 'bank', 'banking', 'wall street', 'nasdaq', 'dow jones', 'sp500',
		's&p', 'fund', 'funds', 'hedge fund', 'venture capital', 'ipo', 'earnings', 'revenue',
		'profit', 'profits', 'bond', 'forex', 'currency', 'dollar', 'euro', 'inflation',
		'interest rate', 'federal reserve', 'fed', 'central bank',
	],
	Crypto: [
		'bitcoin', 'ethereum', 'crypto', 'cryptocurrency', 'blockchain', 'nft', 'defi', 'web3',
		'binance', 'coinbase', 'altcoin', 'token', 'wallet', 'mining', 'proof of stake',
		'proof-of-stake', 'proof of work', 'proof-of-work', 'smart contract', 'dapp', 'satoshi',
		'bull run', 'bear market', 'exchange', 'solana', 'cardano', 'dogecoin', 'shiba inu',
		'dao', 'stablecoin', 'ether', 'btc', 'eth',
	],
	Turkey: [
		'turkey', 'turkish', 'ankara', 'istanbul', 'erdogan', 'turkish lira', 'turkiye', 'trt haber',
		'trt', 'anatolia', 'bosphorus', 'tbmm', 'izmir', 'bursa',
	],
	World: [
		'global', 'international', 'geopolitics', 'government', 'president', 'prime minister',
		'election', 'politics', 'political', 'war', 'peace', 'united nations', 'nato', 'european union',
		'diplomatic', 'sanction', 'climate', 'environment', 'health', 'pandemic', 'ceasefire',
		'refugee', 'summit', 'parliament', 'conflict',
	],
	General: [],
};

const SOURCE_CATEGORY_BOOSTS: Array<{ match: string; boosts: Partial<Record<NewsCategory, number>> }> = [
	{ match: 'coindesk', boosts: { Crypto: 6, Finance: 2 } },
	{ match: 'cointelegraph', boosts: { Crypto: 6, Finance: 2 } },
	{ match: 'decrypt', boosts: { Crypto: 5 } },
	{ match: 'hacker news', boosts: { Tech: 6 } },
	{ match: 'techcrunch', boosts: { Tech: 5 } },
	{ match: 'bbc', boosts: { World: 4, Finance: 1 } },
	{ match: 'reuters', boosts: { World: 3, Finance: 2 } },
	{ match: 'trt haber', boosts: { Turkey: 5, World: 2 } },
	{ match: 'trt world', boosts: { World: 4, Turkey: 2 } },
];

const DEFAULT_SCORES: Record<NewsCategory, number> = {
	Tech: 0,
	Finance: 0,
	Crypto: 0,
	Turkey: 0,
	World: 0,
	General: 0,
};

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countKeywordMatches(text: string, keyword: string): number {
	const normalizedKeyword = keyword.trim().toLowerCase();
	if (!normalizedKeyword) return 0;

	if (normalizedKeyword.includes(' ')) {
		return text.includes(normalizedKeyword) ? 1 : 0;
	}

	const regex = new RegExp(`\\b${escapeRegex(normalizedKeyword)}\\b`, 'g');
	return text.match(regex)?.length ?? 0;
}

function getSourceBoosts(sourceName: string): Partial<Record<NewsCategory, number>> {
	const normalizedSource = sourceName.toLowerCase();
	return SOURCE_CATEGORY_BOOSTS.find((sourceRule) => normalizedSource.includes(sourceRule.match))?.boosts ?? {};
}

function getTopScoringCategory(scores: Record<NewsCategory, number>): NewsCategory {
	let bestCategory: NewsCategory = 'General';
	let bestScore = 0;

	for (const [category, score] of Object.entries(scores) as Array<[NewsCategory, number]>) {
		if (score > bestScore) {
			bestCategory = category;
			bestScore = score;
		}
	}

	return bestCategory;
}

export function categorizeArticle(article: NewsArticle): NewsCategory {
	const text = `${article.title} ${article.description ?? ''} ${article.content ?? ''}`.toLowerCase();
	const scores: Record<NewsCategory, number> = { ...DEFAULT_SCORES };

	for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as Array<[NewsCategory, string[]]>) {
		for (const keyword of keywords) {
			const matches = countKeywordMatches(text, keyword);
			if (matches > 0) {
				scores[category] += matches;
			}
		}
	}

	const sourceBoosts = getSourceBoosts(article.sourceName);
	for (const [category, boost] of Object.entries(sourceBoosts) as Array<[NewsCategory, number]>) {
		scores[category] += boost;
	}

	if (scores.Crypto >= 4 || (scores.Crypto > 0 && scores.Crypto >= scores.Finance + 2)) {
		return 'Crypto';
	}

	if (scores.Turkey >= 4 || (article.sourceName.toLowerCase().includes('trt haber') && scores.World <= scores.Turkey + 1)) {
		return 'Turkey';
	}

	const bestCategory = getTopScoringCategory(scores);
	if (bestCategory === 'General') {
		return article.category || 'General';
	}

	const bestScore = scores[bestCategory];
	if (bestScore <= 1) {
		return article.category || bestCategory;
	}

	return bestCategory;
}

export function filterByCategory(articles: NewsArticle[], category: NewsCategory): NewsArticle[] {
	return articles.filter((article) => article.category === category);
}

export function getCategoryCounts(articles: NewsArticle[]): Record<NewsCategory, number> {
	const counts: Record<NewsCategory, number> = {
		Tech: 0,
		Finance: 0,
		Crypto: 0,
		Turkey: 0,
		World: 0,
		General: 0,
	};

	for (const article of articles) {
		counts[article.category] += 1;
	}

	return counts;
}
