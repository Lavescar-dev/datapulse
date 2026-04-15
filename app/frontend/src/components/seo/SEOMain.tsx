import { Show, createEffect, createResource, createSignal, onCleanup } from 'solid-js';
import AnalyzeForm from './AnalyzeForm';
import ReportView from './ReportView';
import type { SEOReport } from '../../../../shared/types/jobs';
import { apiJson, apiFetch } from '../../lib/api';
import { createLocaleSignal } from '../../lib/locale';

interface SEOAnalyzeResult {
	success: boolean;
	report?: SEOReport;
	error?: string;
	url: string;
	analyzedAt: number;
}

export default function SEOMain() {
	const locale = createLocaleSignal();
	const t = (tr: string, en: string) => (locale() === 'en' ? en : tr);
	const [isLoading, setIsLoading] = createSignal(false);
	const [analysesRemaining, setAnalysesRemaining] = createSignal(3);
	const [currentResult, setCurrentResult] = createSignal<SEOAnalyzeResult | null>(null);
	const [jobId, setJobId] = createSignal<string | null>(null);
	const [lastSubmittedUrl, setLastSubmittedUrl] = createSignal('');
	const [loadingStep, setLoadingStep] = createSignal(0);
	const [pollAttempts, setPollAttempts] = createSignal(0);
	const loadingSteps = () => [
		t('URL doğrulanıyor ve analiz kuyruğuna alınıyor.', 'URL is being validated and queued for analysis.'),
		t('HTML, meta alanları ve teknik başlıklar okunuyor.', 'HTML, meta fields, and technical headings are being read.'),
		t('SSL, DNS, robots ve sitemap sinyalleri taranıyor.', 'SSL, DNS, robots, and sitemap signals are being scanned.'),
		t('Kategori skorları, öneriler ve audit özeti derleniyor.', 'Category scores, recommendations, and the audit summary are being compiled.'),
	];

	createResource(async () => {
		try {
			const data = await apiJson<any>('/api/session/status');
			setAnalysesRemaining(data.seoAnalysesRemaining || 3);
			return data;
		} catch {
			return null;
		}
	});

	createEffect(() => {
		if (!isLoading()) return;
		const interval = window.setInterval(() => {
			setLoadingStep((current) => (current + 1) % loadingSteps().length);
		}, 2200);
		onCleanup(() => window.clearInterval(interval));
	});

	const pollJobStatus = async (id: string) => {
		let attempts = 0;
		const maxAttempts = 60;

		const poll = async () => {
			if (attempts >= maxAttempts) {
				setIsLoading(false);
				setCurrentResult({
					success: false,
					error: t('SEO analizi zaman aşımına uğradı', 'SEO analysis timed out'),
					url: lastSubmittedUrl(),
					analyzedAt: Date.now(),
				});
				return;
			}

			attempts += 1;
			setPollAttempts(attempts);

			try {
				const data = await apiJson<any>(`/api/seo/status/${id}`, {
					requireSession: true,
					retryOnAuth: attempts === 1,
				});

				if (data.status === 'completed') {
					const result = await apiJson<SEOAnalyzeResult>(`/api/seo/result/${id}`, {
						requireSession: true,
					});
					setCurrentResult(result);
					setAnalysesRemaining(Math.max(0, analysesRemaining() - 1));

					setIsLoading(false);
				} else if (data.status === 'failed') {
						setCurrentResult({
							success: false,
							error: data.error || t('SEO analizi başarısız oldu', 'SEO analysis failed'),
							url: lastSubmittedUrl(),
							analyzedAt: Date.now(),
						});
					setIsLoading(false);
				} else {
					window.setTimeout(poll, 2000);
				}
			} catch (error) {
					setCurrentResult({
						success: false,
						error: error instanceof Error ? error.message : t('Bilinmeyen hata', 'Unknown error'),
						url: lastSubmittedUrl(),
						analyzedAt: Date.now(),
					});
				setIsLoading(false);
			}
		};

		poll();
	};

	const handleAnalyzeSubmit = async (url: string) => {
		setIsLoading(true);
		setCurrentResult(null);
		setLastSubmittedUrl(url);
		setLoadingStep(0);
		setPollAttempts(0);

		try {
			const response = await apiFetch('/api/seo/analyze', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				requireSession: true,
				body: JSON.stringify({ url }),
			});

			const data = await response.json();
			setJobId(data.jobId);
			await pollJobStatus(data.jobId);
		} catch (error) {
			setIsLoading(false);
			setCurrentResult({
				success: false,
				error: error instanceof Error ? error.message : t('SEO analizi başarısız', 'SEO analysis failed'),
				url,
				analyzedAt: Date.now(),
			});
		}
	};

	const handlePrint = () => window.print();

	const copyText = async (value: string) => {
		if (!value) return;
		await navigator.clipboard.writeText(value);
	};

	const handleShare = async () => {
		const result = currentResult();
		if (!result) return;
		const shareData = {
			title: t('DataPulse SEO Audit', 'DataPulse SEO Audit'),
			text: t(`${result.url} için SEO audit özeti`, `SEO audit summary for ${result.url}`),
		};
		if (navigator.share) {
			await navigator.share(shareData);
			return;
		}
		await copyText(`${shareData.title}\n${shareData.text}`);
	};

	const getSummaryCopy = () => {
		const result = currentResult();
		const report = result?.report;
		if (!result || !report) return '';
		return [
			`URL: ${result.url}`,
			`${t('Tarih', 'Date')}: ${new Date(result.analyzedAt).toLocaleString(locale() === 'en' ? 'en-US' : 'tr-TR')}`,
			`Skor: ${report.performanceScore?.overall ?? '-'}`,
			`${t('Özet', 'Summary')}: ${report.summary?.headline ?? t('Özet mevcut değil', 'No summary available')}`,
		].join('\n');
	};

	return (
		<div class="dp-seo-shell">
			<AnalyzeForm
				onSubmit={handleAnalyzeSubmit}
				isLoading={isLoading()}
				analysesRemaining={analysesRemaining()}
				lastSubmittedUrl={lastSubmittedUrl()}
			/>

			<Show when={isLoading()}>
					<section class="dp-seo-loading-panel">
						<div class="dp-seo-loading-kicker">{t('SCAN PIPELINE', 'SCAN PIPELINE')}</div>
						<h3>{lastSubmittedUrl() || t('Yeni URL', 'New URL')} {t('taranıyor', 'is being scanned')}</h3>
						<p>{loadingSteps()[loadingStep()]}</p>
						<div class="dp-seo-loading-track">
							<div class="dp-seo-loading-fill" style={{ width: `${Math.min(92, 18 + pollAttempts() * 2)}%` }} />
						</div>
						<div class="dp-seo-loading-meta">
							<span>{t('JOB', 'JOB')}: {jobId() || t('hazırlanıyor', 'preparing')}</span>
							<span>{t('DENEME', 'ATTEMPT')}: {pollAttempts()}</span>
						</div>
					</section>
				</Show>

			<Show when={!isLoading() && currentResult()?.success && currentResult()?.report}>
					<section class="dp-seo-action-row">
						<div class="dp-seo-action-copy">
							<span>{t('RAPOR HAZIR', 'REPORT READY')}</span>
							<p>{currentResult()?.url}</p>
						</div>
						<div class="dp-seo-action-buttons">
							<button class="dp-seo-action-button" type="button" onClick={handlePrint}>PDF</button>
							<button class="dp-seo-action-button" type="button" onClick={() => copyText(currentResult()?.url || '')}>URL</button>
							<button class="dp-seo-action-button" type="button" onClick={() => copyText(getSummaryCopy())}>{t('ÖZET', 'SUMMARY')}</button>
							<button class="dp-seo-action-button" type="button" onClick={() => void handleShare()}>{t('PAYLAŞ', 'SHARE')}</button>
						</div>
					</section>
			</Show>

			<Show when={!isLoading() && currentResult()}>
				<ReportView
					report={currentResult()?.success ? currentResult()!.report! : null}
					error={currentResult()?.success ? undefined : currentResult()?.error}
					analyzedAt={currentResult()?.analyzedAt}
					analyzedUrl={currentResult()?.url}
				/>
			</Show>
		</div>
	);
}
