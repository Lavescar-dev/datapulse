import { createSignal, createResource, Show, For } from 'solid-js';
import type { DashboardTemplate } from '../../../../shared/types/dashboard';
import { apiUrl } from '../../lib/api';
import { createLocaleSignal } from '../../lib/locale';

interface Props {
	onTemplateSelect: (templateId: string) => void;
	onClose: () => void;
}

export default function TemplateSelector(props: Props) {
	const locale = createLocaleSignal();
	const t = (tr: string, en: string) => (locale() === 'en' ? en : tr);
	const [selectedCategory, setSelectedCategory] = createSignal<string>('all');

	// Fetch templates
	const [templates] = createResource<DashboardTemplate[]>(async () => {
		try {
			const response = await fetch(apiUrl('/api/builder/templates'), {
				credentials: 'include',
			});

			if (!response.ok) return [];

			const data = await response.json();
			return data.templates || [];
		} catch (error) {
			console.error('Error fetching templates:', error);
			return [];
		}
	});

	const filteredTemplates = () => {
		const all = templates() || [];
		if (selectedCategory() === 'all') return all;
		return all.filter((t) => t.category === selectedCategory());
	};

	const getCategoryIcon = (category: string) => {
		switch (category) {
			case 'crypto':
				return '₿';
			case 'news':
			case 'tech':
				return '📰';
			case 'monitoring':
				return '📡';
			case 'ecommerce':
				return '🛒';
			default:
				return '📊';
		}
	};

	const getCategoryColor = (category: string) => {
		switch (category) {
			case 'crypto':
				return 'text-orange-400';
			case 'news':
			case 'tech':
				return 'text-blue-400';
			case 'monitoring':
				return 'text-green-400';
			case 'ecommerce':
				return 'text-purple-400';
			default:
				return 'text-gray-400';
		}
	};

	return (
		<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
			<div class="bg-gray-900 rounded-lg border border-gray-800 max-w-4xl w-full max-h-[80vh] flex flex-col">
				{/* Header */}
				<div class="border-b border-gray-800 p-6 flex items-center justify-between">
					<div>
						<h2 class="text-2xl font-bold mb-1">{t('Hazır Şablonlar', 'Ready Templates')}</h2>
						<p class="text-sm text-gray-400">
							{t('Önceden yapılandırılmış dashboard şablonlarından birini seçin', 'Pick one of the preconfigured dashboard templates')}
						</p>
					</div>
					<button
						onClick={props.onClose}
						class="text-gray-400 hover:text-gray-100 transition-colors"
					>
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							/>
						</svg>
					</button>
				</div>

				{/* Category Filter */}
				<div class="border-b border-gray-800 p-4">
					<div class="flex gap-2 flex-wrap">
						<button
							onClick={() => setSelectedCategory('all')}
							class={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
								selectedCategory() === 'all'
									? 'bg-blue-600 text-white'
									: 'bg-gray-800 text-gray-400 hover:bg-gray-700'
							}`}
						>
							{t('Tümü', 'All')}
						</button>
						<button
							onClick={() => setSelectedCategory('crypto')}
							class={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
								selectedCategory() === 'crypto'
									? 'bg-orange-600 text-white'
									: 'bg-gray-800 text-gray-400 hover:bg-gray-700'
							}`}
						>
							₿ Crypto
						</button>
						<button
							onClick={() => setSelectedCategory('tech')}
							class={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
								selectedCategory() === 'tech'
									? 'bg-blue-600 text-white'
									: 'bg-gray-800 text-gray-400 hover:bg-gray-700'
							}`}
						>
							📰 Tech News
						</button>
						<button
							onClick={() => setSelectedCategory('monitoring')}
							class={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
								selectedCategory() === 'monitoring'
									? 'bg-green-600 text-white'
									: 'bg-gray-800 text-gray-400 hover:bg-gray-700'
							}`}
						>
							📡 Monitoring
						</button>
						<button
							onClick={() => setSelectedCategory('ecommerce')}
							class={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
								selectedCategory() === 'ecommerce'
									? 'bg-purple-600 text-white'
									: 'bg-gray-800 text-gray-400 hover:bg-gray-700'
							}`}
						>
							🛒 E-commerce
						</button>
					</div>
				</div>

				{/* Templates Grid */}
				<div class="flex-1 overflow-auto p-6">
					<Show when={templates.loading}>
							<div class="flex items-center justify-center py-12">
							<div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
						</div>
					</Show>

					<Show when={!templates.loading && filteredTemplates().length > 0}>
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							<For each={filteredTemplates()}>
								{(template) => (
									<div class="bg-gray-800/50 border border-gray-700 rounded-lg p-6 hover:border-blue-600 transition-colors cursor-pointer">
										<div class="flex items-start justify-between mb-3">
											<div class="flex items-center gap-3">
												<div class={`text-3xl ${getCategoryColor(template.category)}`}>
													{getCategoryIcon(template.category)}
												</div>
												<div>
													<h3 class="font-semibold text-lg">{template.name}</h3>
													<p class="text-xs text-gray-400 capitalize">
														{template.category}
													</p>
												</div>
											</div>
										</div>

										<p class="text-sm text-gray-400 mb-4 line-clamp-2">
											{template.description}
										</p>

										<div class="flex items-center justify-between">
												<div class="text-xs text-gray-500">
													{template.widgets.length} {t('widget', 'widgets')}
												</div>
											<button
												onClick={() => {
													props.onTemplateSelect(template.id);
													props.onClose();
												}}
												class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
											>
												{t('Kullan', 'Use')}
											</button>
										</div>
									</div>
								)}
							</For>
						</div>
					</Show>

					<Show when={!templates.loading && filteredTemplates().length === 0}>
						<div class="flex items-center justify-center py-12">
							<div class="text-center">
								<div class="text-4xl mb-2">📊</div>
								<p class="text-gray-400">{t('Bu kategoride şablon bulunamadı', 'No templates found in this category')}</p>
							</div>
						</div>
					</Show>
				</div>
			</div>
		</div>
	);
}
