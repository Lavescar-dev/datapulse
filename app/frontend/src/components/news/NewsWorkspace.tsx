import { createEffect, createMemo, createResource, createSignal, For, onCleanup, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import type { NewsArticle, NewsCategory, SentimentType } from '../../../../shared/types/news';
import { apiUrl } from '../../lib/api';
import { createLocaleSignal } from '../../lib/locale';
import { isReasonableFutureDate, parseTimestamp } from '../../lib/timestamp';
import { formatCategoryLabel } from './ArticleCard';

type NewsPayload = {
	articles: NewsArticle[];
	count: number;
	lastUpdated: number;
};

type PreparedArticle = NewsArticle & {
	cleanDescription: string;
	cleanContent: string;
	cleanAuthor: string;
};

type CategoryFilter = 'All' | NewsCategory;
type SentimentFilter = 'all' | SentimentType;

const CATEGORY_ORDER: CategoryFilter[] = ['All', 'General', 'Finance', 'Crypto', 'Tech', 'World', 'Turkey'];

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
	All: 'Tüm Başlıklar',
	General: 'Gundem',
	Finance: 'Finans',
	Crypto: 'Kripto',
	Tech: 'Teknoloji',
	World: 'Dunya',
	Turkey: 'Turkiye',
};

const SENTIMENT_LABELS: Record<SentimentType, string> = {
	positive: 'Pozitif',
	negative: 'Negatif',
	neutral: 'Notr',
};

const CATEGORY_BADGES: Record<NewsCategory, string> = {
	General: 'gruv-badge gruv-badge-amber',
	Finance: 'gruv-badge gruv-badge-blue',
	Crypto: 'gruv-badge gruv-badge-yellow',
	Tech: 'gruv-badge gruv-badge-aqua',
	World: 'gruv-badge gruv-badge-purple',
	Turkey: 'gruv-badge gruv-badge-orange',
};

const SENTIMENT_BADGES: Record<SentimentType, string> = {
	positive: 'gruv-badge gruv-badge-green',
	negative: 'gruv-badge gruv-badge-red',
	neutral: 'gruv-badge gruv-badge-muted',
};

const normalize = (value: string) => value.toLocaleLowerCase('tr-TR').trim();

const decodeHtmlEntities = (value: string) => {
	if (typeof document === 'undefined') {
		return value
			.replace(/&amp;/g, '&')
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'")
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>');
	}

	const textarea = document.createElement('textarea');
	textarea.innerHTML = value;
	return textarea.value;
};

const sanitizeArticleText = (value?: string | null) => {
	if (!value) return '';

	const stripped = decodeHtmlEntities(value)
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<[^>]+>/g, ' ')
		.replace(/```[\s\S]*?```/g, ' ');

	return stripped
		.split(/\r?\n+/)
		.map((line) => line.trim())
		.filter(Boolean)
		.filter((line) => !/^(article|comments?)\s+url\s*:/i.test(line))
		.filter((line) => !/^points?\s*:/i.test(line))
		.filter((line) => !/^#\s*comments?\s*:/i.test(line))
		.filter((line) => !/^https?:\/\/\S+$/i.test(line))
		.map((line) => line.replace(/https?:\/\/\S+/gi, ' '))
		.map((line) => line.replace(/\s+/g, ' ').trim())
		.filter(Boolean)
		.join(' ')
		.replace(/\s+([,.;:!?])/g, '$1')
		.trim();
};

const truncateText = (value: string, maxLength: number) => {
	if (value.length <= maxLength) return value;
	return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
};

const formatAbsoluteDate = (value: string | number) => {
	const date = parseTimestamp(value);
	if (!date) return '-';

	return date.toLocaleString('tr-TR', {
		day: '2-digit',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit',
	});
};

const formatRelativeTime = (value: string | number) => {
	const date = parseTimestamp(value);
	if (!date) return '-';

	const now = Date.now();
	if (!isReasonableFutureDate(date, now)) return '-';

	const diffMs = date.getTime() - now;
	const diffMinutes = Math.round(diffMs / 60000);
	const rtf = new Intl.RelativeTimeFormat('tr', { numeric: 'auto' });

	if (Math.abs(diffMinutes) < 1) return 'simdi';
	if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, 'minute');
	const diffHours = Math.round(diffMinutes / 60);
	if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');
	const diffDays = Math.round(diffHours / 24);
	return rtf.format(diffDays, 'day');
};

const getSentimentScore = (sentiment: SentimentType) => {
	if (sentiment === 'positive') return 1;
	if (sentiment === 'negative') return -1;
	return 0;
};

