import { For, Show } from 'solid-js';
import type { HealthCheckResult } from '../../../../shared/types/monitor';
import { createLocaleSignal } from '../../lib/locale';

interface StatusHistoryProps {
	history: HealthCheckResult[];
}

export default function StatusHistory(props: StatusHistoryProps) {
	const locale = createLocaleSignal();
	const t = (tr: string, en: string) => (locale() === 'en' ? en : tr);
	const recentHistory = () => [...props.history].reverse().slice(0, 20);

	const formatDate = (dateString: string) =>
		new Date(dateString).toLocaleString('tr-TR', {
			day: '2-digit',
			month: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
		});

	const formatResponseTime = (ms: number | null) => {
		if (ms === null) return t('Yok', 'N/A');
		if (ms < 1000) return `${Math.round(ms)}ms`;
		return `${(ms / 1000).toFixed(2)}s`;
	};

	return (
		<div class="dp-monitor-history-shell">
			<Show
				when={recentHistory().length > 0}
				fallback={<div class="dp-monitor-history-empty">{t('Henüz geçmiş verisi yok', 'No history data available yet')}</div>}
			>
				<div class="dp-monitor-history-list">
					<For each={recentHistory()}>
						{(check) => (
							<div class="dp-monitor-history-row">
								<div class="dp-monitor-history-left">
									<span class={`dp-monitor-history-dot ${check.isUp ? 'is-success' : 'is-danger'}`} />
									<span>{formatDate(check.timestamp)}</span>
								</div>
								<div class="dp-monitor-history-right">
									<Show when={check.statusCode}>
										<span>{check.statusCode}</span>
									</Show>
									<Show when={check.responseTime !== null}>
										<span>{formatResponseTime(check.responseTime)}</span>
									</Show>
									<Show when={check.error}>
										<span class="is-danger">{check.error}</span>
									</Show>
								</div>
							</div>
						)}
					</For>
				</div>
			</Show>
		</div>
	);
}
