import Parser from 'rss-parser';
import * as cheerio from 'cheerio';
import { createHash } from 'crypto';
import type { NewsArticle, RSSFeedSource } from '../../../shared/types/news';
import { categorizeArticle } from './categorizer';
import { analyzeSentiment } from './sentiment';

type RSSCustomField =
	| string
	| [string, string]
	| [string, string, { keepArray?: boolean }];

type RSSItem = {
	title?: string;
	link?: string;
	content?: string;
	contentSnippet?: string;
	summary?: string;
	description?: string;
	pubDate?: string;
	isoDate?: string;
	author?: string;
	creator?: string;
	enclosure?: { url?: string };
	imageUrl?: string;
	contentEncoded?: string;
	'content:encoded'?: string;
	mediaThumbnail?: RSSMediaNode | RSSMediaNode[];
	mediaContent?: RSSMediaNode | RSSMediaNode[];
	mediaGroup?: RSSMediaNode | RSSMediaNode[];
	mediaCredit?: string;
	image?: RSSMediaNode | string;
	thumbnail?: RSSMediaNode | string;
	[key: string]: unknown;
};

type RSSMediaNode = {
	url?: string;
	$: { url?: string; href?: string; src?: string };
};

type PageEnrichment = {
	imageUrl?: string;
	description?: string;
	content?: string;
};

const ITEM_CUSTOM_FIELDS: RSSCustomField[] = [
	['content:encoded', 'contentEncoded'],
	['media:thumbnail', 'mediaThumbnail', { keepArray: true }],
	['media:content', 'mediaContent', { keepArray: true }],
	['media:group', 'mediaGroup', { keepArray: true }],
	['media:credit', 'mediaCredit'],
	['image', 'image'],
	['imageUrl', 'imageUrl'],
	['thumbnail', 'thumbnail'],
];

const parser = new Parser<Record<string, never>, RSSItem>({
	timeout: 10000,
	headers: {
		'User-Agent': 'DataPulse/1.0 RSS Reader',
	},
	customFields: {
		item: ITEM_CUSTOM_FIELDS as never,
	},
});

const PAGE_FETCH_TIMEOUT_MS = 4500;
const PAGE_ENRICH_MAX_PER_FEED = 12;
const PAGE_ENRICH_CONCURRENCY = 3;
const PAGE_ENRICH_PRIORITY_RECENT_HOURS = 18;
const TOP_HEADLINES_WINDOW = 24;
const TOP_HEADLINES_ENRICH_MAX = 10;
const MAX_ARTICLE_AGE_HOURS = 72;
const SHORT_CONTENT_MIN_WORDS = 180;
const SHORT_CONTENT_MIN_CHARS = 1100;

/**
 * RSS Feed Sources Configuration
 */
