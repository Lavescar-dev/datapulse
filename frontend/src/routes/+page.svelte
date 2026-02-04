<script lang="ts">
	import { fetchApi } from '$lib/utils/api';
	import type { DashboardStats } from '$lib/types';
	import StatsCard from '$lib/components/dashboard/StatsCard.svelte';
	import ScraperStatusCard from '$lib/components/dashboard/ScraperStatusCard.svelte';
	import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte';
	import { Bot, Activity, Database, Clock } from 'lucide-svelte';

	let stats = $state<DashboardStats | null>(null);
	let error = $state<string | null>(null);
	let loading = $state(true);

	async function loadStats() {
		try {
			stats = await fetchApi<DashboardStats>('/api/dashboard/stats');
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load dashboard';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		loadStats();
	});
</script>

<svelte:head>
	<title>Dashboard | DataPulse</title>
</svelte:head>

{#if loading}
	<div class="flex h-64 items-center justify-center">
		<LoadingSpinner />
	</div>
{:else if error}
	<div class="rounded-xl border border-danger/30 bg-danger/10 p-6 text-center text-danger">
		<p class="font-medium">Failed to load dashboard</p>
		<p class="mt-1 text-sm opacity-80">{error}</p>
		<button class="mt-3 rounded-lg bg-danger/20 px-4 py-1.5 text-sm transition-colors hover:bg-danger/30" onclick={loadStats}>
			Retry
		</button>
	</div>
{:else if stats}
	<div class="space-y-6">
		<!-- Stats Grid -->
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
			<StatsCard
				icon={Bot}
				label="Total Scrapers"
				value={stats.total_scrapers}
				trend={{ value: 12, positive: true }}
			/>
			<StatsCard
				icon={Activity}
				label="Active Scrapers"
				value={stats.active_scrapers}
				trend={{ value: 5, positive: true }}
			/>
			<StatsCard
				icon={Database}
				label="Data Points"
				value={stats.data_points.toLocaleString()}
				trend={{ value: 23, positive: true }}
			/>
			<StatsCard
				icon={Clock}
				label="Uptime"
				value="{stats.uptime}%"
			/>
		</div>

		<!-- Scraper Status Grid -->
		<div>
			<h2 class="mb-4 text-lg font-semibold">Scraper Status</h2>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{#each stats.scrapers as scraper}
					<ScraperStatusCard {scraper} />
				{/each}
			</div>
		</div>
	</div>
{/if}
