<script lang="ts">
	import type { Component } from 'svelte';

	let { icon, label, value, trend }: {
		icon: Component;
		label: string;
		value: string | number;
		trend?: { value: number; positive: boolean };
	} = $props();
</script>

<div class="rounded-xl border border-border bg-surface p-5">
	<div class="mb-3 flex items-center justify-between">
		<span class="text-sm text-text-muted">{label}</span>
		<div class="rounded-lg bg-primary/10 p-2 text-primary">
			{@render iconSlot()}
		</div>
	</div>
	<div class="text-2xl font-bold">{value}</div>
	{#if trend}
		<div class="mt-1 flex items-center gap-1 text-xs" class:text-success={trend.positive} class:text-danger={!trend.positive}>
			<span>{trend.positive ? '+' : ''}{trend.value}%</span>
			<span class="text-text-muted">vs last week</span>
		</div>
	{/if}
</div>

{#snippet iconSlot()}
	{@const Icon = icon}
	<Icon size={18} />
{/snippet}

