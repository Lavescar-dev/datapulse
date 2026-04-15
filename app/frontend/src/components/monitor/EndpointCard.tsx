import { createSignal, Show } from 'solid-js';
import type { MonitoredEndpoint } from '../../../../shared/types/monitor';
import StatusHistory from './StatusHistory';
import { createLocaleSignal } from '../../lib/locale';

interface EndpointCardProps {
	endpoint: MonitoredEndpoint;
	isAdmin: boolean;
	onRemove?: (id: string) => void;
	onCheck?: (id: string) => void;
}

export default function EndpointCard(props: EndpointCardProps) {
	const locale = createLocaleSignal();
	const t = (tr: string, en: string) => (locale() === 'en' ? en : tr);
	const [showHistory, setShowHistory] = createSignal(false);
	const [checking, setChecking] = createSignal(false);

	const formatResponseTime = (ms: number | null | undefined) => {
		if (ms === null || ms === undefined) return t('Yok', 'N/A');
		if (ms < 1000) return `${Math.round(ms)}ms`;
		return `${(ms / 1000).toFixed(2)}s`;
	};

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		return date.toLocaleString('tr-TR', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	};

	const getStatusToken = () => {
		if (props.endpoint.currentStatus === 'up') return t('[✓] ÇALIŞIYOR', '[✓] UP');
		if (props.endpoint.currentStatus === 'down') return t('[x] KAPALI', '[x] DOWN');
		return t('[?] BİLİNMİYOR', '[?] UNKNOWN');
	};

	const getStatusClass = () => {
		if (props.endpoint.currentStatus === 'up') return 'is-success';
		if (props.endpoint.currentStatus === 'down') return 'is-danger';
		return 'is-dim';
	};

	const getSSLLabel = () => {
		if (!props.endpoint.ssl || !props.endpoint.url.startsWith('https://')) return t('SSL Sertifikası: Yok', 'SSL Certificate: N/A');
		return props.endpoint.ssl.valid ? t('SSL Sertifikası: Geçerli', 'SSL Certificate: Valid') : t('SSL Sertifikası: Geçersiz', 'SSL Certificate: Invalid');
	};

	const handleCheck = async () => {
		if (checking()) return;
		setChecking(true);
		try {
			await props.onCheck?.(props.endpoint.id);
		} finally {
			setChecking(false);
		}
	};

	return (
		<div class="dp-monitor-node-card">
			<div class="dp-monitor-node-header">
				<div class="dp-monitor-node-title-group">
					<div class="dp-monitor-node-title">{props.endpoint.name}</div>
					<div class="dp-monitor-node-url">{props.endpoint.url}</div>
				</div>
				<div class={`dp-monitor-node-status ${getStatusClass()}`}>{getStatusToken()}</div>
			</div>

			<div class="dp-monitor-node-meta-bar">
				<span>{t('YÖNTEM', 'METHOD')}: {props.endpoint.method}</span>
				<span>{t('ARALIK', 'INTERVAL')}: {props.endpoint.checkInterval} {t('DK', 'MIN')}</span>
				<span>{t('SON PULSE', 'LAST_PULSE')}: {props.endpoint.lastCheck ? formatDate(props.endpoint.lastCheck) : '-'}</span>
			</div>

			<div class="dp-monitor-metrics-grid">
				<div class="dp-monitor-metric-block">
					<span class="dp-monitor-metric-label">{t('Anlık ping', 'Current Ping')}</span>
					<span class={`dp-monitor-metric-value ${props.endpoint.lastResponseTime && props.endpoint.lastResponseTime > 300 ? 'is-warning' : ''}`}>
						{formatResponseTime(props.endpoint.lastResponseTime)}
					</span>
				</div>
				<div class="dp-monitor-metric-block">
					<span class="dp-monitor-metric-label">{t('24S Çalışma', '24H Uptime')}</span>
					<span class="dp-monitor-metric-value is-success">{props.endpoint.uptimeStats['24h'].uptimePercent.toFixed(2)}%</span>
					<span class="dp-monitor-metric-sub">{props.endpoint.uptimeStats['24h'].successfulChecks}/{props.endpoint.uptimeStats['24h'].totalChecks} {t('kontrol', 'checks')}</span>
				</div>
				<div class="dp-monitor-metric-block">
					<span class="dp-monitor-metric-label">{t('7G Çalışma', '7D Uptime')}</span>
					<span class="dp-monitor-metric-value is-success">{props.endpoint.uptimeStats['7d'].uptimePercent.toFixed(2)}%</span>
					<span class="dp-monitor-metric-sub">{props.endpoint.uptimeStats['7d'].successfulChecks}/{props.endpoint.uptimeStats['7d'].totalChecks} {t('kontrol', 'checks')}</span>
				</div>
				<div class="dp-monitor-metric-block">
					<span class="dp-monitor-metric-label">{t('30G Çalışma', '30D Uptime')}</span>
					<span class="dp-monitor-metric-value is-success">{props.endpoint.uptimeStats['30d'].uptimePercent.toFixed(2)}%</span>
					<span class="dp-monitor-metric-sub">{props.endpoint.uptimeStats['30d'].successfulChecks}/{props.endpoint.uptimeStats['30d'].totalChecks} {t('kontrol', 'checks')}</span>
				</div>
			</div>

			<div class="dp-monitor-avg-grid">
				<div class="dp-monitor-avg-block">
					<span class="dp-monitor-avg-label">{t('Ort. 24s', 'Avg 24h')}</span>
					<span class="dp-monitor-avg-value">{formatResponseTime(props.endpoint.uptimeStats['24h'].averageResponseTime)}</span>
				</div>
				<div class="dp-monitor-avg-block">
					<span class="dp-monitor-avg-label">{t('Ort. 7g', 'Avg 7d')}</span>
					<span class="dp-monitor-avg-value">{formatResponseTime(props.endpoint.uptimeStats['7d'].averageResponseTime)}</span>
				</div>
				<div class="dp-monitor-avg-block">
					<span class="dp-monitor-avg-label">{t('Ort. 30g', 'Avg 30d')}</span>
					<span class="dp-monitor-avg-value">{formatResponseTime(props.endpoint.uptimeStats['30d'].averageResponseTime)}</span>
				</div>
			</div>

			<div class={`dp-monitor-node-footer ${props.endpoint.ssl?.valid === false ? 'is-danger' : 'is-success'}`}>
				<span>🔒 {getSSLLabel()}</span>
				<Show when={props.endpoint.ssl?.daysRemaining !== undefined}>
					<span>{props.endpoint.ssl!.daysRemaining} {t('gün', 'days')}</span>
				</Show>
			</div>

			<div class="dp-monitor-node-actions">
				<button onClick={() => setShowHistory(!showHistory())} class="dp-monitor-action-button" type="button">
					{showHistory() ? t('GEÇMİŞİ GİZLE', 'HIDE HISTORY') : t('GEÇMİŞİ GÖSTER', 'SHOW HISTORY')}
				</button>
				<Show when={props.isAdmin}>
					<button onClick={handleCheck} class="dp-monitor-action-button" type="button" disabled={checking()}>
						{checking() ? t('KONTROL EDİLİYOR...', 'CHECKING...') : t('ZORLA KONTROL', 'FORCE CHECK')}
					</button>
					<button onClick={() => props.onRemove?.(props.endpoint.id)} class="dp-monitor-action-button is-danger" type="button">
						{t('KALDIR', 'REMOVE')}
					</button>
				</Show>
			</div>

			<Show when={showHistory()}>
				<div class="dp-monitor-history-panel">
					<StatusHistory history={props.endpoint.history} />
				</div>
			</Show>
		</div>
	);
}
