import { createMemo, createResource, createSignal, For, onCleanup, onMount, Show } from 'solid-js';
import type { SocialPlatform, SocialPost } from '../../../../shared/types/social';
import { apiUrl } from '../../lib/api';
import { createLocaleSignal } from '../../lib/locale';
import { parseTimestamp } from '../../lib/timestamp';

type SortMode = 'signal' | 'latest' | 'engagement' | 'rising';

type SocialPayload = {
	posts: SocialPost[];
	count: number;
	lastUpdated?: number;
};

type CommunityStat = {
	label: string;
	count: number;
	platform: SocialPlatform;
};

const PLATFORMS: (SocialPlatform | 'All')[] = ['All', 'Reddit', 'HackerNews', 'GitHub', 'YouTube'];

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
	{ value: 'signal', label: 'Hot' },
	{ value: 'latest', label: 'New' },
	{ value: 'engagement', label: 'Top' },
	{ value: 'rising', label: 'Rising' },
];

const LEGAL_LINKS = ['User Agreement', 'Privacy', 'Content Policy'];

const getPlatformLabel = (platform: SocialPlatform | 'All') => {
	switch (platform) {
		case 'All':
			return 'Tüm Kaynaklar';
		case 'HackerNews':
			return 'Hacker News';
		default:
			return platform;
	}
};

const formatCompactNumber = (value: number) => {
	if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
	if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
	return value.toLocaleString('tr-TR');
};

const formatRelativeTime = (timestamp: number) => {
	const date = parseTimestamp(timestamp);
	if (!date) return '-';

	const diffMs = date.getTime() - Date.now();
	const diffMinutes = Math.round(diffMs / 60000);
	const rtf = new Intl.RelativeTimeFormat('tr', { numeric: 'auto' });

	if (Math.abs(diffMinutes) < 1) return 'simdi';
	if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, 'minute');
	const diffHours = Math.round(diffMinutes / 60);
	if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');
	const diffDays = Math.round(diffHours / 24);
	return rtf.format(diffDays, 'day');
};

const formatAbsoluteTime = (timestamp: number) => {
	const date = parseTimestamp(timestamp);
	if (!date) return 'Senkron bekleniyor';
	return date.toLocaleString('tr-TR', {
		day: '2-digit',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit',
	});
};

const getCommunityLabel = (post: SocialPost) => post.metadata?.trim() || getPlatformLabel(post.platform);

const getSearchableText = (post: SocialPost) =>
	[post.title, post.description, post.metadata, post.author, post.platform].filter(Boolean).join(' ').toLocaleLowerCase('tr-TR');

const getAgeHours = (post: SocialPost) => {
	const timestamp = parseTimestamp(post.timestamp)?.getTime();
	if (!timestamp) return Number.POSITIVE_INFINITY;
	return Math.max((Date.now() - timestamp) / 3_600_000, 0);
};

const getSignalRank = (post: SocialPost) => {
	const engagement = Math.log10(post.score + 1) + Math.log10((post.commentsCount ?? 0) + 1) * 0.42;
	const decay = Math.log2(getAgeHours(post) + 2);
	const platformBias = post.platform === 'GitHub' ? 0.92 : post.platform === 'YouTube' ? 0.88 : 1;
	return (engagement / decay) * platformBias;
};

const getRisingRank = (post: SocialPost) => {
	const comments = post.commentsCount ?? 0;
	const engagementLift = Math.log10(post.score + comments + 2);
	const freshness = 1 / Math.max(getAgeHours(post) + 1.1, 1.1);
	return engagementLift * freshness;
};

const getReasonTag = (post: SocialPost, sortMode: SortMode) => {
	if (sortMode === 'latest' || getAgeHours(post) <= 3) return 'Yeni';
	if (sortMode === 'rising' || (post.commentsCount ?? 0) >= 40) return 'Yorumlarda hareketli';
	if (sortMode === 'engagement' || post.score >= 1000) return 'Top';
	return 'Hot';
};

const getSourceContext = (post: SocialPost) => {
	if (post.platform === 'Reddit') return post.author ? `${getCommunityLabel(post)} • u/${post.author}` : getCommunityLabel(post);
	if (post.platform === 'GitHub') return getCommunityLabel(post);
	if (post.platform === 'HackerNews') return post.author ? `Hacker News • ${post.author}` : 'Hacker News';
	if (post.platform === 'YouTube') return getCommunityLabel(post);
	return getCommunityLabel(post);
};

const getOpenLabel = (platform: SocialPlatform) => {
	if (platform === 'GitHub') return 'Kaynakta Ac (GitHub)';
	if (platform === 'Reddit') return 'Kaynakta Ac (Reddit)';
	if (platform === 'HackerNews') return 'Kaynakta Ac (HN)';
	if (platform === 'YouTube') return 'Kaynakta Ac (YouTube)';
	return 'Kaynakta Ac';
};

