import { createEffect, createMemo, createResource, createSignal, For, Show, onCleanup } from 'solid-js';
import type { Dashboard, WidgetConfig } from '../../../../shared/types/dashboard';
import WidgetGrid from './WidgetGrid';
import TemplateSelector from './TemplateSelector';
import { apiUrl } from '../../lib/api';
import { createLocaleSignal } from '../../lib/locale';

const STORAGE_KEY = 'datapulse_dashboard';

type NodeTemplate = {
	id: string;
	label: string;
	category: 'crypto' | 'news-social' | 'seo-api';
	source: WidgetConfig['source'];
	type: WidgetConfig['type'];
	title: string;
	description?: string;
	w: number;
	h: number;
	limit?: number;
};

const NODE_REPOSITORY: Array<{ title: string; items: NodeTemplate[] }> = [
	{
		title: 'Kripto',
		items: [
			{ id: 'crypto_btc', label: 'BTC/USD Ticker', category: 'crypto', source: 'crypto', type: 'stat', title: 'BTC/USD Ticker', w: 3, h: 1, limit: 5 },
			{ id: 'crypto_eth', label: 'ETH/USD Ticker', category: 'crypto', source: 'crypto', type: 'stat', title: 'ETH/USD Ticker', w: 3, h: 1, limit: 5 },
			{ id: 'crypto_chart', label: 'Piyasa Değeri Grafiği', category: 'crypto', source: 'crypto', type: 'chart', title: 'Piyasa Değeri Toplamı', w: 6, h: 2, limit: 10 },
		],
	},
	{
		title: 'Haberler & Sosyal',
		items: [
			{ id: 'news_rail', label: 'Canlı Haber Akışı', category: 'news-social', source: 'news', type: 'list', title: 'Canlı Haber Akışı', w: 8, h: 2, limit: 6 },
			{ id: 'social_reddit', label: 'Alt Topluluk Takibi', category: 'news-social', source: 'social', type: 'stat', title: 'Alt Topluluk Takibi', w: 4, h: 1, limit: 6 },
			{ id: 'social_github', label: 'GitHub Trendleri', category: 'news-social', source: 'social', type: 'list', title: 'GitHub Trendleri', w: 4, h: 2, limit: 6 },
		],
	},
	{
		title: 'SEO & API',
		items: [
			{ id: 'seo_vitals', label: 'Temel Web Verileri', category: 'seo-api', source: 'seo', type: 'stat', title: 'Temel Web Verileri', w: 4, h: 1, limit: 4 },
			{ id: 'api_ping', label: 'API Sağlık Sinyali', category: 'seo-api', source: 'monitor', type: 'stat', title: 'Küresel API Sağlığı', w: 4, h: 1, limit: 6 },
		],
	},
];

const CATEGORY_ACCENTS = {
	crypto: 'is-crypto',
	news: 'is-news',
	social: 'is-social',
	seo: 'is-seo',
	monitor: 'is-api',
	price: 'is-price',
	scraper: 'is-api',
} as const;

