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

	// Calculate 24h price change from price history
	function calculateChange24h(product: Product): number {
		if (!product.price_history || product.price_history.length < 2) return 0;
		const oldest = product.price_history[0].price;
		const newest = product.price_history[product.price_history.length - 1].price;
		return ((newest - oldest) / oldest) * 100;
	}

	// Extract price values for sparkline
	function getPriceValues(product: Product): number[] {
		return product.price_history?.map(h => h.price) || [];
	}

	// Load data once on mount
	loadProducts();
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
						<th class="px-4 py-3 text-left font-medium text-text-muted">Category</th>
						<th class="px-4 py-3 text-right font-medium text-text-muted">Price</th>
						<th class="px-4 py-3 text-right font-medium text-text-muted">Change</th>
						<th class="px-4 py-3 text-center font-medium text-text-muted">Stock</th>
						<th class="px-4 py-3 text-right font-medium text-text-muted">Trend</th>
					</tr>
				</thead>
				<tbody>
					{#each products as product}
						{@const change = calculateChange24h(product)}
						<tr
							class="cursor-pointer border-b border-border/50 transition-colors hover:bg-surface-hover"
							onclick={() => selectedProduct = selectedProduct?.id === product.id ? null : product}
						>
							<td class="px-4 py-3 font-medium">{product.name}</td>
							<td class="px-4 py-3">
								<Badge variant="info">{product.category}</Badge>
							</td>
							<td class="px-4 py-3 text-right font-mono">{product.currency} {product.price.toFixed(2)}</td>
							<td class="px-4 py-3 text-right">
								<span class={change >= 0 ? 'text-success' : 'text-danger'}>
									{change >= 0 ? '+' : ''}{change.toFixed(2)}%
								</span>
							</td>
							<td class="px-4 py-3 text-center">
								<Badge variant={product.in_stock ? 'success' : 'danger'}>
									{product.in_stock ? 'In Stock' : 'Out'}
								</Badge>
							</td>
							<td class="px-4 py-3 text-right">
								{#if product.price_history?.length}
									<SparklineChart
										data={getPriceValues(product)}
										color={change >= 0 ? '#22c55e' : '#ef4444'}
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
			{@const change = calculateChange24h(selectedProduct)}
			<div class="rounded-xl border border-border bg-surface p-6">
				<h3 class="mb-3 text-lg font-semibold">{selectedProduct.name}</h3>
				<div class="flex items-center gap-6">
					<div>
						<p class="text-sm text-text-muted">Current Price</p>
						<p class="text-2xl font-bold">{selectedProduct.currency} {selectedProduct.price.toFixed(2)}</p>
					</div>
					<div>
						<p class="text-sm text-text-muted">Price Change</p>
						<p class="text-xl font-semibold" class:text-success={change >= 0} class:text-danger={change < 0}>
							{change >= 0 ? '+' : ''}{change.toFixed(2)}%
						</p>
					</div>
					<div>
						<p class="text-sm text-text-muted">Stock Status</p>
						<Badge variant={selectedProduct.in_stock ? 'success' : 'danger'}>
							{selectedProduct.in_stock ? 'Available' : 'Out of Stock'}
						</Badge>
					</div>
					{#if selectedProduct.price_history?.length}
						<div class="flex-1">
							<p class="mb-1 text-sm text-text-muted">Price History</p>
							<SparklineChart
								data={getPriceValues(selectedProduct)}
								color={change >= 0 ? '#22c55e' : '#ef4444'}
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
