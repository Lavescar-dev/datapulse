<script lang="ts">
	import { fetchApi } from '$lib/utils/api';
	import type { Product } from '$lib/types';
	import SparklineChart from '$lib/components/charts/SparklineChart.svelte';
	import LoadingSpinner from '$lib/components/shared/LoadingSpinner.svelte';
	import Badge from '$lib/components/shared/Badge.svelte';
	import { Star } from 'lucide-svelte';

	let products = $state<Product[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let selectedProduct = $state<Product | null>(null);

	async function loadProducts() {
		try {
			const data = await fetchApi<{ products: Product[] }>('/api/ecommerce/products');
			products = data.products;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load products';
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		loadProducts();
	});
</script>

<svelte:head>
	<title>E-commerce | DataPulse</title>
</svelte:head>

{#if loading}
	<div class="flex h-64 items-center justify-center">
		<LoadingSpinner />
	</div>
{:else if error}
	<div class="rounded-xl border border-danger/30 bg-danger/10 p-6 text-center text-danger">
		<p class="font-medium">Failed to load products</p>
		<p class="mt-1 text-sm opacity-80">{error}</p>
	</div>
{:else}
	<div class="space-y-4">
		<!-- Product table -->
		<div class="overflow-x-auto rounded-xl border border-border">
			<table class="w-full text-sm">
				<thead>
					<tr class="border-b border-border bg-surface">
						<th class="px-4 py-3 text-left font-medium text-text-muted">Name</th>
						<th class="px-4 py-3 text-left font-medium text-text-muted">Source</th>
						<th class="px-4 py-3 text-right font-medium text-text-muted">Price</th>
						<th class="px-4 py-3 text-right font-medium text-text-muted">24h Change</th>
						<th class="px-4 py-3 text-center font-medium text-text-muted">Rating</th>
						<th class="px-4 py-3 text-right font-medium text-text-muted">Trend</th>
					</tr>
				</thead>
				<tbody>
					{#each products as product}
						<tr
							class="cursor-pointer border-b border-border/50 transition-colors hover:bg-surface-hover"
							onclick={() => selectedProduct = selectedProduct?.id === product.id ? null : product}
						>
							<td class="px-4 py-3 font-medium">{product.name}</td>
							<td class="px-4 py-3">
								<Badge variant="info">{product.source}</Badge>
							</td>
							<td class="px-4 py-3 text-right font-mono">${product.price.toFixed(2)}</td>
							<td class="px-4 py-3 text-right">
								<span class={product.change_24h >= 0 ? 'text-success' : 'text-danger'}>
									{product.change_24h >= 0 ? '+' : ''}{product.change_24h.toFixed(2)}%
								</span>
							</td>
							<td class="px-4 py-3 text-center">
								<span class="inline-flex items-center gap-1">
									<Star size={12} class="fill-warning text-warning" />
									{product.rating.toFixed(1)}
								</span>
							</td>
							<td class="px-4 py-3 text-right">
								{#if product.price_history?.length}
									<SparklineChart
										data={product.price_history}
										color={product.change_24h >= 0 ? '#22c55e' : '#ef4444'}
									/>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Selected product detail -->
		{#if selectedProduct}
			<div class="rounded-xl border border-border bg-surface p-6">
				<h3 class="mb-3 text-lg font-semibold">{selectedProduct.name}</h3>
				<div class="flex items-center gap-6">
					<div>
						<p class="text-sm text-text-muted">Current Price</p>
						<p class="text-2xl font-bold">${selectedProduct.price.toFixed(2)}</p>
					</div>
					<div>
						<p class="text-sm text-text-muted">24h Change</p>
						<p class="text-xl font-semibold" class:text-success={selectedProduct.change_24h >= 0} class:text-danger={selectedProduct.change_24h < 0}>
							{selectedProduct.change_24h >= 0 ? '+' : ''}{selectedProduct.change_24h.toFixed(2)}%
						</p>
					</div>
					{#if selectedProduct.price_history?.length}
						<div class="flex-1">
							<p class="mb-1 text-sm text-text-muted">Price History</p>
							<SparklineChart
								data={selectedProduct.price_history}
								color={selectedProduct.change_24h >= 0 ? '#22c55e' : '#ef4444'}
								width={300}
								height={60}
							/>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
{/if}