export const RSS_SOURCES: RSSFeedSource[] = [
	{ name: 'Hacker News', url: 'https://hnrss.org/frontpage', defaultCategory: 'Tech' },
	{ name: 'Reuters', url: 'https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best', defaultCategory: 'Finance' },
	{ name: 'BBC News', url: 'http://feeds.bbci.co.uk/news/rss.xml', defaultCategory: 'World' },
	{ name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/', defaultCategory: 'Crypto' },
	{ name: 'TRT Haber', url: 'https://www.trthaber.com/sondakika.rss', defaultCategory: 'Turkey' },
];

function generateArticleId(link: string): string {
	const hash = createHash('md5').update(link).digest('hex');
	return hash.substring(0, 12);
}

function toAbsoluteUrl(value: string | undefined, baseUrl: string): string | undefined {
	if (!value) return undefined;
	const trimmed = value.trim();
	if (!trimmed) return undefined;

	try {
		return new URL(trimmed, baseUrl).toString();
	} catch {
		return undefined;
	}
}

function stripHtml(value?: string | null): string {
	if (!value) return '';
	return cheerio
		.load(`<div>${value}</div>`)
		.text()
		.replace(/\s+/g, ' ')
		.trim();
}

function getWordCount(value?: string): number {
	if (!value) return 0;
	return value
		.split(/\s+/)
		.map((part) => part.trim())
		.filter(Boolean)
		.length;
}

function getMediaUrls(node: unknown, baseUrl: string): string[] {
	const entries = Array.isArray(node) ? node : node ? [node] : [];
	const urls: string[] = [];

	for (const entry of entries) {
		if (typeof entry === 'string') {
			const absolute = toAbsoluteUrl(entry, baseUrl);
			if (absolute) urls.push(absolute);
			continue;
		}

		if (!entry || typeof entry !== 'object') continue;
		const mediaEntry = entry as RSSMediaNode;
		const rawUrl = mediaEntry.url ?? mediaEntry.$?.url ?? mediaEntry.$?.href ?? mediaEntry.$?.src;
		const absolute = toAbsoluteUrl(rawUrl, baseUrl);
		if (absolute) urls.push(absolute);
	}

	return urls;
}

function extractFirstImageFromHtml(html: string | undefined, baseUrl: string): string | undefined {
	if (!html) return undefined;
	const $ = cheerio.load(html);
	const imgSrc = $('img').first().attr('src') ?? $('img').first().attr('data-src') ?? $('img').first().attr('srcset')?.split(',')[0]?.trim().split(' ')[0];
	return toAbsoluteUrl(imgSrc, baseUrl);
}

function extractFeedImage(item: RSSItem): { imageUrl?: string; imageSource?: 'feed' } {
	const feedImageCandidates = [
		...getMediaUrls(item.mediaThumbnail, item.link ?? ''),
		...getMediaUrls(item.mediaContent, item.link ?? ''),
		...getMediaUrls(item.mediaGroup, item.link ?? ''),
		...getMediaUrls(item.image, item.link ?? ''),
		...getMediaUrls(item.thumbnail, item.link ?? ''),
		toAbsoluteUrl(item.imageUrl, item.link ?? ''),
	].filter(Boolean) as string[];

	if (feedImageCandidates.length > 0) {
		return { imageUrl: feedImageCandidates[0], imageSource: 'feed' };
	}

	const enclosureImage = toAbsoluteUrl(item.enclosure?.url, item.link ?? '');
	if (enclosureImage) {
		return { imageUrl: enclosureImage, imageSource: 'feed' };
	}

	const inlineImage = extractFirstImageFromHtml(item.contentEncoded ?? item.content ?? item.description, item.link ?? '');
	if (inlineImage) {
		return { imageUrl: inlineImage, imageSource: 'feed' };
	}

	return {};
}

function getPreferredFeedDescription(item: RSSItem): string {
	return stripHtml(item.contentSnippet || item.summary || item.description || item.content || item.contentEncoded || '');
}

function getPreferredFeedContent(item: RSSItem): string {
	const candidates = [
		item.contentEncoded,
		item.content,
		item.description,
		item.summary,
		item.contentSnippet,
	];

	for (const candidate of candidates) {
		const cleaned = stripHtml(candidate);
		if (cleaned) return cleaned;
	}

	return '';
}

function isRecentArticle(pubDate: string): boolean {
	const ageHours = getArticleAgeHours(pubDate);
	if (ageHours === null) return true;
	return ageHours <= MAX_ARTICLE_AGE_HOURS;
}

function getArticleAgeHours(pubDate: string): number | null {
	const timestamp = new Date(pubDate).getTime();
	if (!Number.isFinite(timestamp)) return null;
	return (Date.now() - timestamp) / 3600000;
}

function shouldEnrichArticle(article: NewsArticle): boolean {
	if (!article.link || !isRecentArticle(article.pubDate)) return false;
	const content = article.content ?? '';
	const isShort = getWordCount(content) < SHORT_CONTENT_MIN_WORDS || content.length < SHORT_CONTENT_MIN_CHARS;
	return isShort || !article.imageUrl;
}

function getEnrichmentPriority(article: NewsArticle, index: number, totalArticles: number): number {
	const content = article.content ?? '';
	const wordCount = getWordCount(content);
	const ageHours = getArticleAgeHours(article.pubDate);
	const wordDeficit = Math.max(0, SHORT_CONTENT_MIN_WORDS - wordCount) / SHORT_CONTENT_MIN_WORDS;
	const charDeficit = Math.max(0, SHORT_CONTENT_MIN_CHARS - content.length) / SHORT_CONTENT_MIN_CHARS;
	const recencyBoost = ageHours === null
		? 1.5
		: Math.max(0, MAX_ARTICLE_AGE_HOURS - ageHours) / MAX_ARTICLE_AGE_HOURS;
	const recentPriorityBoost = ageHours !== null && ageHours <= PAGE_ENRICH_PRIORITY_RECENT_HOURS ? 1.5 : 0;
	const imageBoost = article.imageUrl ? 0 : 0.35;
	const positionBoost = Math.max(0, totalArticles - index) / Math.max(1, totalArticles) * 0.25;

	return recentPriorityBoost + (recencyBoost * 2.5) + (wordDeficit * 2) + (charDeficit * 1.5) + imageBoost + positionBoost;
}

function extractMetaContent($: cheerio.CheerioAPI, selectors: string[]): string | undefined {
	for (const selector of selectors) {
		const value = $(selector).attr('content')?.trim();
		if (value) return value;
	}
	return undefined;
}

function getJsonLdImage(value: unknown, baseUrl: string): string | undefined {
	if (!value) return undefined;

	if (typeof value === 'string') return toAbsoluteUrl(value, baseUrl);
	if (Array.isArray(value)) {
		for (const item of value) {
			const image = getJsonLdImage(item, baseUrl);
			if (image) return image;
		}
		return undefined;
	}
	if (typeof value !== 'object') return undefined;

	const node = value as Record<string, unknown>;
	return toAbsoluteUrl(
		(typeof node.url === 'string' && node.url)
			|| (typeof node.contentUrl === 'string' && node.contentUrl)
			|| (typeof node.thumbnailUrl === 'string' && node.thumbnailUrl)
			|| undefined,
		baseUrl,
	);
}

function collectJsonLdNodes(value: unknown): Record<string, unknown>[] {
	if (!value) return [];
	if (Array.isArray(value)) return value.flatMap((entry) => collectJsonLdNodes(entry));
	if (typeof value !== 'object') return [];

	const node = value as Record<string, unknown>;
	const graph = Array.isArray(node['@graph']) ? node['@graph'] : [];
	return [node, ...graph.filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)];
}

