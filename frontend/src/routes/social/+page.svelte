<script lang="ts">
	import { fetchApi } from '$lib/utils/api';
	import type { SocialTrend } from '$lib/types';
	import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import { TrendingUp } from 'lucide-svelte';

	let trends = $state<SocialTrend[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	async function loadTrends() {
		try {
			const data = await fetchApi<{ trends: SocialTrend[] }>('/api/social/trends');
			trends = data.trends;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load trends';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		loadTrends();
	});
</script>

<svelte:head>
	<title>Social | DataPulse</title>
</svelte:head>

{#if loading}
	<div class="flex h-64 items-center justify-center">
		<LoadingSpinner />
	</div>
{:else if error}
	<div class="rounded-xl border border-danger/30 bg-danger/10 p-6 text-center text-danger">
		<p class="font-medium">Failed to load trends</p>
		<p class="mt-1 text-sm opacity-80">{error}</p>
	</div>
{:else}
	<div class="space-y-3">
		{#each trends as trend}
			{@const total = trend.sentiment.positive + trend.sentiment.negative + trend.sentiment.neutral}
			{@const posPercent = total > 0 ? (trend.sentiment.positive / total) * 100 : 0}
			{@const negPercent = total > 0 ? (trend.sentiment.negative / total) * 100 : 0}
			{@const neuPercent = total > 0 ? (trend.sentiment.neutral / total) * 100 : 0}

			<div class="rounded-xl border border-border bg-surface p-5 transition-colors hover:bg-surface-hover">
				<div class="mb-3 flex items-center justify-between">
					<div class="flex items-center gap-3">
						<TrendingUp size={18} class="text-primary" />
						<div>
							<h3 class="font-semibold">{trend.topic}</h3>
							<span class="text-xs text-text-muted">Trending since {trend.trending_since}</span>
						</div>
					</div>
					<div class="flex items-center gap-3">
						<Badge variant="info">{trend.platform}</Badge>
						<span class="text-sm font-medium">{trend.mentions.toLocaleString()} mentions</span>
					</div>
				</div>

				<!-- Sentiment bar -->
				<div class="space-y-1.5">
					<div class="flex justify-between text-xs text-text-muted">
						<span class="text-success">Positive {posPercent.toFixed(0)}%</span>
						<span class="text-text-muted">Neutral {neuPercent.toFixed(0)}%</span>
						<span class="text-danger">Negative {negPercent.toFixed(0)}%</span>
					</div>
					<div class="flex h-2.5 overflow-hidden rounded-full">
						<div class="bg-success transition-all" style="width: {posPercent}%"></div>
						<div class="bg-text-muted/30 transition-all" style="width: {neuPercent}%"></div>
						<div class="bg-danger transition-all" style="width: {negPercent}%"></div>
					</div>
				</div>
			</div>
		{/each}
	</div>
{/if}
