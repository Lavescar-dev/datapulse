import { Show, For, Match, Switch } from 'solid-js';
import type { WidgetConfig, PriceWidgetData } from '../../../../shared/types/dashboard';

interface Props {
	config: WidgetConfig;
	data: PriceWidgetData | null;
	loading: boolean;
}

export default function PriceWidget(props: Props) {
	const formatPrice = (price: number, currency: string) => {
		return new Intl.NumberFormat('tr-TR', {
			style: 'currency',
			currency: currency || 'TRY',
		}).format(price);
	};

	const getMarketplaceIcon = (marketplace: string) => {
		switch (marketplace.toLowerCase()) {
			case 'trendyol':
				return '🛍️';
			case 'hepsiburada':
				return '🛒';
			case 'n11':
				return '📦';
			case 'amazon-tr':
				return '📦';
			default:
				return '🏪';
		}
	};

	return (
		<div class="h-full flex flex-col">
			<Show when={props.loading}>
				<div class="flex items-center justify-center h-full">
					<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
				</div>
			</Show>

			<Show when={!props.loading && props.data && props.data.products.length > 0}>
				<Switch>
					<Match when={props.config.type === 'list' || props.config.type === 'chart'}>
						<div class="space-y-2 h-full overflow-auto">
							<For each={props.data!.products.slice(0, props.config.limit || 10)}>
								{(product) => (
									<div class="p-3 bg-gray-800/30 rounded">
										<div class="flex items-start justify-between gap-2">
											<div class="flex-1 min-w-0">
												<div class="flex items-center gap-2 mb-1">
													<span class="text-lg">{getMarketplaceIcon(product.marketplace)}</span>
													<h4 class="font-semibold text-sm line-clamp-1">{product.name}</h4>
												</div>
												<div class="flex items-center gap-2 text-xs">
													<span class="text-gray-400">{product.marketplace}</span>
													<Show when={product.available}>
														<span class="text-green-400">✓ Stokta</span>
													</Show>
													<Show when={!product.available}>
														<span class="text-red-400">✗ Stok Yok</span>
													</Show>
												</div>
											</div>
											<div class="text-right">
												<div class="font-bold text-blue-400">
													{formatPrice(product.currentPrice, product.currency)}
												</div>
												<Show when={product.priceChangePercent !== undefined}>
													<div
														class={`text-xs ${
															(product.priceChangePercent || 0) >= 0
																? 'text-green-400'
																: 'text-red-400'
														}`}
													>
														{(product.priceChangePercent || 0) >= 0 ? '+' : ''}
														{product.priceChangePercent?.toFixed(1)}%
													</div>
												</Show>
											</div>
										</div>
									</div>
								)}
							</For>
						</div>
					</Match>

					<Match when={props.config.type === 'table'}>
						<div class="overflow-auto h-full">
							<table class="w-full text-sm">
								<thead class="sticky top-0 bg-gray-900">
									<tr class="border-b border-gray-800">
										<th class="text-left p-2 text-gray-400 font-medium">Product</th>
										<th class="text-left p-2 text-gray-400 font-medium">Market</th>
										<th class="text-right p-2 text-gray-400 font-medium">Price</th>
										<th class="text-center p-2 text-gray-400 font-medium">Stock</th>
									</tr>
								</thead>
								<tbody>
									<For each={props.data!.products.slice(0, props.config.limit || 10)}>
										{(product) => (
											<tr class="border-b border-gray-800/50">
												<td class="p-2">
													<div class="font-semibold line-clamp-1">{product.name}</div>
												</td>
												<td class="p-2 text-gray-400">
													{getMarketplaceIcon(product.marketplace)} {product.marketplace}
												</td>
												<td class="p-2 text-right">
													<div class="font-bold text-blue-400">
														{formatPrice(product.currentPrice, product.currency)}
													</div>
													<Show when={product.priceChangePercent !== undefined}>
														<div
															class={`text-xs ${
																(product.priceChangePercent || 0) >= 0
																	? 'text-green-400'
																	: 'text-red-400'
															}`}
														>
															{(product.priceChangePercent || 0) >= 0 ? '+' : ''}
															{product.priceChangePercent?.toFixed(1)}%
														</div>
													</Show>
												</td>
												<td class="p-2 text-center">
													<Show when={product.available}>
														<span class="text-green-400">✓</span>
													</Show>
													<Show when={!product.available}>
														<span class="text-red-400">✗</span>
													</Show>
												</td>
											</tr>
										)}
									</For>
								</tbody>
							</table>
						</div>
					</Match>

					<Match when={props.config.type === 'stat'}>
						<div class="flex flex-col items-center justify-center h-full">
							<div class="text-5xl font-bold text-blue-400 mb-2">
								{props.data!.totalCount}
							</div>
							<div class="text-lg text-gray-300">Tracked Products</div>
							<div class="mt-4 text-sm text-gray-400">
								{props.data!.products.filter((p) => p.available).length} in stock
							</div>
						</div>
					</Match>
				</Switch>
			</Show>

			<Show when={!props.loading && (!props.data || props.data.products.length === 0)}>
				<div class="flex items-center justify-center h-full text-gray-500">
					No products being tracked
				</div>
			</Show>
		</div>
	);
}