function extractJsonLdImage($: cheerio.CheerioAPI, baseUrl: string): string | undefined {
	const images: string[] = [];

	$('script[type="application/ld+json"]').each((_, element) => {
		const raw = $(element).html();
		if (!raw) return;

		try {
			const parsed = JSON.parse(raw);
			for (const node of collectJsonLdNodes(parsed)) {
				const image = getJsonLdImage(node.image, baseUrl);
				if (image) images.push(image);
			}
		} catch {
			return;
		}
	});

	return images[0];
}


function getHostname(pageUrl: string): string {
	try {
		return new URL(pageUrl).hostname.toLowerCase();
	} catch {
		return '';
	}
}

function normalizeText(value: string): string {
	return value.replace(/\s+/g, ' ').trim();
}

function shouldKeepParagraph(text: string): boolean {
	const normalized = normalizeText(text);
	if (!normalized) return false;
	if (normalized.length >= 28) return true;
	return normalized.length >= 18 && /[.!?;:,"'”’)]$/.test(normalized);
}

function isLikelyArticleJunk(text: string): boolean {
	const normalized = normalizeText(text);
	if (!normalized) return true;

	const junkPatterns = [
		/^share(?:\s+save)?$/i,
		/^related$/i,
		/^related topics$/i,
		/^more on this story$/i,
		/^top stories$/i,
		/^elsewhere on the bbc$/i,
		/^elsewhere in sport$/i,
		/^more from the bbc$/i,
		/^view comments/i,
		/^comments can not be loaded/i,
		/^to load comments/i,
		/^what information do we collect from this quiz\?$/i,
		/^to play this video/i,
		/^this video can not be played$/i,
		/^media caption[,\s]/i,
		/^image caption[,\s]/i,
		/^loading please wait/i,
		/^yükleniyor lütfen bekleyiniz$/i,
		/^etiketler$/i,
		/^sıradaki haber$/i,
		/^son haberler$/i,
		/^okuma listesi$/i,
	];

	return junkPatterns.some((pattern) => pattern.test(normalized));
}

function extractParagraphTextFromNodes($: cheerio.CheerioAPI, nodes: cheerio.Cheerio<any>): string {
	const seen = new Set<string>();
	const parts = nodes
		.find('p, h2, h3')
		.map((_, element) => normalizeText($(element).text()))
		.get()
		.filter((part) => {
			if (!shouldKeepParagraph(part) || isLikelyArticleJunk(part) || seen.has(part)) return false;
			seen.add(part);
			return true;
		});

	return normalizeText(parts.join(' '));
}

function extractContainerText($: cheerio.CheerioAPI, node: cheerio.Cheerio<any>): string {
	const element = node.first().get(0);
	if (!element) return '';

	const clone = cheerio.load(element);
	clone(
		'script, style, noscript, nav, aside, footer, form, button, svg, figure, figcaption, '
			+ 'header nav, [aria-hidden="true"], [data-component="links-block"], [data-component="topic-list"], '
			+ '[data-component="unordered-list-block"], [data-component="image-block"], .social-share, .share-tools, '
			+ '.article-share, .related-content, .read-more, .newsletter-signup, .ad, .ads, .advert, .tags, .tag-list'
	).remove();

	const text = normalizeText(clone.root().text());
	if (isLikelyArticleJunk(text)) return '';
	return text;
}

function getArticleSelectors(pageUrl: string): string[] {
	const hostname = getHostname(pageUrl);

	if (hostname.includes('bbc.com') || hostname.includes('bbc.co.uk')) {
		return [
			'article [data-component="text-block"]',
			'article [data-component="subheadline-block"]',
			'main [data-component="text-block"]',
			'main [data-component="subheadline-block"]',
			'[data-component="story-body"]',
			'[data-component="article-body"]',
			'article',
			'main article',
		];
	}

	if (hostname.includes('trthaber.com')) {
		return [
			'.news-content',
			'.article-content',
			'.news-detail',
			'.detail-content',
			'.detail-news-content',
			'.haber-detay__icerik',
			'article',
		];
	}

	return [
		'[itemprop="articleBody"]',
		'article',
		'main article',
		'main',
		'.article-body',
		'.entry-content',
		'.post-content',
		'.story-body',
		'.article-content',
		'.news-content',
	];
}

function extractArticleText($: cheerio.CheerioAPI, pageUrl: string): string {
	for (const selector of getArticleSelectors(pageUrl)) {
		const nodes = $(selector);
		if (!nodes.length) continue;

		const text = extractParagraphTextFromNodes($, nodes);
		if (text.length >= 180) return text;

		for (let index = 0; index < nodes.length; index += 1) {
			const fallback = extractContainerText($, nodes.eq(index));
			if (fallback.length >= 220) return fallback;
		}
	}

	return '';
}

async function fetchPageEnrichment(article: NewsArticle): Promise<PageEnrichment | null> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), PAGE_FETCH_TIMEOUT_MS);

	try {
		const response = await fetch(article.link, {
			headers: {
				'User-Agent': 'DataPulse/1.0 News Enricher',
				Accept: 'text/html,application/xhtml+xml',
			},
			signal: controller.signal,
			redirect: 'follow',
		});

		if (!response.ok) return null;
		const contentType = response.headers.get('content-type') ?? '';
		if (!contentType.includes('html')) return null;

		const html = await response.text();
		const $ = cheerio.load(html);

		const imageUrl =
			toAbsoluteUrl(extractMetaContent($, [
				'meta[property="og:image"]',
				'meta[name="og:image"]',
				'meta[name="twitter:image"]',
				'meta[property="twitter:image"]',
			]), article.link)
			?? extractJsonLdImage($, article.link)
			?? toAbsoluteUrl($('link[rel="image_src"]').attr('href')?.trim(), article.link)
			?? extractFirstImageFromHtml(html, article.link);

		const description = stripHtml(extractMetaContent($, [
			'meta[property="og:description"]',
			'meta[name="description"]',
			'meta[name="twitter:description"]',
		]));

		const content = extractArticleText($, article.link);

		return {
			imageUrl,
			description: description || undefined,
			content: content || undefined,
		};
	} catch (error) {
		console.warn(`⚠️ Page enrichment skipped for ${article.link}:`, error);
		return null;
	} finally {
		clearTimeout(timeout);
	}
}

