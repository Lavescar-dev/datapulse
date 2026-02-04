<script lang="ts">
	import { fetchApi } from '$lib/utils/api';
	import type { NewsArticle } from '$lib/types';
	import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import { ExternalLink } from 'lucide-svelte';

	let articles = $state<NewsArticle[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	const categoryVariant: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
		technology: 'info',
		business: 'success',
		politics: 'warning',
		sports: 'default',
		entertainment: 'danger'
	};

	function timeAgo(dateStr: string): string {
		try {
			const diff = Date.now() - new Date(dateStr).getTime();
			const hours = Math.floor(diff / (1000 * 60 * 60));
			if (hours < 1) return 'Just now';
			if (hours < 24) return `${hours}h ago`;
			const days = Math.floor(hours / 24);
			return `${days}d ago`;
		} catch {
			return dateStr;
		}
	}

	async function loadNews() {
		try {
			const data = await fetchApi<{ articles: NewsArticle[] }>('/api/news/feed');
			articles = data.articles;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load news';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		loadNews();
	});
</script>

<svelte:head>
	<title>News | DataPulse</title>
</svelte:head>

{#if loading}
	<div class="flex h-64 items-center justify-center">
		<LoadingSpinner />
	</div>
{:else if error}
	<div class="rounded-xl border border-danger/30 bg-danger/10 p-6 text-center text-danger">
		<p class="font-medium">Failed to load news</p>
		<p class="mt-1 text-sm opacity-80">{error}</p>
	</div>
{:else}
	<div class="space-y-4">
		{#each articles as article}
			<article class="rounded-xl border border-border bg-surface p-5 transition-colors hover:bg-surface-hover">
				<div class="mb-2 flex items-start justify-between gap-4">
					<h3 class="text-lg font-semibold leading-snug">{article.title}</h3>
					<a
						href={article.url}
						target="_blank"
						rel="noopener noreferrer"
						class="shrink-0 rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
					>
						<ExternalLink size={16} />
					</a>
				</div>
				<div class="mb-3 flex flex-wrap items-center gap-2">
					<Badge variant="default">{article.source}</Badge>
					<Badge variant={categoryVariant[article.category] ?? 'default'}>{article.category}</Badge>
					<span class="text-xs text-text-muted">{timeAgo(article.published)}</span>
				</div>
				<p class="text-sm leading-relaxed text-text-muted">{article.summary}</p>
			</article>
		{/each}
	</div>
{/if}
