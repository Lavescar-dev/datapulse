import { createSignal, createResource, Show, For } from 'solid-js';
import EndpointCard from './EndpointCard';
import AddEndpoint from './AddEndpoint';
import type { MonitoredEndpoint } from '../../../../shared/types/monitor';
import { apiFetch, apiJson } from '../../lib/api';
import { createLocaleSignal } from '../../lib/locale';

export default function ApiMonitorMain() {
	const locale = createLocaleSignal();
	const t = (tr: string, en: string) => (locale() === 'en' ? en : tr);
	const [isAdmin, setIsAdmin] = createSignal(false);
	const [refreshTrigger, setRefreshTrigger] = createSignal(0);
	const [loadError, setLoadError] = createSignal<string | null>(null);

	createResource(async () => {
		try {
			const data = await apiJson<any>('/api/session/status');
			setIsAdmin(data.isAdmin || false);
			return data;
		} catch {
			return null;
		}
	});

	const [endpointsData] = createResource(
		() => refreshTrigger(),
		async () => {
			try {
				setLoadError(null);
				const data = await apiJson<{ endpoints: MonitoredEndpoint[] }>('/api/monitor/endpoints', {
					requireSession: true,
				});
				return data;
			} catch (error) {
				console.error('Error fetching endpoints:', error);
				setLoadError(error instanceof Error ? error.message : t('Endpoint’ler yüklenemedi', 'Endpoints could not be loaded'));
				return { endpoints: [] as MonitoredEndpoint[] };
			}
		}
	);

	createResource(
		() => refreshTrigger(),
		async () => {
			try {
				return await apiJson('/api/monitor/summary', { requireSession: true });
			} catch {
				return null;
			}
		}
	);

	const handleEndpointAdded = () => {
		setRefreshTrigger((prev) => prev + 1);
	};

	const handleRemoveEndpoint = async (id: string) => {
		if (!confirm(t("Bu endpoint'i takipten kaldırmak istediğinize emin misiniz?", 'Are you sure you want to remove this endpoint from tracking?'))) {
			return;
		}

		try {
			await apiFetch(`/api/monitor/endpoints/${id}`, {
				method: 'DELETE',
				requireSession: true,
			});
			setRefreshTrigger((prev) => prev + 1);
		} catch (error) {
			alert(error instanceof Error ? error.message : t('Endpoint silinirken bir hata oluştu', 'An error occurred while deleting the endpoint'));
			console.error('Error removing endpoint:', error);
		}
	};

	const handleCheckEndpoint = async (id: string) => {
		try {
			await apiFetch(`/api/monitor/endpoints/${id}/check`, {
				method: 'POST',
				requireSession: true,
			});
			setRefreshTrigger((prev) => prev + 1);
		} catch (error) {
			alert(error instanceof Error ? error.message : t('Kontrol sırasında bir hata oluştu', 'An error occurred during the check'));
			console.error('Error checking endpoint:', error);
		}
	};

	const getEndpoints = (): MonitoredEndpoint[] => (endpointsData()?.endpoints || []) as MonitoredEndpoint[];

	const getGlobalUptime24h = () => {
		const endpoints = getEndpoints();
		if (!endpoints.length) return '0.00%';
		const total = endpoints.reduce((sum, endpoint) => sum + endpoint.uptimeStats['24h'].uptimePercent, 0);
		return `${(total / endpoints.length).toFixed(2)}%`;
	};

	const getAverageLatency = () => {
		const values = getEndpoints()
			.map((endpoint) => endpoint.lastResponseTime)
			.filter((value): value is number => value !== null && value !== undefined);

		if (!values.length) return 'N/A';
				return `${Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)}ms`;
	};

	const getIncidents = () => getEndpoints().filter((endpoint) => endpoint.currentStatus === 'down').length;

	const getLastPulse = () => {
		const endpoints = getEndpoints().filter((endpoint) => endpoint.lastCheck);
		if (!endpoints.length) return '-';
		const latest = [...endpoints]
			.sort((a, b) => new Date(b.lastCheck!).getTime() - new Date(a.lastCheck!).getTime())[0]
			.lastCheck!;

		return new Date(latest).toLocaleString('tr-TR', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	};

	return (
		<div class="dp-monitor-shell">
			<div class="dp-monitor-cli">
		<span class="dp-monitor-cli-prompt">$ sys.ping --all-nodes</span>
				<input type="text" value={t(`Daemon çalışıyor. Son pulse: ${getLastPulse()}`, `Daemon running. Last pulse: ${getLastPulse()}`)} readOnly />
			</div>

			<div class="dp-monitor-telemetry-grid">
				<div class="dp-monitor-telemetry-card">
					<span class="dp-monitor-telemetry-value is-success">{getGlobalUptime24h()}</span>
					<span class="dp-monitor-telemetry-label">{t('Global Uptime (24H)', 'Global Uptime (24H)')}</span>
				</div>
				<div class="dp-monitor-telemetry-card">
					<span class="dp-monitor-telemetry-value">{getEndpoints().length} {t('Node', 'Nodes')}</span>
					<span class="dp-monitor-telemetry-label">{t('Aktif Endpoint’ler', 'Active Endpoints')}</span>
				</div>
				<div class="dp-monitor-telemetry-card">
					<span class="dp-monitor-telemetry-value">{getAverageLatency()}</span>
					<span class="dp-monitor-telemetry-label">{t('Ort. Global Gecikme', 'Avg Global Latency')}</span>
				</div>
				<div class="dp-monitor-telemetry-card">
					<span class={`dp-monitor-telemetry-value ${getIncidents() > 0 ? 'is-danger' : 'is-success'}`}>{getIncidents()}</span>
					<span class="dp-monitor-telemetry-label">{t('Açık Olaylar', 'Open Incidents')}</span>
				</div>
			</div>

			<Show when={isAdmin()}>
				<AddEndpoint onEndpointAdded={handleEndpointAdded} />
			</Show>

			<Show when={endpointsData.loading}>
				<div class="dp-monitor-loading-panel">
					<div class="dp-monitor-spinner" />
					<p>{t('Node listesi yükleniyor...', 'Node list is loading...')}</p>
				</div>
			</Show>

			<Show when={!endpointsData.loading}>
				<Show
					when={!loadError() && endpointsData()?.endpoints.length > 0}
					fallback={
						loadError() ? (
							<div class="dp-monitor-empty">
								<div class="dp-monitor-empty-icon">[!]</div>
								<h3>{t('Monitor verisi alınamadı', 'Monitor data could not be loaded')}</h3>
								<p>{loadError()}</p>
							</div>
						) : (
							<div class="dp-monitor-empty">
								<div class="dp-monitor-empty-icon">[0]</div>
								<h3>{t('Henüz monitor edilen endpoint yok', 'There are no monitored endpoints yet')}</h3>
								<p>{isAdmin() ? t('Yukarıdaki panelden yeni endpoint ekleyin.', 'Add a new endpoint from the panel above.') : t("Demo endpoint seed'i kısa süre içinde yansır.", 'The demo endpoint seed will appear shortly.')}</p>
							</div>
						)
					}
				>
					<div class="dp-monitor-node-grid">
						<For each={getEndpoints()}>
							{(endpoint) => (
								<EndpointCard
									endpoint={endpoint}
									isAdmin={isAdmin()}
									onRemove={handleRemoveEndpoint}
									onCheck={handleCheckEndpoint}
								/>
							)}
						</For>
					</div>
				</Show>
			</Show>

			<div class="dp-monitor-doc-layout">
				<div>
					<h2 class="dp-monitor-section-title">{t('SYSTEM_MANUAL // NASIL ÇALIŞIR?', 'SYSTEM_MANUAL // HOW IT WORKS')}</h2>
					<div class="dp-monitor-feature-list">
						<div class="dp-monitor-feature-item">
							<div class="dp-monitor-feature-icon">[~]</div>
							<div class="dp-monitor-feature-body">
					<h4>{t('Otomatik sağlık kontrolleri', 'Automated health checks')}</h4>
								<p>{t("Önemli API endpoint'lerinin durumunu, yanıt sürelerini ve uptime oranlarını her 5 dakikada bir daemon üzerinden otomatik kontrol eder.", 'Checks important API endpoints automatically every 5 minutes via the daemon, including status, response time, and uptime.')}</p>
							</div>
						</div>
						<div class="dp-monitor-feature-item">
							<div class="dp-monitor-feature-icon">[-]</div>
							<div class="dp-monitor-feature-body">
								<h4>{t('Uptime Varyansları', 'Uptime Variances')}</h4>
								<p>{t('24 saat, 7 gün ve 30 günlük uptime istatistikleri tarihsel loglardan üretilir; kısa kesintiler yalnız anlık değil toplu kalite olarak görülür.', '24h, 7d, and 30d uptime stats are derived from historical logs; short outages are treated as aggregate quality, not just momentary blips.')}</p>
							</div>
						</div>
						<div class="dp-monitor-feature-item">
							<div class="dp-monitor-feature-icon">[#]</div>
							<div class="dp-monitor-feature-body">
								<h4>{t('Admin İşlemleri', 'Admin Operations')}</h4>
								<p>{t('Root yetkisiyle yeni endpoint ekleme, interval override ve force check akışları aynı panelden tetiklenebilir.', 'With root access, adding endpoints, overriding intervals, and forcing checks can all be triggered from the same panel.')}</p>
							</div>
						</div>
					</div>
				</div>

				<div>
					<h2 class="dp-monitor-section-title">{t('CORE_FEATURES // MODÜLLER', 'CORE_FEATURES // MODULES')}</h2>
					<div class="dp-monitor-feature-list">
						<div class="dp-monitor-feature-item">
							<div class="dp-monitor-feature-icon">[!]</div>
							<div class="dp-monitor-feature-body">
								<h4>{t('Gerçek Zamanlı Monitoring', 'Real-Time Monitoring')}</h4>
								<p>Endpoint durumunu, latency varyansını ve kesinti alanlarını node bazlı kartlarda anlık izleyin.</p>
							</div>
						</div>
						<div class="dp-monitor-feature-item">
							<div class="dp-monitor-feature-icon">[S]</div>
							<div class="dp-monitor-feature-body">
								<h4>{t('SSL Doğrulama', 'SSL Verification')}</h4>
								<p>HTTPS endpoint'leri icin SSL gecerliligi ve kalan gun sinyali otomatik denetlenir.</p>
							</div>
						</div>
						<div class="dp-monitor-feature-item">
							<div class="dp-monitor-feature-icon">[=]</div>
							<div class="dp-monitor-feature-body">
								<h4>{t('İstatistiksel Agregasyon', 'Statistical Aggregation')}</h4>
								<p>24h, 7d ve 30d ortalama yanıt süreleri ile SLA seviyesini tek bakışta görebilirsiniz.</p>
							</div>
						</div>
					</div>
				</div>
			</div>

			<footer class="dp-monitor-footer">DP // DATAPULSE UPTIME DAEMON v3.1.2 - AUTH: ROOT - SYNC: ACTIVE</footer>
		</div>
	);
}