function mergeEnrichment(article: NewsArticle, enrichment: PageEnrichment | null): NewsArticle {
	if (!enrichment) return article;

	const nextArticle: NewsArticle = { ...article };
	let enriched = false;

	if (!nextArticle.imageUrl && enrichment.imageUrl) {
		nextArticle.imageUrl = enrichment.imageUrl;
		nextArticle.imageSource = 'page';
		enriched = true;
	}

	if (enrichment.description && enrichment.description.length > nextArticle.description.length) {
		nextArticle.description = enrichment.description;
		if (!nextArticle.contentSource) nextArticle.contentSource = 'page';
		enriched = true;
	}

	const currentContent = nextArticle.content ?? '';
	const enrichedContent = enrichment.content ?? '';
	if (enrichedContent.length > currentContent.length && getWordCount(enrichedContent) >= getWordCount(currentContent)) {
		nextArticle.content = enrichedContent;
		nextArticle.contentSource = 'page';
		enriched = true;
	}

	if (enriched) {
		nextArticle.isEnriched = true;
	}

	return nextArticle;
}

async function applyEnrichmentTargets(
	articles: NewsArticle[],
	targets: Array<{ article: NewsArticle; index: number }>,
): Promise<NewsArticle[]> {
	const enriched = [...articles];

	let cursor = 0;
	const workerCount = Math.min(PAGE_ENRICH_CONCURRENCY, targets.length);

	await Promise.all(Array.from({ length: workerCount }, async () => {
		while (cursor < targets.length) {
			const current = targets[cursor++];
			if (!current) break;
			const enrichment = await fetchPageEnrichment(current.article);
			enriched[current.index] = mergeEnrichment(current.article, enrichment);
		}
	}));

	return enriched;
}