const splitIntoSentences = (value: string) => value
	.match(/[^.!?]+(?:[.!?]+["')\]]*|$)/g)
	?.map((sentence) => sentence.replace(/\s+/g, ' ').trim())
	.filter(Boolean) ?? [];

const getWordCount = (value: string) => value
	.split(/\s+/)
	.map((part) => part.trim())
	.filter(Boolean)
	.length;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const isDescriptionUseful = (article: PreparedArticle) => {
	if (!article.cleanDescription) return false;
	if (!article.cleanContent) return true;

	const description = normalize(article.cleanDescription.replace(/[^\p{L}\p{N}\s]/gu, ' '));
	const content = normalize(article.cleanContent.replace(/[^\p{L}\p{N}\s]/gu, ' '));
	if (!description || !content) return Boolean(article.cleanDescription);
	if (content.includes(description)) return false;
	if (description.length < 80) return false;
	return !content.includes(description.slice(0, Math.min(description.length, 120)));
};

const getPopupDek = (article: PreparedArticle) => isDescriptionUseful(article) ? article.cleanDescription : '';

const getPopupLongText = (article: PreparedArticle) => {
	const text = article.cleanContent || article.cleanDescription;
	if (!text) return '';
	if (text.length <= 15000) return text;

	const sliceTarget = 14200;
	const sliced = text.slice(0, sliceTarget);
	const sentences = splitIntoSentences(sliced);
	if (sentences.length > 1) {
		const rebuilt = sentences.slice(0, -1).join(' ').trim();
		if (rebuilt.length >= 9500) return `${rebuilt}...`;
	}

	return truncateText(sliced, 14500);
};

const getPopupParagraphs = (article: PreparedArticle): string[] => {
	const text = getPopupLongText(article);
	if (!text) return [];

	const sentences = splitIntoSentences(text);
	if (sentences.length <= 2) return [text];

	const paragraphs: string[] = [];
	let current = '';

	for (const sentence of sentences) {
		const next = current ? `${current} ${sentence}` : sentence;
		if (current && next.length > 640) {
			paragraphs.push(current.trim());
			current = sentence;
			continue;
		}

		current = next;
	}

	if (current.trim()) paragraphs.push(current.trim());
	return paragraphs.filter(Boolean);
};

const getReadingTime = (article: PreparedArticle) => Math.max(1, Math.round(getWordCount(getPopupLongText(article)) / 210));

const getDepthLabel = (article: PreparedArticle) => {
	const words = getWordCount(getPopupLongText(article));
	if (words >= 850) return 'Uzun';
	if (words >= 320) return 'Orta';
	return 'Kisa';
};

const getFreshnessScore = (article: PreparedArticle) => {
	const published = parseTimestamp(article.pubDate);
	if (!published) return 0;

	const ageHours = Math.max(0, (Date.now() - published.getTime()) / 3600000);
	if (ageHours <= 2) return 96;
	if (ageHours <= 6) return 88;
	if (ageHours <= 24) return 76;
	if (ageHours <= 72) return 62;
	if (ageHours <= 168) return 42;
	return 24;
};

const getSourceWeight = (sourceName: string) => {
	const source = normalize(sourceName);
	if (source === 'bbc news') return 92;
	if (source === 'trt haber') return 88;
	if (source === 'coindesk') return 84;
	if (source === 'hacker news') return 78;
	return 72;
};

const getDeskScore = (article: PreparedArticle) => {
	const freshness = getFreshnessScore(article);
	const depth = clamp(Math.round((getWordCount(getPopupLongText(article)) / 900) * 100), 18, 100);
	const sourceWeight = getSourceWeight(article.sourceName);
	const recencyPart = Math.round(freshness * 0.45);
	const depthPart = Math.round(depth * 0.3);
	const sourcePart = Math.round(sourceWeight * 0.25);
	const score = clamp(recencyPart + depthPart + sourcePart, 0, 100);

	return {
		score,
		detail: `${recencyPart} güncellik + ${depthPart} kapsam + ${sourcePart} kaynak`,
	};
};

const getRelevanceMetrics = (article: PreparedArticle) => {
	const freshness = getFreshnessScore(article);
	const sentimentBoost = article.sentiment === 'negative' ? 8 : article.sentiment === 'positive' ? 4 : 0;
	const worldBase = { World: 90, Turkey: 72, General: 66, Finance: 60, Tech: 54, Crypto: 48 }[article.category];
	const marketBase = { Crypto: 92, Finance: 88, Tech: 64, World: 58, Turkey: 52, General: 44 }[article.category];
	const urgencyBase = { World: 76, Turkey: 68, Finance: 72, Crypto: 70, Tech: 56, General: 52 }[article.category];

	return {
		world: clamp(Math.round(worldBase + freshness * 0.15 + (article.category === 'World' ? 4 : 0)), 0, 100),
		market: clamp(Math.round(marketBase + freshness * 0.12 + (article.sentiment !== 'neutral' ? 4 : 0)), 0, 100),
		urgency: clamp(Math.round(urgencyBase + freshness * 0.18 + sentimentBoost), 0, 100),
	};
};

const getQuickBrief = (article: PreparedArticle) => {
	const sentences = splitIntoSentences(article.cleanContent || article.cleanDescription);
	const selected: string[] = [];
	let totalLength = 0;

	for (const sentence of sentences) {
		if (sentence.length < 48) continue;
		selected.push(sentence);
		totalLength += sentence.length;
		if (selected.length >= 4 || totalLength >= 460) break;
	}

	if (selected.length >= 2) return selected;
	return sentences.slice(0, Math.min(3, sentences.length));
};

const isShortArticleBody = (article: PreparedArticle) => getWordCount(getPopupLongText(article)) < 180;

const getRelatedArticles = (article: PreparedArticle, pool: PreparedArticle[]) => {
	const strictPool = pool.filter((candidate) => candidate.id !== article.id && (candidate.category === article.category || candidate.sourceName === article.sourceName));
	const workingPool = strictPool.length > 0 ? strictPool : pool.filter((candidate) => candidate.id !== article.id);

	return workingPool
		.map((candidate) => {
			let score = 0;
			if (candidate.category === article.category) score += 6;
			if (candidate.sourceName === article.sourceName) score += 4;
			if (candidate.sentiment === article.sentiment) score += 1;
			score += getFreshnessScore(candidate) / 25;

			return { candidate, score };
		})
		.sort((left, right) => right.score - left.score || (parseTimestamp(right.candidate.pubDate)?.getTime() ?? 0) - (parseTimestamp(left.candidate.pubDate)?.getTime() ?? 0))
		.slice(0, 5)
		.map(({ candidate }) => candidate);
};

const shouldShowQuickBrief = (_article: PreparedArticle, quickBrief: string[], longText: string, dek: string) => {
	if (!quickBrief.length) return false;
	const stripForCompare = (value: string) => normalize(value.replace(/[^\p{L}\p{N}\s]/gu, ' '));
	const normalizedBrief = stripForCompare(quickBrief.join(' '));
	const normalizedBody = stripForCompare(longText);
	const normalizedDek = stripForCompare(dek);
	if (!normalizedBrief) return false;
	if (normalizedBrief === normalizedDek) return false;
	if (normalizedBody && normalizedBody.length < 520 && normalizedBody.includes(normalizedBrief.slice(0, Math.min(normalizedBrief.length, 220)))) return false;
	return true;
};

const getStreamExcerpt = (article: PreparedArticle) => truncateText(article.cleanDescription || article.cleanContent, 165);

const getStoryImage = (article: PreparedArticle) => article.imageUrl || null;

const getSourceInitials = (sourceName: string) => sourceName
	.split(/\s+/)
	.filter(Boolean)
	.slice(0, 2)
	.map((part) => part[0]?.toUpperCase() ?? '')
	.join('');

export default function NewsWorkspace() {
	const locale = createLocaleSignal();
	const t = (tr: string, en: string) => (locale() === 'en' ? en : tr);
	const [categoryFilter, setCategoryFilter] = createSignal<CategoryFilter>('All');
	const [sentimentFilter, setSentimentFilter] = createSignal<SentimentFilter>('all');
	const [sourceFilter, setSourceFilter] = createSignal('all');
	const [searchQuery, setSearchQuery] = createSignal('');
	const [deskMode, setDeskMode] = createSignal<'top' | 'editors' | 'most-read'>('top');
	const [selectedId, setSelectedId] = createSignal<string | null>(null);
	const [popupId, setPopupId] = createSignal<string | null>(null);
	let previousBodyOverflow = '';

	const [newsData, { refetch }] = createResource(async () => {
		const controller = new AbortController();
		const timeout = window.setTimeout(() => controller.abort(), 15000);

		const response = await fetch(apiUrl('/api/news'), {
			credentials: 'include',
			signal: controller.signal,
		}).finally(() => window.clearTimeout(timeout));

		if (!response.ok) throw new Error(t('Haber akışı alınamadı', 'News feed could not be loaded'));
		return await response.json() as NewsPayload;
	});

	const interval = setInterval(() => refetch(), 45000);
	onCleanup(() => clearInterval(interval));

	const sourceOptions = createMemo(() => {
		const counts = new Map<string, number>();
		for (const article of newsData()?.articles ?? []) {
			counts.set(article.sourceName, (counts.get(article.sourceName) ?? 0) + 1);
		}

		return [...counts.entries()]
			.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'tr'))
			.map(([name]) => name);
	});

	const preparedArticles = createMemo<PreparedArticle[]>(() => (newsData()?.articles ?? []).map((article) => ({
		...article,
		cleanDescription: sanitizeArticleText(article.description),
		cleanContent: sanitizeArticleText(article.content),
		cleanAuthor: sanitizeArticleText(article.author),
	})));

	const filteredArticles = createMemo(() => {
		const query = normalize(searchQuery());
		const category = categoryFilter();
		const sentiment = sentimentFilter();
		const source = sourceFilter();

		return preparedArticles()
			.filter((article) => {
				if (category !== 'All' && article.category !== category) return false;
				if (sentiment !== 'all' && article.sentiment !== sentiment) return false;
				if (source !== 'all' && article.sourceName !== source) return false;
				if (!query) return true;

				const haystack = normalize([
					article.title,
					article.cleanDescription,
					article.sourceName,
					article.cleanAuthor,
					article.cleanContent,
				].join(' '));

				return haystack.includes(query);
			})
			.sort((left, right) => (parseTimestamp(right.pubDate)?.getTime() ?? 0) - (parseTimestamp(left.pubDate)?.getTime() ?? 0));
	});

	const popupArticle = createMemo(() => {
		const id = popupId();
		if (!id) return null;
		return filteredArticles().find((article) => article.id === id) ?? null;
	});

	createEffect(() => {
		if (popupId()) {
			previousBodyOverflow ||= document.body.style.overflow;
			document.body.style.overflow = 'hidden';
		} else {
			document.body.style.overflow = previousBodyOverflow;
			previousBodyOverflow = '';
		}
	});

	onCleanup(() => {
		document.body.style.overflow = previousBodyOverflow;
		previousBodyOverflow = '';
	});

	const openPopup = (id: string) => {
		setSelectedId(id);
		setPopupId(id);
	};

	const closePopup = () => setPopupId(null);

	createEffect(() => {
		const visible = filteredArticles();
		const activeId = selectedId();

		if (!visible.length) {
			setSelectedId(null);
			return;
		}

		if (!activeId || !visible.some((article) => article.id === activeId)) {
			setSelectedId(visible[0].id);
		}
	});

	createEffect(() => {
		const activePopupId = popupId();
		if (!activePopupId) return;
		if (!filteredArticles().some((article) => article.id === activePopupId)) setPopupId(null);
	});

	const overview = createMemo(() => {
		const allArticles = preparedArticles();
		const visibleArticles = filteredArticles();
		const categoryCounts = new Map<string, number>();
		const sourceCounts = new Map<string, number>();
		const sentimentTotals = { positive: 0, neutral: 0, negative: 0 };

		for (const article of allArticles) {
			categoryCounts.set(article.category, (categoryCounts.get(article.category) ?? 0) + 1);
			sourceCounts.set(article.sourceName, (sourceCounts.get(article.sourceName) ?? 0) + 1);
			sentimentTotals[article.sentiment] += 1;
		}

		const dominantCategory = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'General';
		const sentimentBalance = allArticles.length
			? Math.round((allArticles.reduce((sum, article) => sum + getSentimentScore(article.sentiment), 0) / allArticles.length) * 100)
			: 0;

		return {
			total: newsData()?.count ?? allArticles.length,
			visible: visibleArticles.length,
			sources: sourceCounts.size,
			dominantCategory,
			sentimentBalance,
			latestUpdate: newsData()?.lastUpdated ?? null,
			sentimentTotals,
		};
	});

	const sourceMix = createMemo(() => {
		const visible = filteredArticles();
		const counts = new Map<string, number>();
		for (const article of visible) counts.set(article.sourceName, (counts.get(article.sourceName) ?? 0) + 1);

		return [...counts.entries()]
			.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'tr'))
			.slice(0, 5)
			.map(([name, count]) => ({
				name,
				count,
				share: Math.round((count / Math.max(visible.length, 1)) * 100),
			}));
	});

	const categoryMix = createMemo(() => {
		const visible = filteredArticles();
		const counts = new Map<string, number>();
		for (const article of visible) counts.set(article.category, (counts.get(article.category) ?? 0) + 1);

		return [...counts.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 4)
			.map(([category, count]) => ({
				category,
				count,
				share: Math.round((count / Math.max(visible.length, 1)) * 100),
			}));
	});

	const activeFilters = createMemo(() => {
		const filters: string[] = [];
		if (deskMode() === 'editors') filters.push('Editors Picks');
		if (deskMode() === 'most-read') filters.push('Most Read');
		if (categoryFilter() !== 'All') filters.push(CATEGORY_LABELS[categoryFilter()]);
		const activeSentiment = sentimentFilter();
		if (activeSentiment !== 'all') filters.push(SENTIMENT_LABELS[activeSentiment]);
		if (sourceFilter() !== 'all') filters.push(sourceFilter());
		if (searchQuery().trim()) filters.push(`${t('Arama', 'Search')}: ${searchQuery().trim()}`);
		return filters;
	});

	const featuredCluster = createMemo(() => filteredArticles().slice(0, 5));
	const leadStory = createMemo(() => featuredCluster()[0] ?? null);
	const secondaryStories = createMemo(() => featuredCluster().slice(1, 5));

	const latestStories = createMemo(() => filteredArticles().slice(0, 6));

	const rankedStories = createMemo(() => [...filteredArticles()]
		.sort((left, right) => getDeskScore(right).score - getDeskScore(left).score || (parseTimestamp(right.pubDate)?.getTime() ?? 0) - (parseTimestamp(left.pubDate)?.getTime() ?? 0)));

	const mostReadStories = createMemo(() => rankedStories().slice(0, 5));
	const editorsChoice = createMemo(() => rankedStories().filter((article) => article.id !== leadStory()?.id).slice(0, 8));

	const streamArticles = createMemo(() => {
		if (deskMode() === 'editors') return editorsChoice();
		if (deskMode() === 'most-read') {
			return [...filteredArticles()]
				.sort((left, right) => {
					const wordDelta = getWordCount(getPopupLongText(right)) - getWordCount(getPopupLongText(left));
					if (wordDelta !== 0) return wordDelta;
					return getDeskScore(right).score - getDeskScore(left).score;
				})
				.slice(0, 12);
		}

		return filteredArticles().slice(0, 12);
	});

	const categoryCounts = createMemo(() => CATEGORY_ORDER
		.filter((category): category is NewsCategory => category !== 'All')
		.map((category) => ({
			category,
			count: preparedArticles().filter((article) => article.category === category).length,
		}))
		.filter((entry) => entry.count > 0));


	const popupDossier = createMemo(() => {
		const article = popupArticle();
		if (!article) return null;
		const longText = getPopupLongText(article);
		const quickBrief = getQuickBrief(article);
		const dek = getPopupDek(article);
		const isShort = isShortArticleBody(article);
		const related = getRelatedArticles(article, filteredArticles());

		return {
			dek,
			paragraphs: getPopupParagraphs(article),
			quickBrief,
			readingTime: getReadingTime(article),
			depth: getDepthLabel(article),
			freshness: getFreshnessScore(article),
			desk: getDeskScore(article),
			relevance: getRelevanceMetrics(article),
			wordCount: getWordCount(longText),
			isShort,
			related,
			showQuickBrief: shouldShowQuickBrief(article, quickBrief, longText, dek),
			hasEnrichedContent: article.contentSource === 'page' && longText.length > article.cleanDescription.length,
		};
	});

	const resetFilters = () => {
		setDeskMode('top');
		setCategoryFilter('All');
		setSentimentFilter('all');
		setSourceFilter('all');
		setSearchQuery('');
	};

	createEffect(() => {
		const handler = (event: KeyboardEvent) => {
			if (event.key === 'Escape') closePopup();
		};
		window.addEventListener('keydown', handler);
		onCleanup(() => window.removeEventListener('keydown', handler));
	});

	return (
		<div class="dp-editorial-workspace">
				<Show when={newsData.loading && !newsData()}>
					<div class="dp-editorial-state-card">
						<div class="dp-editorial-section-kicker">Editorial desk</div>
						<h2 class="dp-editorial-state-title">{t('Haber masası hazırlanıyor', 'News desk is being prepared')}</h2>
						<p class="dp-editorial-state-copy">{t('Kaynaklar taranıyor, editorial rail ve özet panelleri yenileniyor. Free backend uyanıyorsa ilk istek 30-50 saniye sürebilir.', 'Sources are being scanned and the editorial rail and summary panels are refreshing. If the free backend is waking up, the first request can take 30-50 seconds.')}</p>
					</div>
				</Show>

				<Show when={newsData.error}>
					<div class="dp-editorial-state-card is-error">
						<div class="dp-editorial-section-kicker">Bağlantı</div>
						<h2 class="dp-editorial-state-title">Akış alınamadı</h2>
						<p class="dp-editorial-state-copy">Backend şu anda yanıt vermiyor ya da sleep modundan uyanmaya çalışıyor. Render free tier kullanımında ilk yanıt gecikebilir.</p>
						<button type="button" onClick={() => refetch()} class="dp-editorial-action mt-5">Tekrar dene</button>
					</div>
				</Show>

			<Show when={!newsData.loading && !newsData.error && newsData()}>
				<Show when={filteredArticles().length > 0} fallback={<EditorialEmptyState onReset={resetFilters} />}>
					<div class="dp-editorial-layout">
						<aside class="dp-editorial-sidebar">
							<div class="dp-editorial-section-title">
								<span>Filtreler</span>
								<Show when={activeFilters().length > 0}>
									<button type="button" onClick={resetFilters} class="dp-editorial-inline-action">{t('Sıfırla', 'Reset')}</button>
								</Show>
							</div>

							<div class="dp-editorial-filter-stack">
								<button type="button" class={`dp-editorial-filter-item ${deskMode() === 'top' ? 'is-active' : ''}`} onClick={() => setDeskMode('top')}>
									<span class="dp-editorial-filter-title">{t('Top Stories', 'Top Stories')}</span>
									<span class="dp-editorial-filter-desc">Masa puanı ve güncellik bazlı öncelik.</span>
								</button>
								<button type="button" class={`dp-editorial-filter-item ${deskMode() === 'editors' ? 'is-active' : ''}`} onClick={() => setDeskMode('editors')}>
									<span class="dp-editorial-filter-title">Editors' Picks</span>
									<span class="dp-editorial-filter-desc">Yüksek güvenilirlik ve kapsam skoru.</span>
								</button>
								<button type="button" class={`dp-editorial-filter-item ${deskMode() === 'most-read' ? 'is-active' : ''}`} onClick={() => setDeskMode('most-read')}>
									<span class="dp-editorial-filter-title">Most Read</span>
									<span class="dp-editorial-filter-desc">Uzunluk ve desk score bazlı seçim.</span>
								</button>
							</div>

							<div class="dp-editorial-section-title mt-8">
								<span>{t('Kategoriler', 'Categories')}</span>
							</div>
							<div class="dp-editorial-category-list">
								<button type="button" class={`dp-editorial-category-item ${categoryFilter() === 'All' ? 'is-active' : ''}`} onClick={() => setCategoryFilter('All')}>
									<span>Tüm Başlıklar</span>
									<span class="dp-editorial-category-count">{preparedArticles().length} kayıt</span>
								</button>
								<For each={categoryCounts()}>
									{(item) => (
										<button type="button" class={`dp-editorial-category-item ${categoryFilter() === item.category ? 'is-active' : ''}`} onClick={() => setCategoryFilter(item.category)}>
											<span>{formatCategoryLabel(item.category)}</span>
											<span class="dp-editorial-category-count">{item.count} kayıt</span>
										</button>
									)}
								</For>
							</div>

							<div class="dp-editorial-section-title mt-8">
								<span>Ton / Kaynak</span>
							</div>
							<div class="dp-editorial-sidebar-controls">
								<select value={sentimentFilter()} onChange={(event) => setSentimentFilter(event.currentTarget.value as SentimentFilter)} class="dp-editorial-select">
									<option value="all">Tüm tonlar</option>
									<option value="positive">Pozitif</option>
									<option value="neutral">Nötr</option>
									<option value="negative">Negatif</option>
								</select>
								<select value={sourceFilter()} onChange={(event) => setSourceFilter(event.currentTarget.value)} class="dp-editorial-select">
									<option value="all">Tüm kaynaklar</option>
									<For each={sourceOptions()}>{(source) => <option value={source}>{source}</option>}</For>
								</select>
							</div>
						</aside>

						<section class="dp-editorial-feed">
							<div class="dp-editorial-cli">
								<span class="dp-editorial-cli-prefix">$ tail -f /var/log/datapulse/editorial.log</span>
								<input
									value={searchQuery()}
									onInput={(event) => setSearchQuery(event.currentTarget.value)}
									placeholder="Gelen ham feed verileri dinleniyor..."
									class="dp-editorial-cli-input"
								/>
							</div>

							<div class="dp-editorial-section-title">
								<span>Live Rail</span>
								<span class="dp-editorial-section-meta">
									{deskMode() === 'top' ? t('Son gelişmeler', 'Latest updates') : deskMode() === 'editors' ? t('Editör seçimleri', 'Editors picks') : t('En çok okunanlar', 'Most read')}
								</span>
							</div>

							<Show when={activeFilters().length > 0}>
								<div class="dp-editorial-active-filters">
									<For each={activeFilters()}>{(filter) => <span class="dp-editorial-tag is-muted">{filter}</span>}</For>
								</div>
							</Show>

							<div class="dp-editorial-feed-list">
								<For each={streamArticles()}>
									{(article) => (
										<button type="button" class={`dp-editorial-feed-item ${selectedId() === article.id ? 'is-active' : ''}`} onClick={() => openPopup(article.id)}>
											<div class="dp-editorial-feed-image">
												<Show when={getStoryImage(article)} fallback={<div class="dp-editorial-feed-placeholder">{formatCategoryLabel(article.category)}</div>}>
													<img src={getStoryImage(article)!} alt="" loading="lazy" />
												</Show>
											</div>
											<div class="dp-editorial-feed-body">
												<div class="dp-editorial-feed-meta">
													<span>[ID: {article.id}] {formatAbsoluteDate(article.pubDate)}</span>
													<span class="dp-editorial-feed-source">{article.sourceName}</span>
												</div>
												<h3 class="dp-editorial-feed-title">{article.title}</h3>
												<p class="dp-editorial-feed-snippet">{truncateText(article.cleanDescription || article.cleanContent, 240)}</p>
												<div class="dp-editorial-feed-tags">
													<span class="dp-editorial-tag">{formatCategoryLabel(article.category)}</span>
													<span class={`dp-editorial-tag ${article.sentiment === 'positive' ? 'is-positive' : article.sentiment === 'negative' ? 'is-negative' : 'is-muted'}`}>
														{SENTIMENT_LABELS[article.sentiment]}
													</span>
													<span class="dp-editorial-tag is-muted">Masa: {getDeskScore(article).score}</span>
												</div>
											</div>
										</button>
									)}
								</For>
							</div>
						</section>

						<aside class="dp-editorial-summary">
							<div class="dp-editorial-section-title">
								<span>{t('Desk Summary', 'Desk Summary')}</span>
								<span class="dp-editorial-section-meta">Metrikler</span>
							</div>

							<div class="dp-editorial-stats-panel">
								<div class="dp-editorial-panel-title">Yayın dengesi</div>
								<div class="dp-editorial-stat-list">
									<For each={sourceMix()}>
										{(item) => <DeskShareBar label={item.name} value={`${item.count} / %${item.share}`} share={item.share} tone="accent" />}
									</For>
								</div>
							</div>

							<div class="dp-editorial-stats-panel">
								<div class="dp-editorial-panel-title">{t('Kategori dağılımı', 'Category distribution')}</div>
								<div class="dp-editorial-stat-list">
									<For each={categoryMix()}>
										{(item) => <DeskShareBar label={`${formatCategoryLabel(item.category)} (${item.count} ${t('haber', 'stories')})`} value={`%${item.share}`} share={item.share} tone="muted" />}
									</For>
								</div>
							</div>

							<div class="dp-editorial-stats-panel">
								<div class="dp-editorial-panel-title">Ton dağılımı</div>
								<div class="dp-editorial-sentiment-grid">
									<DeskInfoBox label="Pozitif" value={String(overview().sentimentTotals.positive)} detail="Yükseliş" tone="positive" />
									<DeskInfoBox label="Nötr" value={String(overview().sentimentTotals.neutral)} detail="Denge" tone="muted" />
									<DeskInfoBox label="Negatif" value={String(overview().sentimentTotals.negative)} detail="Risk" tone="negative" />
								</div>
								<div class="dp-editorial-panel-note">
								<Show when={activeFilters().length > 0} fallback={<span>&gt; {t('Ek filtre uygulanmadı.', 'No extra filters applied.')}</span>}>
										<span>&gt; {t('Aktif filtre', 'Active filter')}: {activeFilters().join(' • ')}</span>
									</Show>
								</div>
							</div>
						</aside>
					</div>
				</Show>
			</Show>

			<Show when={popupArticle()}>
				{(article) => (
					<Portal>
						<div class="dp-editorial-modal-overlay" onClick={closePopup} aria-label="Kapat" role="button">
							<div class="dp-editorial-modal-window" role="dialog" aria-modal="true" aria-label={article().title} onClick={(event) => event.stopPropagation()}>
								<div class="dp-editorial-modal-head">
									<span>~ / view --article --id {article().id}</span>
									<button type="button" class="dp-editorial-modal-close" onClick={closePopup}>[X] Close</button>
								</div>
								<div class="dp-editorial-modal-body">
									<div class="dp-editorial-modal-header">
										<div class="dp-editorial-modal-copy">
											<div class="dp-editorial-modal-tags">
												<span class="dp-editorial-tag">{formatCategoryLabel(article().category)}</span>
												<span class={`dp-editorial-tag ${article().sentiment === 'positive' ? 'is-positive' : article().sentiment === 'negative' ? 'is-negative' : 'is-muted'}`}>
													{SENTIMENT_LABELS[article().sentiment]}
												</span>
												<span class="dp-editorial-modal-inline-meta">{article().sourceName} • {formatRelativeTime(article().pubDate)} • {formatAbsoluteDate(article().pubDate)}</span>
											</div>
											<h2 class="dp-editorial-modal-title">{article().title}</h2>
											<div class="dp-editorial-modal-meta">
												<span>Yazar: {article().cleanAuthor || 'Belirtilmedi'}</span>
												<span>{popupDossier()?.wordCount ?? 0} kelime</span>
												<span>Yaklasik {popupDossier()?.readingTime ?? 1} dk okuma</span>
											</div>
										</div>
										<div class="dp-editorial-modal-visual">
											<Show when={article().imageUrl} fallback={<div class="dp-editorial-modal-visual-placeholder">{formatCategoryLabel(article().category)}</div>}>
												<img src={article().imageUrl!} alt="" loading="lazy" />
											</Show>
										</div>
									</div>

									<Show when={popupDossier()?.showQuickBrief}>
										<div class="dp-editorial-modal-summary">
											<div class="dp-editorial-section-kicker">Hizli Ozet</div>
											<For each={popupDossier()?.quickBrief ?? []}>{(item) => <p>{item}</p>}</For>
										</div>
									</Show>

									<div class="dp-editorial-modal-content">
										<Show when={popupDossier()?.hasEnrichedContent}>
											<p class="dp-editorial-modal-note">Bu metin akis ozetinin otesinde sayfa ici icerikle zenginlestirildi.</p>
										</Show>
										<Show when={popupDossier()?.dek}>
											<p class="dp-editorial-modal-dek">{popupDossier()?.dek}</p>
										</Show>
										<Show when={popupDossier()?.paragraphs.length} fallback={<p>{article().cleanContent || article().cleanDescription}</p>}>
											<For each={popupDossier()?.paragraphs ?? []}>{(para) => <p>{para}</p>}</For>
										</Show>
									</div>

									<div class="dp-editorial-modal-split">
										<div>
											<div class="dp-editorial-section-title">
												<span>{t('Haber Fişi', 'News Sheet')}</span>
											</div>
											<div class="dp-editorial-fact-table">
												<FactRow label="Kaynak" value={article().sourceName} />
												<FactRow label="Yazar" value={article().cleanAuthor || 'Belirtilmedi'} />
												<FactRow label="Yayin" value={formatAbsoluteDate(article().pubDate)} />
												<FactRow label="Akis" value={article().source} />
												<FactRow label={t('Kategori', 'Category')} value={formatCategoryLabel(article().category)} />
												<FactRow label="Ton" value={SENTIMENT_LABELS[article().sentiment]} />
												<FactRow label="Okuma" value={`${popupDossier()?.readingTime ?? 1} dk`} />
												<FactRow label="Derinlik" value={popupDossier()?.depth ?? '-'} />
											</div>
										</div>

										<div>
											<div class="dp-editorial-section-title">
												<span>Editoryal Sinyal</span>
											</div>
											<div class="dp-editorial-metric-stack">
												<SignalBar label="Tazelik" value={`${popupDossier()?.freshness ?? 0}%`} share={popupDossier()?.freshness ?? 0} tone="positive" detail={formatRelativeTime(article().pubDate)} />
												<SignalBar label="Masa skoru" value={`${popupDossier()?.desk.score ?? 0}%`} share={popupDossier()?.desk.score ?? 0} tone="accent" detail={popupDossier()?.desk.detail ?? '-'} />
												<SignalBar label="Dunya etkisi" value={`${popupDossier()?.relevance.world ?? 0}%`} share={popupDossier()?.relevance.world ?? 0} tone="warning" />
												<SignalBar label="Piyasa etkisi" value={`${popupDossier()?.relevance.market ?? 0}%`} share={popupDossier()?.relevance.market ?? 0} tone="danger" />
												<SignalBar label="Aciliyet" value={`${popupDossier()?.relevance.urgency ?? 0}%`} share={popupDossier()?.relevance.urgency ?? 0} tone="muted" />
											</div>
										</div>
									</div>

									<Show when={popupDossier()?.isShort && (popupDossier()?.related.length ?? 0) > 0}>
										<div class="dp-editorial-modal-related">
											<div class="dp-editorial-section-title">
												<span>Baglam</span>
											</div>
											<div class="dp-editorial-related-list">
												<For each={popupDossier()?.related ?? []}>
													{(related) => (
														<a href={related.link} target="_blank" rel="noreferrer" class="dp-editorial-related-item">
															<span class="dp-editorial-related-meta">{formatCategoryLabel(related.category)} • {related.sourceName}</span>
															<span class="dp-editorial-related-title">{related.title}</span>
															<span class="dp-editorial-related-copy">{truncateText(related.cleanDescription || related.cleanContent, 160)}</span>
														</a>
													)}
												</For>
											</div>
										</div>
									</Show>

									<div class="dp-editorial-modal-footer">
										<a href={article().link} target="_blank" rel="noreferrer" class="dp-editorial-action">Kaynagi Ac</a>
										<button type="button" class="dp-editorial-action is-ghost" onClick={closePopup}>Kapat</button>
									</div>
								</div>
							</div>
						</div>
					</Portal>
				)}
			</Show>
		</div>
	);
}