export default function DashboardBuilderMain() {
	const locale = createLocaleSignal();
	const t = (tr: string, en: string) => (locale() === 'en' ? en : tr);
	const [isAdmin, setIsAdmin] = createSignal(false);
	const [currentDashboard, setCurrentDashboard] = createSignal<Dashboard | null>(null);
	const [widgetData, setWidgetData] = createSignal<Map<string, unknown>>(new Map());
	const [loadingWidgets, setLoadingWidgets] = createSignal<Set<string>>(new Set());
	const [showTemplateSelector, setShowTemplateSelector] = createSignal(false);
	const [draggedNodeId, setDraggedNodeId] = createSignal<string | null>(null);
	const [dragOverCanvas, setDragOverCanvas] = createSignal(false);
	const [cliOutput, setCliOutput] = createSignal(t('Sistem hazır. Node sürükleme olayları bekleniyor...', 'System ready. Waiting for node drag events...'));

	const [sessionData] = createResource(async () => {
		try {
			const response = await fetch(apiUrl('/api/session/status'), {
				credentials: 'include',
			});

			if (!response.ok) return null;

			const data = await response.json();
			setIsAdmin(data.isAdmin || false);
			return data;
		} catch {
			return null;
		}
	});

	createEffect(() => {
		if (!sessionData.loading && sessionData()) {
			loadDashboard();
		}
	});

	const loadDashboard = () => {
		try {
			const saved = localStorage.getItem(STORAGE_KEY);
			if (saved) {
				const dashboard = JSON.parse(saved) as Dashboard;
				setCurrentDashboard(dashboard);
				void fetchWidgetData(dashboard.widgets);
				return;
			}

			const emptyDashboard: Dashboard = {
				id: 'default',
				name: t('Benim çalışma alanım', 'My Workspace'),
				widgets: [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				createdBy: isAdmin() ? 'admin' : 'demo',
			};

			setCurrentDashboard(emptyDashboard);
			saveDashboard(emptyDashboard);
		} catch (error) {
			console.error('Error loading dashboard:', error);
		}
	};

	const saveDashboard = (dashboard: Dashboard) => {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(dashboard));
		} catch (error) {
			console.error('Error saving dashboard:', error);
		}
	};

	const fetchWidgetData = async (widgets: WidgetConfig[]) => {
		if (widgets.length === 0) return;

		try {
			setLoadingWidgets(new Set(widgets.map((widget) => widget.id)));

			const response = await fetch(apiUrl('/api/builder/widgets/data'), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify(widgets),
			});

			if (!response.ok) throw new Error('Failed to fetch widget data');

			const result = await response.json();
			const next = new Map<string, unknown>();
			for (const widgetResult of result.widgets ?? []) {
				if (widgetResult.data) next.set(widgetResult.widgetId, widgetResult.data);
			}

			setWidgetData(next);
			setLoadingWidgets(new Set<string>());
		} catch (error) {
			console.error('Error fetching widget data:', error);
			setLoadingWidgets(new Set<string>());
		}
	};

	const createWidgetFromTemplate = (template: NodeTemplate): WidgetConfig => ({
		id: `widget-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
		type: template.type,
		source: template.source,
		title: template.title,
		description: template.description,
		x: 0,
		y: 0,
		w: template.w,
		h: template.h,
		limit: template.limit,
		showHeader: true,
		showFooter: false,
	});

	const handleAddWidget = (widget: WidgetConfig) => {
		const dashboard = currentDashboard();
		if (!dashboard) return;

		const updated: Dashboard = {
			...dashboard,
			widgets: [...dashboard.widgets, widget],
			updatedAt: new Date().toISOString(),
		};

		setCurrentDashboard(updated);
		saveDashboard(updated);
		void fetchWidgetData(updated.widgets);
	};

	const injectNode = (nodeId: string) => {
		const template = NODE_REPOSITORY.flatMap((group) => group.items).find((item) => item.id === nodeId);
		if (!template) {
			setCliOutput(t('ERR: Geçersiz payload tipi.', 'ERR: Invalid payload type.'));
			return;
		}

		handleAddWidget(createWidgetFromTemplate(template));
		setCliOutput(t('Node başarıyla enjekte edildi. PID oluşturuldu.', 'Node injected successfully. PID spawned.'));
	};

	const handleRemoveWidget = (widgetId: string) => {
		const dashboard = currentDashboard();
		if (!dashboard) return;

		const updated: Dashboard = {
			...dashboard,
			widgets: dashboard.widgets.filter((widget) => widget.id !== widgetId),
			updatedAt: new Date().toISOString(),
		};

		setCurrentDashboard(updated);
		saveDashboard(updated);
		const next = new Map(widgetData());
		next.delete(widgetId);
		setWidgetData(next);
		setCliOutput(t('İşlem sonlandırıldı (SIGKILL). Kaynak serbest bırakıldı.', 'Process terminated (SIGKILL). Resource freed.'));
	};

	const handleTemplateSelect = async (templateId: string) => {
		try {
			const response = await fetch(apiUrl(`/api/builder/dashboards/from-template/${templateId}`), {
				method: 'POST',
				credentials: 'include',
			});

			if (!response.ok) throw new Error(t('Şablon yüklenemedi', 'Failed to load template'));

			const dashboard = await response.json();
			setCurrentDashboard(dashboard);
			saveDashboard(dashboard);
			void fetchWidgetData(dashboard.widgets);
			setShowTemplateSelector(false);
			setCliOutput(t('Şablon payload’u canvasa yerleştirildi.', 'Template payload mounted on canvas.'));
		} catch (error) {
			console.error('Error loading template:', error);
			alert(t('Şablon yüklenemedi', 'Failed to load template'));
		}
	};

	const handleClearDashboard = () => {
		const dashboard = currentDashboard();
		if (!dashboard) return;
		if (!confirm(t('Workspace tamamen temizlensin mi?', 'Clear the workspace completely?'))) return;

		const cleared: Dashboard = {
			...dashboard,
			widgets: [],
			updatedAt: new Date().toISOString(),
		};

		setCurrentDashboard(cleared);
		saveDashboard(cleared);
		setWidgetData(new Map());
		setCliOutput(t('SIGKILL_ALL gönderildi. Canvas temizlendi.', 'SIGKILL_ALL broadcasted. Canvas cleared.'));
	};

	const handleRefresh = () => {
		const dashboard = currentDashboard();
		if (dashboard) {
			void fetchWidgetData(dashboard.widgets);
			setCliOutput(t('Yenileme istendi. Senkron darbesi gönderildi.', 'Refresh requested. Sync pulse dispatched.'));
		}
	};

	createEffect(() => {
		const interval = setInterval(() => {
			handleRefresh();
		}, 5 * 60 * 1000);

		onCleanup(() => {
			if (interval) clearInterval(interval);
		});
	});

	const telemetry = createMemo(() => {
		const widgets = currentDashboard()?.widgets ?? [];
		return {
			total: widgets.length,
			crypto: widgets.filter((widget) => widget.source === 'crypto').length,
			news: widgets.filter((widget) => widget.source === 'news').length,
			social: widgets.filter((widget) => widget.source === 'social').length,
			seo: widgets.filter((widget) => widget.source === 'seo').length,
			api: widgets.filter((widget) => widget.source === 'monitor').length,
		};
	});

	const activeSources = createMemo(() => new Set((currentDashboard()?.widgets ?? []).map((widget) => widget.source)).size);

	return (
		<div class="dp-builder-workspace">
			<div class="dp-builder-grid">
				<aside class="dp-builder-panel">
					<div class="dp-builder-panel-head">
						<span>NODE_REPOSITORY</span>
						<span class="dp-builder-panel-meta">[DRAG]</span>
					</div>
					<div class="dp-builder-panel-body">
						<For each={NODE_REPOSITORY}>
							{(group) => (
								<div class="dp-builder-repo-group">
									<div class="dp-builder-repo-title">{group.title}</div>
									<div class="dp-builder-node-list">
										<For each={group.items}>
											{(item) => (
												<button
													type="button"
													draggable={isAdmin()}
													class="dp-builder-drag-node"
													onDragStart={() => {
														setDraggedNodeId(item.id);
														setCliOutput(t(`Node yükü sürükleniyor: [${item.id}]`, `Dragging node payload: [${item.id}]`));
													}}
													onDragEnd={() => {
														setDraggedNodeId(null);
														setCliOutput(t('Sistem hazır. Node sürükleme olayları bekleniyor...', 'System ready. Waiting for node drag events...'));
													}}
													onClick={() => {
														if (isAdmin()) injectNode(item.id);
													}}
												>
													<span>{item.label}</span>
													<span class="dp-builder-drag-icon">≡</span>
												</button>
											)}
										</For>
									</div>
								</div>
							)}
						</For>

						<div class="dp-builder-repo-note">{t("Widget'ı tutup canvas alanına bırakın veya tıklayın.", 'Drag a widget onto the canvas or click it.')}</div>
					</div>
				</aside>

				<section class="dp-builder-canvas-shell">
					<div class="dp-builder-canvas-toolbar">
						<span>CANVAS // {currentDashboard()?.name || t('Benim Çalışma Alanım', 'My Workspace')}</span>
						<div class="dp-builder-toolbar-actions">
							<button type="button" class="dp-builder-toolbar-link" onClick={() => setShowTemplateSelector(true)}>[ŞABLON YÜKLE]</button>
							<button type="button" class="dp-builder-toolbar-link is-danger" onClick={handleClearDashboard}>[SIGKILL_ALL]</button>
						</div>
					</div>

					<div
						class={`dp-builder-canvas-area ${dragOverCanvas() ? 'is-drag-over' : ''}`}
						onDragOver={(event) => {
							if (!isAdmin()) return;
							event.preventDefault();
							setDragOverCanvas(true);
						}}
						onDragLeave={() => setDragOverCanvas(false)}
						onDrop={(event) => {
							if (!isAdmin()) return;
							event.preventDefault();
							setDragOverCanvas(false);
							const nodeId = draggedNodeId();
							if (nodeId) injectNode(nodeId);
						}}
					>
						<Show when={(currentDashboard()?.widgets.length ?? 0) === 0}>
							<div class="dp-builder-empty-state">
								<div class="dp-builder-empty-icon">[+]</div>
								<div class="dp-builder-empty-title">{t('YÜK BEKLENİYOR', 'AWAITING PAYLOAD')}</div>
								<div class="dp-builder-empty-copy">{t('Sol menüden bir node seçip buraya sürükleyin. Sınır yok, istediğiniz kadar bileşen ekleyebilirsiniz.', 'Pick a node from the left and drag it here. No limits, add as many components as you want.')}</div>
							</div>
						</Show>

						<WidgetGrid
							widgets={currentDashboard()?.widgets ?? []}
							widgetData={widgetData()}
							loadingWidgets={loadingWidgets()}
							isAdmin={isAdmin()}
							onRemoveWidget={handleRemoveWidget}
						/>
					</div>

					<div class="dp-builder-cli">
						<span>~ / dnd --listen</span>
						<input type="text" value={cliOutput()} readOnly />
					</div>
				</section>

				<aside class="dp-builder-panel">
					<div class="dp-builder-panel-head">
						<span>DOM_TELEMETRY</span>
						<span class="dp-builder-panel-meta">[SYNC]</span>
					</div>
					<div class="dp-builder-panel-body">
						<div class="dp-builder-telemetry-total">
							<span>{t('Çalışan Toplam Node', 'Total running nodes')}</span>
							<strong>{telemetry().total}</strong>
						</div>

						<div class="dp-builder-telemetry-list">
							<TelemetryRow label={t('Kripto', 'Crypto')} value={telemetry().crypto} accent={CATEGORY_ACCENTS.crypto} />
							<TelemetryRow label={t('Haberler', 'News')} value={telemetry().news} accent={CATEGORY_ACCENTS.news} />
							<TelemetryRow label={t('Sosyal Medya', 'Social media')} value={telemetry().social} accent={CATEGORY_ACCENTS.social} />
							<TelemetryRow label={t('SEO', 'SEO')} value={telemetry().seo} accent={CATEGORY_ACCENTS.seo} />
							<TelemetryRow label={t('API', 'API')} value={telemetry().api} accent={CATEGORY_ACCENTS.monitor} />
						</div>

						<div class="dp-builder-side-note">
							<div class="dp-builder-side-note-title">{t('Çalışma Alanı', 'Workspace')}</div>
							<div class="dp-builder-side-stat"><span>{t('Aktif widget', 'Active widgets')}</span><strong>{telemetry().total}</strong></div>
							<div class="dp-builder-side-stat"><span>{t('Kaynak', 'Sources')}</span><strong>{activeSources()}</strong></div>
							<div class="dp-builder-side-stat"><span>{t('Çalışma modu', 'Work mode')}</span><strong>Local + API</strong></div>
							<div class="dp-builder-side-stat"><span>{t('Son güncelleme', 'Last update')}</span><strong>{currentDashboard() ? new Date(currentDashboard()!.updatedAt).toLocaleTimeString('tr-TR') : '-'}</strong></div>
						</div>

						<div class="dp-builder-side-note">
							<div class="dp-builder-side-note-title">{t('Kısa Kullanım', 'Quick usage')}</div>
							<ul class="dp-builder-tips">
								<li>{t("Node'ları canvas alanına bırak.", 'Drop nodes onto the canvas.')}</li>
								<li>{t('Template ile hızlı başlangıç yap.', 'Start quickly with a template.')}</li>
								<li>{t("Canlı veri gelen widget'lar otomatik sync olur.", 'Widgets with live data sync automatically.')}</li>
								<li>{t('Kill switch ile tek widget veya tüm canvas temizlenebilir.', 'Use the kill switch to clear a single widget or the whole canvas.')}</li>
							</ul>
						</div>
					</div>
				</aside>
			</div>

			<Show when={showTemplateSelector()}>
				<TemplateSelector onTemplateSelect={handleTemplateSelect} onClose={() => setShowTemplateSelector(false)} />
			</Show>
		</div>
	);
}

function TelemetryRow(props: { label: string; value: number; accent: string }) {
	return (
		<div class="dp-builder-telemetry-row">
			<span class="dp-builder-telemetry-label">
				<i class={`dp-builder-telemetry-dot ${props.accent}`} />
				{props.label}
			</span>
			<strong class="dp-builder-telemetry-value">{props.value}</strong>
		</div>
	);
}
