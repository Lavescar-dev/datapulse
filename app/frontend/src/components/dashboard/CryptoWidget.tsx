import { Show, For, Match, Switch } from 'solid-js';
import type { WidgetConfig, CryptoWidgetData } from '../../../../shared/types/dashboard';
import { createLocaleSignal } from '../../lib/locale';

interface Props {
	config: WidgetConfig;
	data: CryptoWidgetData | null;
	loading: boolean;
}

export default function CryptoWidget(props: Props) {
	const locale = createLocaleSignal();
	const t = (tr: string, en: string) => (locale() === 'en' ? en : tr);
	const coins = () => props.data?.coins ?? [];
	const formatPrice = (price: number) => {
		return new Intl.NumberFormat('tr-TR', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 2,
			maximumFractionDigits: 6,
		}).format(price);
	};

	const formatLarge = (num: number) => {
		if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
		if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
		if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
		return `$${num.toFixed(2)}`;
	};

	return (
		<div class="h-full flex flex-col">
			<Show when={props.loading}>
				<div class="flex items-center justify-center h-full">
					<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
				</div>
			</Show>

			<Show when={!props.loading && props.data}>
				<Switch>
					{/* Chart Type Widget */}
					<Match when={props.config.type === 'chart'}>
						<Show when={coins().length > 0}>
							<div class="space-y-2 h-full overflow-auto">
								<For each={coins().slice(0, props.config.limit || 10)}>
									{(coin) => (
										<div class="flex items-center justify-between p-2 bg-gray-800/50 rounded">
											<div class="flex-1">
												<div class="font-semibold text-sm">{coin.name}</div>
												<div class="text-xs text-gray-400">{coin.symbol}</div>
											</div>
											<div class="text-right">
												<div class="font-semibold text-sm">{formatPrice(coin.price)}</div>
												<div
													class={`text-xs ${
														coin.change24h >= 0 ? 'text-green-400' : 'text-red-400'
													}`}
												>
													{coin.change24h >= 0 ? '+' : ''}
													{coin.change24h.toFixed(2)}%
												</div>
											</div>
										</div>
									)}
								</For>
							</div>
						</Show>
					</Match>

					{/* Table Type Widget */}
					<Match when={props.config.type === 'table'}>
						<Show when={coins().length > 0}>
							<div class="overflow-auto h-full">
								<table class="w-full text-sm">
									<thead class="sticky top-0 bg-gray-900">
										<tr class="border-b border-gray-800">
											<th class="text-left p-2 text-gray-400 font-medium">{t('Coin', 'Coin')}</th>
											<th class="text-right p-2 text-gray-400 font-medium">{t('Fiyat', 'Price')}</th>
											<th class="text-right p-2 text-gray-400 font-medium">{t('24s', '24h')}</th>
											<th class="text-right p-2 text-gray-400 font-medium">{t('Piyasa Değeri', 'Market Cap')}</th>
										</tr>
									</thead>
									<tbody>
										<For each={coins().slice(0, props.config.limit || 10)}>
											{(coin) => (
												<tr class="border-b border-gray-800/50">
													<td class="p-2">
														<div class="font-semibold">{coin.name}</div>
														<div class="text-xs text-gray-400">{coin.symbol}</div>
													</td>
													<td class="p-2 text-right font-semibold">
														{formatPrice(coin.price)}
													</td>
													<td
														class={`p-2 text-right ${
															coin.change24h >= 0 ? 'text-green-400' : 'text-red-400'
														}`}
													>
														{coin.change24h >= 0 ? '+' : ''}
														{coin.change24h.toFixed(2)}%
													</td>
													<td class="p-2 text-right text-gray-400">
														{formatLarge(coin.marketCap)}
													</td>
												</tr>
											)}
										</For>
									</tbody>
								</table>
							</div>
						</Show>
					</Match>

					{/* Stat Type Widget */}
					<Match when={props.config.type === 'stat'}>
						<Show when={props.data?.fearGreedIndex}>
							<div class="flex flex-col items-center justify-center h-full">
								<div class="text-5xl font-bold text-blue-400 mb-2">
									{props.data!.fearGreedIndex!.value}
								</div>
								<div class="text-lg text-gray-300">
									{props.data!.fearGreedIndex!.classification}
								</div>
							</div>
						</Show>
						<Show when={props.data?.marketStats}>
							<div class="flex flex-col justify-center h-full space-y-4">
								<div>
									<div class="text-xs text-gray-400 mb-1">{t('Toplam piyasa değeri', 'Total Market Cap')}</div>
									<div class="text-2xl font-bold text-blue-400">
										{formatLarge(props.data!.marketStats!.totalMarketCap)}
									</div>
								</div>
								<div>
									<div class="text-xs text-gray-400 mb-1">{t('24s hacim', '24h Volume')}</div>
									<div class="text-xl font-semibold text-purple-400">
										{formatLarge(props.data!.marketStats!.totalVolume)}
									</div>
								</div>
								<div>
									<div class="text-xs text-gray-400 mb-1">{t('BTC dominansı', 'BTC Dominance')}</div>
									<div class="text-xl font-semibold text-orange-400">
										{props.data!.marketStats!.btcDominance.toFixed(2)}%
									</div>
								</div>
							</div>
						</Show>
					</Match>

					{/* List Type Widget */}
					<Match when={props.config.type === 'list'}>
						<Show when={coins().length > 0}>
							<div class="space-y-2 h-full overflow-auto">
								<For each={coins().slice(0, props.config.limit || 5)}>
									{(coin) => (
										<div class="flex items-center gap-3 p-2 bg-gray-800/30 rounded">
											<div class="flex-1">
												<div class="font-semibold">{coin.name}</div>
												<div class="text-xs text-gray-400">{formatPrice(coin.price)}</div>
											</div>
											<div
												class={`text-sm font-semibold ${
													coin.change24h >= 0 ? 'text-green-400' : 'text-red-400'
												}`}
											>
												{coin.change24h >= 0 ? '+' : ''}
												{coin.change24h.toFixed(2)}%
											</div>
										</div>
									)}
								</For>
							</div>
						</Show>
					</Match>
				</Switch>
			</Show>

			<Show when={!props.loading && !props.data}>
					<div class="flex items-center justify-center h-full text-gray-500">
						{t('Veri yok', 'No data available')}
					</div>
				</Show>
		</div>
	);
}
