<script lang="ts">
	import { fetchApi } from '$lib/utils/api';
	import type { CryptoPrice } from '$lib/types';
	import SparklineChart from '$lib/components/charts/SparklineChart.svelte';
	import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte';
	import { ArrowUpRight, ArrowDownRight } from 'lucide-svelte';

	let cryptos = $state<CryptoPrice[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	function formatMarketCap(value: number): string {
		if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
		if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
		if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
		return `$${value.toLocaleString()}`;
	}

	async function loadCrypto() {
		try {
			const data = await fetchApi<{ prices: CryptoPrice[] }>('/api/crypto/prices');
			cryptos = data.prices;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load crypto data';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		loadCrypto();
	});
</script>

<svelte:head>
	<title>Crypto | DataPulse</title>
</svelte:head>

{#if loading}
	<div class="flex h-64 items-center justify-center">
		<LoadingSpinner />
	</div>
{:else if error}
	<div class="rounded-xl border border-danger/30 bg-danger/10 p-6 text-center text-danger">
		<p class="font-medium">Failed to load crypto data</p>
		<p class="mt-1 text-sm opacity-80">{error}</p>
	</div>
{:else}
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
		{#each cryptos as crypto}
			<div class="rounded-xl border border-border bg-surface p-5">
				<div class="mb-3 flex items-center justify-between">
					<div>
						<h3 class="font-semibold">{crypto.name}</h3>
						<span class="text-xs text-text-muted">{crypto.symbol}</span>
					</div>
					<div class="flex items-center gap-1 text-sm font-medium"
						class:text-success={crypto.change_24h >= 0}
						class:text-danger={crypto.change_24h < 0}
					>
						{#if crypto.change_24h >= 0}
							<ArrowUpRight size={16} />
						{:else}
							<ArrowDownRight size={16} />
						{/if}
						{crypto.change_24h >= 0 ? '+' : ''}{crypto.change_24h.toFixed(2)}%
					</div>
				</div>

				<div class="mb-3 text-2xl font-bold">${crypto.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>

				{#if crypto.sparkline?.length}
					<div class="mb-3">
						<SparklineChart
							data={crypto.sparkline}
							color={crypto.change_24h >= 0 ? '#22c55e' : '#ef4444'}
							width={200}
							height={40}
						/>
					</div>
				{/if}

				<div class="text-xs text-text-muted">
					Market Cap: <span class="font-medium text-text">{formatMarketCap(crypto.market_cap)}</span>
				</div>
			</div>
		{/each}
	</div>
{/if}
