<script lang="ts">
	import { fetchApi, streamApi } from '$lib/utils/api';
	import type { ScraperStatus } from '$lib/types';
	import Badge from '$lib/components/shared/Badge.svelte';
	import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte';
	import { Play, Square } from 'lucide-svelte';

	let scrapers = $state<ScraperStatus[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let activeLogs = $state<Record<string, string[]>>({});
	let activeProgress = $state<Record<string, number>>({});
	let runningScrapers = $state<Set<string>>(new Set());

	async function loadScrapers() {
		try {
			const data = await fetchApi<{ scrapers: ScraperStatus[] }>('/api/scrapers/status');
			scrapers = data.scrapers;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load scrapers';
		} finally {
			loading = false;
		}
	}

	function startScraper(id: string) {
		if (runningScrapers.has(id)) return;

		runningScrapers.add(id);
		runningScrapers = new Set(runningScrapers);
		activeLogs[id] = [];
		activeProgress[id] = 0;

		const cleanup = streamApi(
			`/api/scrapers/${id}/start`,
			(data) => {
				try {
					const parsed = JSON.parse(data);
					if (parsed.message) {
						activeLogs[id] = [...(activeLogs[id] || []), parsed.message];
					}
					if (parsed.progress !== undefined) {
						activeProgress[id] = parsed.progress;
					}
					if (parsed.done) {
						runningScrapers.delete(id);
						runningScrapers = new Set(runningScrapers);
						cleanup();
					}
				} catch {
					activeLogs[id] = [...(activeLogs[id] || []), data];
				}
			},
			() => {
				runningScrapers.delete(id);
				runningScrapers = new Set(runningScrapers);
			}
		);
	}

	function statusVariant(status: string): 'success' | 'warning' | 'danger' | 'default' {
		if (status === 'running') return 'success';
		if (status === 'paused') return 'warning';
		if (status === 'error') return 'danger';
		return 'default';
	}

	$effect(() => {
		loadScrapers();
	});
</script>

<svelte:head>
	<title>Scrapers | DataPulse</title>
</svelte:head>

{#if loading}
	<div class="flex h-64 items-center justify-center">
		<LoadingSpinner />
	</div>
{:else if error}
	<div class="rounded-xl border border-danger/30 bg-danger/10 p-6 text-center text-danger">
		<p class="font-medium">Failed to load scrapers</p>
		<p class="mt-1 text-sm opacity-80">{error}</p>
	</div>
{:else}
	<div class="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
		{#each scrapers as scraper}
			<div class="rounded-xl border border-border bg-surface p-5">
				<div class="mb-3 flex items-center justify-between">
					<h3 class="font-semibold">{scraper.name}</h3>
					<Badge variant={statusVariant(scraper.status)}>{scraper.status}</Badge>
				</div>

				<div class="mb-4 space-y-1.5 text-sm text-text-muted">
					<div class="flex justify-between">
						<span>Last run</span>
						<span>{scraper.last_run}</span>
					</div>
					<div class="flex justify-between">
						<span>Success rate</span>
						<span>{scraper.success_rate}%</span>
					</div>
					<div class="flex justify-between">
						<span>Category</span>
						<span class="capitalize">{scraper.category}</span>
					</div>
				</div>

				<!-- Progress bar -->
				{#if runningScrapers.has(scraper.id)}
					<div class="mb-3">
						<div class="mb-1 flex justify-between text-xs text-text-muted">
							<span>Progress</span>
							<span>{activeProgress[scraper.id] ?? 0}%</span>
						</div>
						<div class="h-2 overflow-hidden rounded-full bg-background">
							<div
								class="h-full rounded-full bg-primary transition-all duration-300"
								style="width: {activeProgress[scraper.id] ?? 0}%"
							></div>
						</div>
					</div>
				{/if}

				<button
					class="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors
						{runningScrapers.has(scraper.id)
							? 'bg-danger/20 text-danger hover:bg-danger/30'
							: 'bg-primary/20 text-primary hover:bg-primary/30'}"
					onclick={() => startScraper(scraper.id)}
					disabled={runningScrapers.has(scraper.id)}
				>
					{#if runningScrapers.has(scraper.id)}
						<Square size={14} />
						Running...
					{:else}
						<Play size={14} />
						Start Scraper
					{/if}
				</button>

				<!-- Log area -->
				{#if activeLogs[scraper.id]?.length}
					<div class="mt-3 max-h-32 overflow-y-auto rounded-lg bg-background p-3 font-mono text-xs text-text-muted">
						{#each activeLogs[scraper.id] as log}
							<div class="py-0.5">{log}</div>
						{/each}
					</div>
				{/if}
			</div>
		{/each}
	</div>
{/if}