async function enrichArticles(articles: NewsArticle[]): Promise<NewsArticle[]> {
	const targets = articles
		.map((article, index) => ({ article, index }))
		.filter(({ article }) => shouldEnrichArticle(article))
		.sort((left, right) => {
			const leftAge = getArticleAgeHours(left.article.pubDate);
			const rightAge = getArticleAgeHours(right.article.pubDate);
			const leftIsPriorityRecent = leftAge !== null && leftAge <= PAGE_ENRICH_PRIORITY_RECENT_HOURS;
			const rightIsPriorityRecent = rightAge !== null && rightAge <= PAGE_ENRICH_PRIORITY_RECENT_HOURS;

			if (leftIsPriorityRecent !== rightIsPriorityRecent) {
				return leftIsPriorityRecent ? -1 : 1;
			}

			const scoreDelta = getEnrichmentPriority(right.article, right.index, articles.length)
				- getEnrichmentPriority(left.article, left.index, articles.length);
			if (scoreDelta !== 0) return scoreDelta;

			return left.index - right.index;
		})
		.slice(0, PAGE_ENRICH_MAX_PER_FEED);

	return applyEnrichmentTargets(articles, targets);
}

async function enrichTopHeadlines(articles: NewsArticle[]): Promise<NewsArticle[]> {
	const targets = articles
		.slice(0, TOP_HEADLINES_WINDOW)
		.map((article, index) => ({ article, index }))
		.filter(({ article }) => !article.isEnriched && shouldEnrichArticle(article))
		.sort((left, right) => {
			const scoreDelta = getEnrichmentPriority(right.article, right.index, TOP_HEADLINES_WINDOW)
				- getEnrichmentPriority(left.article, left.index, TOP_HEADLINES_WINDOW);
			if (scoreDelta !== 0) return scoreDelta;

			return left.index - right.index;
		})
		.slice(0, TOP_HEADLINES_ENRICH_MAX);

	if (targets.length === 0) return articles;

	const enriched = await applyEnrichmentTargets(articles, targets);
	for (const { index } of targets) {
		const enrichedArticle = enriched[index];
		if (enrichedArticle && enrichedArticle !== articles[index]) {
			enrichedArticle.category = categorizeArticle(enrichedArticle);
			enrichedArticle.sentiment = analyzeSentiment(enrichedArticle);
		}
	}

	return enriched;
}

