<script lang="ts">
	import type { ScraperStatus } from '$lib/types';
	import Badge from '$lib/components/shared/Badge.svelte';

	let { scraper }: { scraper: ScraperStatus } = $props();

	const statusVariant = $derived(
		scraper.status === 'running' ? 'success' as const :
		scraper.status === 'idle' ? 'default' as const :
		scraper.status === 'paused' ? 'warning' as const :
		'danger' as const
	);

	const statusColor = $derived(
		scraper.status === 'running' ? 'bg-success' :
		scraper.status === 'idle' ? 'bg-text-muted' :
		scraper.status === 'paused' ? 'bg-warning' :
		'bg-danger'
	);
</script>

<div class="rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-surface-hover">
	<div class="mb-2 flex items-center justify-between">
		<div class="flex items-center gap-2">
			<div class={`h-2.5 w-2.5 rounded-full ${statusColor}`}
				class:animate-pulse={scraper.status === 'running'}
			></div>
			<span class="font-medium">{scraper.name}</span>
		</div>
		<Badge variant={statusVariant}>{scraper.status}</Badge>
	</div>
	<div class="space-y-1 text-xs text-text-muted">
		<div class="flex justify-between">
			<span>Last run</span>
			<span>{scraper.last_run}</span>
		</div>
		<div class="flex justify-between">
			<span>Success rate</span>
			<span class:text-success={scraper.success_rate >= 95}
				class:text-warning={scraper.success_rate >= 80 && scraper.success_rate < 95}
				class:text-danger={scraper.success_rate < 80}
			>{scraper.success_rate}%</span>
		</div>
		<div class="flex justify-between">
			<span>Data points</span>
			<span>{scraper.data_points.toLocaleString()}</span>
		</div>
	</div>
</div>
