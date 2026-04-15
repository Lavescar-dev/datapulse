import { For, Show, createSignal } from 'solid-js';
import { createLocaleSignal } from '../../lib/locale';

interface ScrapeResult {
	success: boolean;
	data?: any[];
	error?: string;
	url: string;
	scrapedAt: number;
	itemCount?: number;
	pattern?: string;
	engine?: 'puppeteer' | 'cheerio';
	fallbackUsed?: boolean;
	warning?: string;
	attemptedEngine?: 'puppeteer';
}

interface ResultsViewProps {
	result: ScrapeResult | null;
}

export default function ResultsView(props: ResultsViewProps) {
	const locale = createLocaleSignal();
	const t = (tr: string, en: string) => (locale() === 'en' ? en : tr);
	const [viewMode, setViewMode] = createSignal<'table' | 'json'>('table');

	const formatDate = (timestamp: number) =>
		new Date(timestamp).toLocaleString('tr-TR', {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});

	const getHeaders = () => {
		if (!props.result?.data?.length) return [] as string[];
		const allKeys = new Set<string>();
		props.result.data.forEach((item) => {
			Object.keys(item).forEach((key) => allKeys.add(key));
		});
		return Array.from(allKeys);
	};

	const downloadJSON = () => {
		if (!props.result?.data) return;
		const dataStr = JSON.stringify(props.result.data, null, 2);
		const blob = new Blob([dataStr], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `scraped-data-${Date.now()}.json`;
		link.click();
		URL.revokeObjectURL(url);
	};

	const downloadCSV = () => {
		if (!props.result?.data || props.result.data.length === 0) return;
		const headers = getHeaders();
		const csvRows = [
			headers.join(','),
			...props.result.data.map((item) =>
				headers
					.map((header) => {
						const value = item[header] || '';
						const escaped = String(value).replace(/"/g, '""');
						return escaped.includes(',') || escaped.includes('\n') ? `"${escaped}"` : escaped;
					})
					.join(','),
			),
		];
		const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `scraped-data-${Date.now()}.csv`;
		link.click();
		URL.revokeObjectURL(url);
	};

	const formatCellValue = (value: unknown) => {
		if (value === null || value === undefined || value === '') return '—';
		if (typeof value === 'object') return JSON.stringify(value);
		return String(value);
	};

	return (
		<Show when={props.result}>
			<Show
				when={props.result?.success && props.result?.data}
				fallback={
					<section class="dp-scraper-data-panel">
						<div class="dp-scraper-panel-head">
							<span>RESULT_SNAPSHOT // HATA</span>
							<span>{t('[Run failed]', '[Run failed]')}</span>
						</div>
						<div class="dp-scraper-error-copy">
							<h3>{t('Scrape sonucu üretilemedi', 'Scrape result could not be generated')}</h3>
							<p>{props.result?.error || t('Bilinmeyen bir hata oluştu.', 'An unknown error occurred.')}</p>
						</div>
					</section>
				}
			>
				<section class="dp-scraper-data-panel">
					<div class="dp-scraper-panel-head">
						<span>{t('RESULT_SNAPSHOT //', 'RESULT_SNAPSHOT //')} {(props.result!.itemCount || props.result!.data!.length)} {t('KAYIT BULUNDU', 'ROWS FOUND')}</span>
						<span>[{t('Satır', 'Rows')}: {props.result!.itemCount || props.result!.data!.length} | {t('Sütun', 'Cols')}: {getHeaders().length} | {t('Son Çalışma', 'Last run')}: {formatDate(props.result!.scrapedAt)}]</span>
					</div>
					<div class="dp-scraper-panel-meta">
						<div>&gt; {t('Hedef', 'Target')}: {props.result!.url}</div>
						<div>&gt; {t('Pattern', 'Pattern')}: {props.result!.pattern || 'articles'}</div>
						<div>&gt; {t('Aktif motor', 'Active engine')}: {props.result!.engine || 'cheerio'}</div>
					</div>

					<Show when={viewMode() === 'table'}>
						<div class="dp-scraper-table-wrap">
							<table class="dp-scraper-table">
								<thead>
									<tr>
										<For each={getHeaders()}>
											{(key) => <th>{key}</th>}
										</For>
									</tr>
								</thead>
								<tbody>
									<For each={props.result!.data!}>
										{(item) => (
											<tr>
												<For each={getHeaders()}>
													{(header) => {
														const value = item[header];
														const cellValue = formatCellValue(value);
														return (
															<td>
																{typeof value === 'string' && value.startsWith('http') ? (
																	<a href={value} target="_blank" rel="noopener noreferrer" class="dp-scraper-link">
																		{value.length > 72 ? `${value.substring(0, 72)}...` : value}
																	</a>
																) : (
																	<span>{cellValue}</span>
																)}
															</td>
														);
													}}
												</For>
											</tr>
										)}
									</For>
								</tbody>
							</table>
						</div>
					</Show>

					<Show when={viewMode() === 'json'}>
						<div class="dp-scraper-json-wrap">
							<pre><code>{JSON.stringify(props.result!.data, null, 2)}</code></pre>
						</div>
					</Show>

					<div class="dp-scraper-panel-actions">
						<div class="dp-scraper-view-toggle-group">
							<button
								type="button"
								onClick={() => setViewMode('table')}
								class={`dp-scraper-inline-button ${viewMode() === 'table' ? 'is-active' : ''}`}
							>
								{t('TABLO', 'TABLE')}
							</button>
							<button
								type="button"
								onClick={() => setViewMode('json')}
								class={`dp-scraper-inline-button ${viewMode() === 'json' ? 'is-active' : ''}`}
							>
								{t('JSON', 'JSON')}
							</button>
						</div>
						<div class="dp-scraper-export-row">
							<button type="button" onClick={downloadJSON} class="dp-scraper-inline-button">{t('JSON DIŞA AKTAR', 'EXPORT JSON')}</button>
							<button type="button" onClick={downloadCSV} class="dp-scraper-inline-button">{t('CSV DIŞA AKTAR', 'EXPORT CSV')}</button>
						</div>
					</div>
				</section>
			</Show>
		</Show>
	);
}