function createArticle(item: RSSItem, source: RSSFeedSource): NewsArticle {
	const description = getPreferredFeedDescription(item);
	const content = getPreferredFeedContent(item);
	const image = extractFeedImage(item);

	const article: NewsArticle = {
		id: generateArticleId(item.link!),
		title: item.title!,
		description,
		link: item.link!,
		source: source.url,
		sourceName: source.name,
		category: source.defaultCategory || 'General',
		sentiment: 'neutral',
		pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
		author: stripHtml(item.creator || item.author),
		imageUrl: image.imageUrl,
		imageSource: image.imageSource,
		content: content || undefined,
		contentSource: content ? 'feed' : undefined,
		isEnriched: false,
	};

	article.category = categorizeArticle(article);
	article.sentiment = analyzeSentiment(article);
	return article;
}

export async function parseRSSFeed(source: RSSFeedSource): Promise<NewsArticle[]> {
	try {
		console.log(`📰 Fetching RSS feed: ${source.name}`);

		const feed = await parser.parseURL(source.url);
		const parsedArticles = feed.items
			.filter((item) => item.title && item.link)
			.map((item) => createArticle(item, source));

		const articles = await enrichArticles(parsedArticles);
		for (const article of articles) {
			article.category = categorizeArticle(article);
			article.sentiment = analyzeSentiment(article);
		}

		console.log(`✓ Parsed ${articles.length} articles from ${source.name}`);
		return articles;
	} catch (error) {
		console.error(`❌ Error parsing RSS feed ${source.name}:`, error);
		return [];
	}
}

export async function parseAllFeeds(): Promise<NewsArticle[]> {
	console.log(`🔄 Parsing ${RSS_SOURCES.length} RSS feeds...`);

	const results = await Promise.allSettled(RSS_SOURCES.map((source) => parseRSSFeed(source)));
 
	const allArticles: NewsArticle[] = [];
	for (const result of results) {
		if (result.status === 'fulfilled') {
			allArticles.push(...result.value);
		}
	}

	allArticles.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
	const enrichedHeadlines = await enrichTopHeadlines(allArticles);
	console.log(`✓ Successfully parsed ${enrichedHeadlines.length} total articles`);
	return enrichedHeadlines;
}

export async function parseCustomFeeds(sources: RSSFeedSource[]): Promise<NewsArticle[]> {
	console.log(`🔄 Parsing ${sources.length} custom RSS feeds...`);

	const results = await Promise.allSettled(sources.map((source) => parseRSSFeed(source)));
	const allArticles: NewsArticle[] = [];

	for (const result of results) {
		if (result.status === 'fulfilled') {
			allArticles.push(...result.value);
		}
	}

	allArticles.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
	return allArticles;
}
