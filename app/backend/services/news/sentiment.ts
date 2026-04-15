import type { NewsArticle, SentimentType } from '../../../shared/types/news';

const POSITIVE_KEYWORDS = [
	'success', 'successful', 'growth', 'growing', 'gain', 'gains', 'profit', 'profitable', 'win',
	'wins', 'victory', 'breakthrough', 'innovation', 'innovative', 'positive', 'rise', 'rising',
	'surge', 'surging', 'boost', 'boosting', 'increase', 'increasing', 'improve', 'improvement',
	'recovery', 'recovering', 'progress', 'advancement', 'achievement', 'milestone', 'expand',
	'expansion', 'optimistic', 'bullish', 'rally', 'record high', 'beat estimates',
];

const NEGATIVE_KEYWORDS = [
	'fail', 'failure', 'failed', 'decline', 'declining', 'fall', 'falling', 'drop', 'dropping',
	'crash', 'crashing', 'collapse', 'crisis', 'problem', 'concern', 'risk', 'danger', 'threat',
	'warning', 'negative', 'bearish', 'recession', 'struggle', 'struggling', 'defeat', 'disaster',
	'catastrophe', 'scandal', 'fraud', 'criminal', 'illegal', 'attack', 'attacks', 'violence',
	'death', 'killed', 'war', 'conflict', 'layoff', 'layoffs', 'bankruptcy', 'plunge', 'plunging',
	'miss estimates', 'investigation', 'lawsuit',
];

const SOFTENING_KEYWORDS = [
	'analysis', 'forecast', 'watch', 'outlook', 'expects', 'expected', 'may', 'could', 'monitor',
	'update', 'report', 'briefing', 'commentary',
];

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countMatches(text: string, keyword: string): number {
	const normalizedKeyword = keyword.trim().toLowerCase();
	if (!normalizedKeyword) return 0;

	if (normalizedKeyword.includes(' ')) {
		return text.includes(normalizedKeyword) ? 1 : 0;
	}

	const regex = new RegExp(`\\b${escapeRegex(normalizedKeyword)}\\b`, 'g');
	return text.match(regex)?.length ?? 0;
}

export function analyzeSentiment(article: NewsArticle): SentimentType {
	const text = `${article.title} ${article.description ?? ''} ${article.content ?? ''}`.toLowerCase();

	let positiveScore = 0;
	let negativeScore = 0;

	for (const keyword of POSITIVE_KEYWORDS) {
		positiveScore += countMatches(text, keyword);
	}

	for (const keyword of NEGATIVE_KEYWORDS) {
		negativeScore += countMatches(text, keyword);
	}

	const softeningScore = SOFTENING_KEYWORDS.reduce((score, keyword) => score + countMatches(text, keyword), 0);

	if (positiveScore === 0 && negativeScore === 0) {
		return 'neutral';
	}

	if (Math.abs(positiveScore - negativeScore) <= 1) {
		return 'neutral';
	}

	if (softeningScore > 0 && Math.abs(positiveScore - negativeScore) < 3) {
		return 'neutral';
	}

	if (negativeScore >= positiveScore + 2) {
		return 'negative';
	}

	if (positiveScore >= negativeScore + 2) {
		return 'positive';
	}

	return 'neutral';
}

export function getSentimentDistribution(articles: NewsArticle[]): Record<SentimentType, number> {
	const distribution: Record<SentimentType, number> = {
		positive: 0,
		negative: 0,
		neutral: 0,
	};

	for (const article of articles) {
		distribution[article.sentiment] += 1;
	}

	return distribution;
}

export function filterBySentiment(articles: NewsArticle[], sentiment: SentimentType): NewsArticle[] {
	return articles.filter((article) => article.sentiment === sentiment);
}

export function calculateSentimentScore(articles: NewsArticle[]): number {
	if (articles.length === 0) return 0;

	const distribution = getSentimentDistribution(articles);
	const total = articles.length;
	const score = ((distribution.positive - distribution.negative) / total) * 100;

	return Math.round(score);
}