function DeskShareBar(props: { label: string; value: string; share: number; tone: 'accent' | 'muted' | 'positive' | 'warning' | 'danger' }) {
	return (
		<div class="dp-editorial-stat-row">
			<div class="dp-editorial-stat-head">
				<span>{props.label}</span>
				<span>{props.value}</span>
			</div>
			<div class="dp-editorial-bar-track">
				<div class={`dp-editorial-bar-fill is-${props.tone}`} style={{ width: `${Math.max(props.share, 6)}%` }} />
			</div>
		</div>
	);
}

function DeskInfoBox(props: { label: string; value: string; detail: string; tone: 'positive' | 'negative' | 'muted' }) {
	return (
		<div class="dp-editorial-info-box">
			<div class={`dp-editorial-info-value is-${props.tone}`}>{props.value}</div>
			<div class="dp-editorial-info-label">{props.label}</div>
			<div class="dp-editorial-info-detail">{props.detail}</div>
		</div>
	);
}

function FactRow(props: { label: string; value: string }) {
	return (
		<div class="dp-editorial-fact-row">
			<span>{props.label}</span>
			<span>{props.value}</span>
		</div>
	);
}

function SignalBar(props: { label: string; value: string; share: number; tone: 'accent' | 'muted' | 'positive' | 'warning' | 'danger'; detail?: string }) {
	return (
		<div class="dp-editorial-signal-row">
			<div class="dp-editorial-stat-head">
				<span>{props.label}</span>
				<span class={`is-${props.tone}`}>{props.value}</span>
			</div>
			<div class="dp-editorial-bar-track">
				<div class={`dp-editorial-bar-fill is-${props.tone}`} style={{ width: `${Math.max(props.share, 8)}%` }} />
			</div>
			<Show when={props.detail}>
				<div class="dp-editorial-signal-detail">{props.detail}</div>
			</Show>
		</div>
	);
}

function EditorialEmptyState(props: { onReset: () => void }) {
	return (
		<div class="dp-editorial-state-card">
			<div class="dp-editorial-section-kicker">Bos gorunum</div>
			<h2 class="dp-editorial-state-title">Filtrelerle eslesen haber yok</h2>
			<p class="dp-editorial-state-copy">Arama veya filtreler editorial rail alanını fazla daralttı. Temizleyince tüm masa geri gelir.</p>
			<button type="button" onClick={props.onReset} class="dp-editorial-action mt-5">Filtreleri temizle</button>
		</div>
	);
}
