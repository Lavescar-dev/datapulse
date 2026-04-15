import { createSignal, Show } from 'solid-js';
import type { WidgetConfig, WidgetType, WidgetSource, ChartType } from '../../../../shared/types/dashboard';
import { createLocaleSignal } from '../../lib/locale';

interface Props {
	onAddWidget: (widget: WidgetConfig) => void;
	isAdmin: boolean;
}

export default function WidgetPicker(props: Props) {
	const locale = createLocaleSignal();
	const t = (tr: string, en: string) => (locale() === 'en' ? en : tr);
	const [isOpen, setIsOpen] = createSignal(false);
	const [selectedSource, setSelectedSource] = createSignal<WidgetSource>('crypto');
	const [selectedType, setSelectedType] = createSignal<WidgetType>('list');
	const [title, setTitle] = createSignal('');
	const [chartType, setChartType] = createSignal<ChartType>('line');
	const [limit, setLimit] = createSignal(10);

	const handleAdd = () => {
		if (!title().trim()) {
			alert(t('Lütfen bir widget başlığı girin', 'Please enter a widget title'));
			return;
		}

		const newWidget: WidgetConfig = {
			id: `widget-${Date.now()}`,
			type: selectedType(),
			source: selectedSource(),
			title: title(),
			x: 0,
			y: 0,
			w: selectedType() === 'stat' ? 1 : 2,
			h: selectedType() === 'stat' ? 1 : 2,
			limit: limit(),
			chartType: selectedType() === 'chart' ? chartType() : undefined,
			showHeader: true,
			showFooter: false,
		};

		props.onAddWidget(newWidget);

		// Reset form
		setTitle('');
		setIsOpen(false);
	};

	const getSourceIcon = (source: WidgetSource) => {
		switch (source) {
			case 'crypto':
				return '₿';
			case 'news':
				return '📰';
			case 'social':
				return '💬';
			case 'price':
				return '🛒';
			case 'monitor':
				return '📡';
			case 'scraper':
				return '🔍';
			case 'seo':
				return '🔎';
			default:
				return '📊';
		}
	};

	const getSourceName = (source: WidgetSource) => {
		switch (source) {
			case 'crypto':
				return t('Kripto Verisi', 'Crypto Data');
			case 'news':
				return t('Haberler', 'News');
			case 'social':
				return t('Sosyal Medya', 'Social Media');
			case 'price':
				return t('Fiyat Takip', 'Price Tracking');
			case 'monitor':
				return t('API İzleme', 'API Monitor');
			case 'scraper':
				return t('Web Scraper', 'Web Scraper');
			case 'seo':
				return t('SEO Analiz', 'SEO Analysis');
			default:
				return source;
		}
	};

	return (
		<div class="relative">
			{/* Add Widget Button */}
			<Show when={props.isAdmin}>
				<button
					onClick={() => setIsOpen(!isOpen())}
					class="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold px-4 py-3 rounded-lg transition-all flex items-center justify-center gap-2"
				>
					<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 4v16m8-8H4"
						/>
					</svg>
					{t('Widget Ekle', 'Add Widget')}
				</button>
			</Show>

			{/* Widget Picker Modal */}
			<Show when={isOpen()}>
				<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
					<div class="bg-gray-900 rounded-lg border border-gray-800 max-w-md w-full max-h-[90vh] overflow-auto">
						{/* Header */}
						<div class="border-b border-gray-800 p-4 flex items-center justify-between">
							<h3 class="text-lg font-semibold">{t('Yeni Widget Ekle', 'Add New Widget')}</h3>
							<button
								onClick={() => setIsOpen(false)}
								class="text-gray-400 hover:text-gray-100 transition-colors"
							>
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M6 18L18 6M6 6l12 12"
									/>
								</svg>
							</button>
						</div>

						{/* Form */}
						<div class="p-4 space-y-4">
							{/* Title */}
							<div>
								<label class="block text-sm font-medium mb-2">{t('Widget Başlığı', 'Widget Title')}</label>
								<input
									type="text"
									value={title()}
									onInput={(e) => setTitle(e.currentTarget.value)}
									placeholder={t('Örn: Top Cryptocurrencies', 'e.g. Top Cryptocurrencies')}
									class="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
								/>
							</div>

							{/* Data Source */}
							<div>
								<label class="block text-sm font-medium mb-2">{t('Veri Kaynağı', 'Data Source')}</label>
								<div class="grid grid-cols-2 gap-2">
									{(['crypto', 'news', 'social', 'price', 'monitor'] as WidgetSource[]).map((source) => (
										<button
											onClick={() => setSelectedSource(source)}
											class={`p-3 rounded-lg text-left transition-colors ${
												selectedSource() === source
													? 'bg-blue-600 text-white'
													: 'bg-gray-800 text-gray-400 hover:bg-gray-700'
											}`}
										>
											<div class="text-xl mb-1">{getSourceIcon(source)}</div>
											<div class="text-xs font-medium">{getSourceName(source)}</div>
										</button>
									))}
								</div>
							</div>

							{/* Widget Type */}
							<div>
								<label class="block text-sm font-medium mb-2">{t('Widget Türü', 'Widget Type')}</label>
								<div class="grid grid-cols-4 gap-2">
									{(['list', 'table', 'chart', 'stat'] as WidgetType[]).map((type) => (
										<button
											onClick={() => setSelectedType(type)}
											class={`p-2 rounded-lg text-center transition-colors ${
												selectedType() === type
													? 'bg-blue-600 text-white'
													: 'bg-gray-800 text-gray-400 hover:bg-gray-700'
											}`}
										>
											<div class="text-sm font-medium capitalize">{type}</div>
										</button>
									))}
								</div>
							</div>

							{/* Chart Type (if chart is selected) */}
							<Show when={selectedType() === 'chart'}>
								<div>
									<label class="block text-sm font-medium mb-2">{t('Grafik Türü', 'Chart Type')}</label>
									<div class="grid grid-cols-4 gap-2">
										{(['line', 'bar', 'pie', 'area'] as ChartType[]).map((type) => (
											<button
												onClick={() => setChartType(type)}
												class={`p-2 rounded-lg text-center transition-colors ${
													chartType() === type
														? 'bg-blue-600 text-white'
														: 'bg-gray-800 text-gray-400 hover:bg-gray-700'
												}`}
											>
												<div class="text-xs font-medium capitalize">{type}</div>
											</button>
										))}
									</div>
								</div>
							</Show>

							{/* Limit */}
							<div>
									<label class="block text-sm font-medium mb-2">
									{t('Gösterilecek Öğe Sayısı', 'Items to show')}: {limit()}
								</label>
								<input
									type="range"
									min="5"
									max="50"
									step="5"
									value={limit()}
									onInput={(e) => setLimit(parseInt(e.currentTarget.value))}
									class="w-full"
								/>
							</div>

							{/* Actions */}
							<div class="flex gap-2 pt-4">
								<button
									onClick={() => setIsOpen(false)}
									class="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
								>
									İptal
								</button>
								<button
									onClick={handleAdd}
									class="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
								>
									Ekle
								</button>
							</div>
						</div>
					</div>
				</div>
			</Show>
		</div>
	);
}
