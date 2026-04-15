import type { SocialPlatform, SocialPost } from '../../../../shared/types/social';
import { isReasonableFutureDate, parseTimestamp } from '../../lib/timestamp';
import { getPreferredThumbnailUrl, normalizeHtmlUrl } from '../../lib/url';
import { createLocaleSignal } from '../../lib/locale';

interface PostCardProps {
	post: SocialPost;
	recommendationReason: string;
}

const PLATFORM_LABELS: Record<SocialPlatform, string> = {
	Reddit: 'Reddit',
	HackerNews: 'Hacker News',
	GitHub: 'GitHub',
	YouTube: 'YouTube',
};

const PLATFORM_TONES: Record<SocialPlatform, string> = {
	Reddit: 'is-reddit',
	HackerNews: 'is-hn',
	GitHub: 'is-github',
	YouTube: 'is-youtube',
};

export default function PostCard(props: PostCardProps) {
	const locale = createLocaleSignal();
	const t = (tr: string, en: string) => (locale() === 'en' ? en : tr);
	const normalizedPostUrl = () => normalizeHtmlUrl(props.post.url);
	const normalizedThumbnailUrl = () => getPreferredThumbnailUrl(props.post.thumbnail);

	const formatDate = (timestamp: number) => {
		const date = parseTimestamp(timestamp);
		if (!date) return '-';

		const now = Date.now();
		if (!isReasonableFutureDate(date, now)) return '-';

		const diffMs = now - date.getTime();
		if (diffMs < 60 * 1000) return t('az önce', 'just now');

		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		const diffDays = Math.floor(diffHours / 24);

		if (diffHours < 1) {
			const diffMins = Math.floor(diffMs / (1000 * 60));
			return `${diffMins} ${t('dk önce', 'min ago')}`;
		}

		if (diffHours < 24) {
			return `${diffHours} ${t('saat önce', 'hr ago')}`;
		}

		if (diffDays < 7) {
			return `${diffDays} ${t('gün önce', 'days ago')}`;
		}

		return date.toLocaleDateString('tr-TR', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	};

	const formatCompactNumber = (value: number) => {
		if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
		if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
		return value.toString();
	};

	const getDomain = () => {
		try {
			return new URL(normalizedPostUrl()).hostname.replace(/^www\./i, '');
		} catch {
			return '';
		}
	};

	const getCommunityLabel = () => props.post.metadata?.trim() || PLATFORM_LABELS[props.post.platform];

	const getTopLineLabel = () => {
		const community = getCommunityLabel();
		switch (props.post.platform) {
			case 'Reddit':
				return community.startsWith('r/') ? community : `r/${community.replace(/^r\//, '')}`;
			case 'HackerNews':
				return 'Hacker News';
			default:
				return community;
		}
	};

	const getAuthorLabel = () => props.post.author?.trim() || null;

	const getByline = () => {
		const age = formatDate(props.post.timestamp);
		return `${age} • ${props.recommendationReason}`;
	};

	const getReasonTone = () => {
		if (props.recommendationReason === t('Şu anda öne çıkan', 'Trending now')) return 'is-hot';
		if (props.recommendationReason === t('Yorumlarda hareketli', 'Trending in comments')) return 'is-rising';
		if (props.recommendationReason === t('Yeni gönderi', 'New post')) return 'is-new';
		return 'is-neutral';
	};

	const getSecondarySource = () => {
		const domain = getDomain();
		if (!domain) return PLATFORM_LABELS[props.post.platform];
		if (props.post.platform === 'Reddit') return domain;
		return `${PLATFORM_LABELS[props.post.platform]} • ${domain}`;
	};

	const getCommentLabel = () => {
		if (props.post.commentsCount === undefined) {
			return props.post.platform === 'GitHub' ? t('tartışma yok', 'no discussion') : t('yorum verisi yok', 'no comment data');
		}

		if (props.post.platform === 'YouTube') return `${formatCompactNumber(props.post.commentsCount)} ${t('yorum', 'comments')}`;
		return `${formatCompactNumber(props.post.commentsCount)} ${t('yorum', 'comments')}`;
	};

	const getScoreLabel = () => {
		const value = formatCompactNumber(props.post.score);
		if (props.post.platform === 'GitHub') return `${value} ${t('yıldız', 'stars')}`;
		if (props.post.platform === 'YouTube') return `${value} ${t('beğeni', 'likes')}`;
		return `${value} ${t('puan', 'points')}`;
	};

	const hasThumbnail = () => {
		const value = normalizedThumbnailUrl();
		if (!value) return false;
		return /^https?:\/\//i.test(value);
	};

	return (
		<a href={normalizedPostUrl()} target="_blank" rel="noopener noreferrer" class="reddit-social-post">
			<div class="reddit-social-vote-rail" aria-hidden="true">
				<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
					<path d="M10 4 16 11H4l6-7Z"></path>
				</svg>
				<div class="reddit-social-vote-score">{formatCompactNumber(props.post.score)}</div>
				<svg class="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
					<path d="m10 16-6-7h12l-6 7Z"></path>
				</svg>
			</div>

			<div class="reddit-social-post-body">
				<div class="reddit-social-post-meta-stack">
					<div class="reddit-social-post-context-row">
						<span class={`reddit-social-reason-pill ${getReasonTone()}`}>{props.recommendationReason}</span>
						<span class="reddit-social-community-link">{getTopLineLabel()}</span>
						<span class={`reddit-social-platform-pill ${PLATFORM_TONES[props.post.platform]}`}>{PLATFORM_LABELS[props.post.platform]}</span>
					</div>
					<div class="reddit-social-post-context-row subdued">
						<span class="reddit-social-meta-copy">{getByline()}</span>
						<span class="reddit-social-meta-dot"></span>
						<span class="reddit-social-meta-copy">{getSecondarySource()}</span>
						{getAuthorLabel() && (
							<>
								<span class="reddit-social-meta-dot"></span>
								<span class="reddit-social-meta-copy">{getAuthorLabel()}</span>
							</>
						)}
					</div>
				</div>

				<div class="reddit-social-post-copy">
					<h3 class="reddit-social-post-title">{props.post.title}</h3>
					{props.post.description && <p class="reddit-social-post-snippet">{props.post.description}</p>}
				</div>

				<div class="reddit-social-post-content-grid">
					<div class="reddit-social-post-stat-strip">
						<span class="reddit-social-post-stat">{getScoreLabel()}</span>
						<span class="reddit-social-post-stat">{getCommentLabel()}</span>
						<span class="reddit-social-post-stat">{getSecondarySource()}</span>
					</div>

					{hasThumbnail() && (
						<div class="reddit-social-post-media">
							<img src={normalizedThumbnailUrl()} alt="" loading="lazy" class="reddit-social-post-image" />
						</div>
					)}
				</div>

				<div class="reddit-social-post-actions">
					<span class="reddit-social-post-action">{getCommentLabel()}</span>
					<span class="reddit-social-post-action">{t('Paylaş', 'Share')}</span>
					<span class="reddit-social-post-action">{t('Kaynakta aç', 'Open source')}</span>
					<span class="reddit-social-post-action subtle">{getScoreLabel()}</span>
				</div>
			</div>
		</a>
	);
}