export default function TrendingGrid() {
	const locale = createLocaleSignal();
	const t = (tr: string, en: string) => (locale() === 'en' ? en : tr);
	const [selectedPlatform, setSelectedPlatform] = createSignal<SocialPlatform | 'All'>('All');
	const [selectedCommunity, setSelectedCommunity] = createSignal('All');
	const [searchQuery, setSearchQuery] = createSignal('');
	const [sortMode, setSortMode] = createSignal<SortMode>('signal');

	const [socialData, { refetch }] = createResource<SocialPayload>(async () => {
		const response = await fetch(apiUrl('/api/social'), {
			credentials: 'include',
		});

		if (!response.ok) throw new Error(t('Sosyal feed yüklenemedi', 'Social feed could not be loaded'));
		return await response.json() as SocialPayload;
	});

	const interval = setInterval(() => refetch(), 60 * 60 * 1000);
	onCleanup(() => clearInterval(interval));

	onMount(() => {
		const onSearch = (event: Event) => {
			const detail = (event as CustomEvent<string>).detail;
			setSearchQuery(detail ?? '');
		};

		const onRefresh = () => refetch();

		window.addEventListener('social:search', onSearch as EventListener);
		window.addEventListener('social:refresh', onRefresh);

		onCleanup(() => {
			window.removeEventListener('social:search', onSearch as EventListener);
			window.removeEventListener('social:refresh', onRefresh);
		});
	});

	const allPosts = createMemo(() => socialData()?.posts ?? []);

	const platformCounts = createMemo(() => {
		const counts = new Map<SocialPlatform, number>();
		for (const post of allPosts()) counts.set(post.platform, (counts.get(post.platform) ?? 0) + 1);
		return counts;
	});

	const postsForSidebar = createMemo(() => {
		const query = searchQuery().toLocaleLowerCase('tr-TR').trim();
		let filtered = allPosts();

		if (selectedPlatform() !== 'All') filtered = filtered.filter((post) => post.platform === selectedPlatform());
		if (query) filtered = filtered.filter((post) => getSearchableText(post).includes(query));

		return filtered;
	});

	const communityStats = createMemo<CommunityStat[]>(() => {
		const counts = new Map<string, CommunityStat>();
		for (const post of postsForSidebar()) {
			const label = getCommunityLabel(post);
			const current = counts.get(label);
			if (current) {
				current.count += 1;
				continue;
			}
			counts.set(label, { label, count: 1, platform: post.platform });
		}

		return [...counts.values()]
			.sort((left, right) => right.count - left.count || left.label.localeCompare(right.label, 'tr-TR'))
			.slice(0, 12);
	});

	const filteredPosts = createMemo(() => {
		const query = searchQuery().toLocaleLowerCase('tr-TR').trim();
		let filtered = allPosts();

		if (selectedPlatform() !== 'All') filtered = filtered.filter((post) => post.platform === selectedPlatform());
		if (selectedCommunity() !== 'All') filtered = filtered.filter((post) => getCommunityLabel(post) === selectedCommunity());
		if (query) filtered = filtered.filter((post) => getSearchableText(post).includes(query));

		return [...filtered].sort((left, right) => {
			if (sortMode() === 'latest') return (parseTimestamp(right.timestamp)?.getTime() ?? 0) - (parseTimestamp(left.timestamp)?.getTime() ?? 0);
			if (sortMode() === 'engagement') {
				const scoreDiff = right.score - left.score;
				if (scoreDiff !== 0) return scoreDiff;
				return (right.commentsCount ?? 0) - (left.commentsCount ?? 0);
			}
			if (sortMode() === 'rising') {
				const rankDiff = getRisingRank(right) - getRisingRank(left);
				if (Math.abs(rankDiff) > 0.0001) return rankDiff;
				return (parseTimestamp(right.timestamp)?.getTime() ?? 0) - (parseTimestamp(left.timestamp)?.getTime() ?? 0);
			}

			const rankDiff = getSignalRank(right) - getSignalRank(left);
			if (Math.abs(rankDiff) > 0.0001) return rankDiff;
			return (parseTimestamp(right.timestamp)?.getTime() ?? 0) - (parseTimestamp(left.timestamp)?.getTime() ?? 0);
		});
	});

	const summaryStats = createMemo(() => {
		const posts = filteredPosts();
		return {
			posts: posts.length,
			totalScore: posts.reduce((sum, post) => sum + post.score, 0),
			totalComments: posts.reduce((sum, post) => sum + (post.commentsCount ?? 0), 0),
		};
	});

	const topPlatforms = createMemo(() =>
		PLATFORMS
			.filter((platform): platform is SocialPlatform => platform !== 'All')
			.map((platform) => ({ platform, count: platformCounts().get(platform) ?? 0 }))
			.sort((left, right) => right.count - left.count)
	);

	const activeCommunities = createMemo(() => communityStats().slice(0, 5));

	const clearFilters = () => {
		setSelectedPlatform('All');
		setSelectedCommunity('All');
		setSearchQuery('');
	};

	return (
		<div class="dp-social-workspace">
			<div class="dp-social-layout">
				<section class="dp-social-feed">
					<div class="dp-social-cli">
						<span class="dp-social-cli-prefix">$ query --feed=all --sort={SORT_OPTIONS.find((option) => option.value === sortMode())?.label.toLowerCase() ?? 'hot'}</span>
						<input
							type="text"
							value={searchQuery()}
							onInput={(event) => setSearchQuery(event.currentTarget.value)}
							placeholder={t('Reddit, GitHub ve Hacker News kaynaklarından ham node’lar toplanıyor...', 'Aggregating raw nodes from Reddit, GitHub, HackerNews...')}
							class="dp-social-cli-input"
						/>
					</div>

					<div class="dp-social-sort-bar">
						<For each={SORT_OPTIONS}>
							{(option) => (
								<button type="button" class={`dp-social-sort-btn ${sortMode() === option.value ? 'is-active' : ''}`} onClick={() => setSortMode(option.value)}>
									{option.label}
								</button>
							)}
						</For>
						<span class="dp-social-sort-meta">{t('Güncelleme', 'Updated')}: {formatAbsoluteTime(socialData()?.lastUpdated ?? Date.now())}</span>
					</div>

					<Show when={socialData.loading}>
						<div class="dp-social-state-card">{t('Gönderiler yükleniyor...', 'Posts are loading...')}</div>
					</Show>

					<Show when={socialData.error}>
						<div class="dp-social-state-card is-error">Hata: {socialData.error.message}</div>
					</Show>

					<Show
						when={!socialData.loading && !socialData.error && filteredPosts().length > 0}
						fallback={
							<Show when={!socialData.loading && !socialData.error}>
								<div class="dp-social-state-card">
									{searchQuery().trim() || selectedCommunity() !== 'All' || selectedPlatform() !== 'All'
										? t('Seçili filtrelerle eşleşen gönderi bulunamadı.', 'No posts match the selected filters.')
										: t('Henüz gösterilecek gönderi yok.', 'There are no posts to display yet.')}
								</div>
							</Show>
						}
					>
						<div class="dp-social-feed-list">
							<For each={filteredPosts()}>
								{(post) => (
									<article class="dp-social-post-card">
										<div class="dp-social-vote-col">
											<button type="button" class="dp-social-vote-btn">▲</button>
											<span class="dp-social-vote-score">{formatCompactNumber(post.score)}</span>
											<button type="button" class="dp-social-vote-btn">▼</button>
										</div>
										<div class="dp-social-post-content">
											<div class="dp-social-post-meta">
												<a href={post.url} target="_blank" rel="noopener noreferrer" class="dp-social-post-source">
													{getSourceContext(post)}
												</a>
												<span>•</span>
												<span>{formatRelativeTime(post.timestamp)}</span>
												<Show when={post.platform !== 'Reddit'}>
													<>
														<span>•</span>
														<span class="dp-social-post-tag">{getPlatformLabel(post.platform)}</span>
													</>
												</Show>
											</div>

											<div class="dp-social-post-inner">
												<div class="dp-social-post-text">
													<a href={post.url} target="_blank" rel="noopener noreferrer" class="dp-social-post-title">
														{post.title}
													</a>
													<div class="dp-social-post-body">{post.description || t(`${getCommunityLabel(post)} kaynak akışı bu gönderiyi öne çıkarıyor.`, `${getCommunityLabel(post)} source momentum is pushing this post forward.`)}</div>
												</div>
												<Show when={post.thumbnail}>
													<div class="dp-social-post-thumbnail">
														<img src={post.thumbnail!} alt="" loading="lazy" />
													</div>
												</Show>
											</div>

											<div class="dp-social-post-footer">
												<div class="dp-social-footer-btn">💬 {(post.commentsCount ?? 0).toLocaleString(locale() === 'en' ? 'en-US' : 'tr-TR')} {t('yorum', 'comments')}</div>
												<div class="dp-social-footer-btn">↗ {t('Paylaş', 'Share')}</div>
												<div class="dp-social-footer-btn">{getReasonTag(post, sortMode())}</div>
												<a href={post.url} target="_blank" rel="noopener noreferrer" class="dp-social-footer-link">
													{getOpenLabel(post.platform)}
												</a>
											</div>
										</div>
									</article>
								)}
							</For>
						</div>
					</Show>
				</section>

				<aside class="dp-social-sidebar">
					<div class="dp-social-widget">
						<div class="dp-social-widget-head">{t('Sosyal Genel Bakış', 'Social Overview')}</div>
						<div class="dp-social-widget-body">
							{t('Tüm kaynaklardan editöryal olarak öne çıkan sosyal gönderiler. Yüksek kontrastlı zinc layout devrede.', 'Editorially highlighted social posts from every source. The high-contrast zinc layout is active.')}
							<div class="dp-social-widget-stats">
								<div class="dp-social-widget-stat">
									<span class="dp-social-widget-value">{summaryStats().posts}</span>
									<span class="dp-social-widget-label">{t('Feed Görünümü', 'Feed Views')}</span>
								</div>
								<div class="dp-social-widget-stat">
									<span class="dp-social-widget-value">{formatCompactNumber(summaryStats().totalScore)}</span>
									<span class="dp-social-widget-label">{t('Sinyaller', 'Signals')}</span>
								</div>
								<div class="dp-social-widget-stat">
									<span class="dp-social-widget-value">{formatCompactNumber(summaryStats().totalComments)}</span>
									<span class="dp-social-widget-label">{t('Yorumlar', 'Comments')}</span>
								</div>
								<div class="dp-social-widget-stat">
									<span class="dp-social-widget-value">{filteredPosts().length ? getPlatformLabel(filteredPosts()[0]!.platform) : t('Boşta', 'Idle')}</span>
									<span class="dp-social-widget-label">{t('Öne Çıkan Akış', 'Top Feed')}</span>
								</div>
							</div>
							<button type="button" class="dp-social-primary-button" onClick={() => refetch()}>{t('VERİ KÜMESİNİ DIŞA AKTAR', 'EXPORT DATASET')}</button>
						</div>
					</div>

					<div class="dp-social-widget">
						<div class="dp-social-widget-head">{t('Platform Dağılımı', 'Platform Mix')}</div>
						<div class="dp-social-widget-body">
							<ul class="dp-social-community-list">
								<For each={topPlatforms()}>
									{(item) => (
										<li class="dp-social-community-item">
											<span class="dp-social-community-name">{getPlatformLabel(item.platform)}</span>
											<span class="dp-social-community-count">{item.count} {t('node', 'nodes')}</span>
										</li>
									)}
								</For>
							</ul>
						</div>
					</div>

					<div class="dp-social-widget">
						<div class="dp-social-widget-head">{t('Topluluk Nabzı', 'Community Pulse')}</div>
						<div class="dp-social-widget-body">
							<ul class="dp-social-community-list">
								<For each={activeCommunities()}>
									{(community) => (
										<li class="dp-social-community-item">
											<button
												type="button"
												class="dp-social-community-button"
												onClick={() => setSelectedCommunity(community.label)}
											>
												<span class="dp-social-community-name">{community.label}</span>
												<span class="dp-social-community-count">{community.count}</span>
											</button>
										</li>
									)}
								</For>
							</ul>
						</div>
					</div>

					<div class="dp-social-widget">
						<div class="dp-social-widget-head">{t('Filtreler', 'Filters')}</div>
						<div class="dp-social-widget-body">
							<div class="dp-social-filter-group">
								<select
									class="dp-social-select"
									value={selectedPlatform()}
									onChange={(event) => {
										setSelectedPlatform(event.currentTarget.value as SocialPlatform | 'All');
										setSelectedCommunity('All');
									}}
								>
									<For each={PLATFORMS}>
										{(platform) => <option value={platform}>{getPlatformLabel(platform)}</option>}
									</For>
								</select>
								<select class="dp-social-select" value={selectedCommunity()} onChange={(event) => setSelectedCommunity(event.currentTarget.value)}>
									<option value="All">{t('Tüm topluluklar', 'All communities')}</option>
									<For each={communityStats()}>
										{(community) => <option value={community.label}>{community.label}</option>}
									</For>
								</select>
							</div>
							<Show when={selectedPlatform() !== 'All' || selectedCommunity() !== 'All' || Boolean(searchQuery().trim())}>
								<button type="button" class="dp-social-secondary-button" onClick={clearFilters}>{t('Filtreleri temizle', 'Clear filters')}</button>
							</Show>
						</div>
					</div>

					<div class="dp-social-legal">
						<For each={locale() === 'en' ? LEGAL_LINKS : ['Kullanıcı Sözleşmesi', 'Gizlilik', 'İçerik Politikası']}>
							{(link, index) => <span>{link}{index() < LEGAL_LINKS.length - 1 ? ' • ' : ''}</span>}
						</For>
						<div>DP // ZINC THEME DEPLOYED</div>
					</div>
				</aside>
			</div>
		</div>
	);
}
