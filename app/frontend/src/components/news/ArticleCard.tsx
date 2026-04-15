import { Show } from 'solid-js';
import type { NewsArticle } from '../../../../shared/types/news';
import { createLocaleSignal } from '../../lib/locale';

type ArticleCardVariant = 'default' | 'featured' | 'compact';

interface ArticleCardProps {
	article: NewsArticle;
	variant?: ArticleCardVariant;
	onPreview?: (article: NewsArticle) => void;
	isActive?: boolean;
}

export const CATEGORY_STYLES: Record<string, string> = {
	Tech: 'border-blue-500/20 bg-blue-500/10 text-blue-200',
	Finance: 'border-amber-500/20 bg-amber-500/10 text-amber-200',
	Crypto: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-200',
	World: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200',
	Turkey: 'border-rose-500/20 bg-rose-500/10 text-rose-200',
	General: 'border-slate-600/60 bg-slate-800/70 text-slate-200',
};

export const TONE_STYLES: Record<string, string> = {
	positive: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
	negative: 'border-rose-500/20 bg-rose-500/10 text-rose-200',
	neutral: 'border-slate-600/60 bg-slate-800/70 text-slate-200',
};

export const formatCategoryLabel = (category: string, locale: 'tr' | 'en' = 'tr') => {
	switch (category) {
		case 'Tech':
			return locale === 'en' ? 'Technology' : 'Teknoloji';
		case 'Finance':
			return locale === 'en' ? 'Finance' : 'Finans';
		case 'Crypto':
			return locale === 'en' ? 'Crypto' : 'Kripto';
		case 'World':
			return locale === 'en' ? 'World' : 'Dünya';
		case 'Turkey':
			return locale === 'en' ? 'Turkey' : 'Türkiye';
		case 'General':
			return locale === 'en' ? 'Top stories' : 'Gündem';
		default:
			return category;
	}
};

export default function ArticleCard(props: ArticleCardProps) {
	const locale = createLocaleSignal();
	const variant = () => props.variant ?? 'default';
	const isFeatured = () => variant() === 'featured';
	const isCompact = () => variant() === 'compact';

	const baseClass = () => {
		if (isCompact()) {
			return `group flex h-full flex-col gap-3 rounded-[1.15rem] border border-slate-800/70 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(8,12,24,1))] px-4 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-700/80 hover:bg-[linear-gradient(180deg,rgba(21,31,53,0.98),rgba(9,14,28,1))] hover:shadow-[0_20px_48px_rgba(2,6,23,0.28)] ${props.isActive ? 'border-blue-500/35 ring-1 ring-blue-500/20 shadow-[0_16px_48px_rgba(59,130,246,0.16)]' : ''}`;
		}

		if (isFeatured()) {
			return `group block h-full overflow-hidden rounded-[1.45rem] border border-slate-800/70 bg-[linear-gradient(180deg,rgba(16,24,43,0.99),rgba(8,12,24,1))] transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-700/80 hover:bg-[linear-gradient(180deg,rgba(21,31,53,1),rgba(10,15,29,1))] hover:shadow-[0_28px_80px_rgba(2,6,23,0.42)] ${props.isActive ? 'border-blue-500/35 ring-1 ring-blue-500/20 shadow-[0_22px_70px_rgba(59,130,246,0.16)]' : ''}`;
		}

		return `group block h-full rounded-[1.2rem] border border-slate-800/70 bg-[linear-gradient(180deg,rgba(14,21,39,0.96),rgba(7,11,22,1))] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-700/80 hover:bg-[linear-gradient(180deg,rgba(19,28,46,0.98),rgba(8,13,24,1))] hover:shadow-[0_20px_48px_rgba(2,6,23,0.26)] sm:p-5 ${props.isActive ? 'border-blue-500/35 ring-1 ring-blue-500/20 shadow-[0_16px_48px_rgba(59,130,246,0.14)]' : ''}`;
	};

	const handlePreview = () => props.onPreview?.(props.article);
	const categoryLabel = () => formatCategoryLabel(props.article.category, locale());

	const titleClass = () => {
		if (isFeatured()) {
			return 'crypto-terminal-copy text-xl font-semibold leading-snug text-white transition-colors duration-200 group-hover:text-slate-50 line-clamp-3 sm:text-[1.55rem]';
		}

		if (isCompact()) {
			return 'crypto-terminal-copy text-sm font-semibold leading-5 text-white transition-colors duration-200 group-hover:text-slate-50 line-clamp-2';
		}

		return 'crypto-terminal-copy text-base font-semibold leading-6 text-white transition-colors duration-200 group-hover:text-slate-50 line-clamp-3';
	};

	if (isCompact()) {
		return (
			<a href={props.article.link} target="_blank" rel="noopener noreferrer" class={baseClass()} onMouseEnter={handlePreview} onFocus={handlePreview}>
				<h3 class={titleClass()}>{props.article.title}</h3>
			</a>
		);
	}

	if (isFeatured()) {
		return (
			<a href={props.article.link} target="_blank" rel="noopener noreferrer" class={baseClass()} onMouseEnter={handlePreview} onFocus={handlePreview}>
				<Show when={props.article.imageUrl}>
					{(imgUrl) => (
						<div class="relative h-48 w-full overflow-hidden sm:h-56">
							<div class="absolute inset-0 z-10 bg-[linear-gradient(180deg,rgba(7,12,24,0)_0%,rgba(7,12,24,0.1)_45%,rgba(7,12,24,0.85)_100%)]" />
							<img
								src={imgUrl()}
								alt={props.article.title}
								class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
								loading="lazy"
							/>
						</div>
					)}
				</Show>
				<div class="flex h-full flex-col p-5 sm:p-6">
					<div>
						<h3 class={titleClass()}>{props.article.title}</h3>
					</div>
				</div>
			</a>
		);
	}

	return (
		<a href={props.article.link} target="_blank" rel="noopener noreferrer" class={baseClass()} onMouseEnter={handlePreview} onFocus={handlePreview}>
			<div class="flex h-full flex-col">
				<div>
					<h3 class={titleClass()}>{props.article.title}</h3>
				</div>
			</div>
		</a>
	);
}
