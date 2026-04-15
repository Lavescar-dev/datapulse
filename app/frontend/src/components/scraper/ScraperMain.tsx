import { Show, createResource, createSignal } from 'solid-js';
import ScrapeForm from './ScrapeForm';
import ResultsView from './ResultsView';
import ShowcaseGallery from './ShowcaseGallery';
import { apiFetch, apiJson } from '../../lib/api';
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

export default function ScraperMain() {
	const locale = createLocaleSignal();
	const t = (tr: string, en: string) => (locale() === 'en' ? en : tr);
	const [isLoading, setIsLoading] = createSignal(false);
	const [scrapesRemaining, setScrapesRemaining] = createSignal(3);
	const [currentResult, setCurrentResult] = createSignal<ScrapeResult | null>(null);
	const [lastTargetUrl, setLastTargetUrl] = createSignal('https://ahmetdemir.dk');

	const syncSessionStatus = async () => {
		try {
			const data = await apiJson<any>('/api/session/status');
			setScrapesRemaining(data.scrapesRemaining ?? 3);
			return data;
		} catch {
			return null;
		}
	};

	createResource(syncSessionStatus);

	const pollJobStatus = async (id: string, targetUrl: string) => {
		let attempts = 0;
		const maxAttempts = 60;

		const poll = async () => {
			if (attempts >= maxAttempts) {
				setIsLoading(false);
				setCurrentResult({
					success: false,
					error: t('Scraping zaman aşımına uğradı', 'Scraping timed out'),
					url: targetUrl,
					scrapedAt: Date.now(),
				});
				return;
			}

			attempts += 1;

			try {
				const data = await apiJson<any>(`/api/scraper/status/${id}`, {
					requireSession: true,
					retryOnAuth: attempts === 1,
				});

				if (data.status === 'completed') {
					const result = await apiJson<ScrapeResult>(`/api/scraper/result/${id}`, {
						requireSession: true,
					});
					setCurrentResult(result);
					setLastTargetUrl(result.url || targetUrl);
					await syncSessionStatus();

					setIsLoading(false);
				} else if (data.status === 'failed') {
					setCurrentResult({
						success: false,
						error: data.error || t('Scraping başarısız oldu', 'Scraping failed'),
						url: targetUrl,
						scrapedAt: Date.now(),
					});
					setIsLoading(false);
				} else {
					setTimeout(poll, 2000);
				}
			} catch (error) {
				setCurrentResult({
					success: false,
					error: error instanceof Error ? error.message : t('Bilinmeyen hata', 'Unknown error'),
					url: targetUrl,
					scrapedAt: Date.now(),
				});
				setIsLoading(false);
			}
		};

		poll();
	};

	const handleScrapeSubmit = async (url: string, selector?: string, autoDetect?: boolean) => {
		setIsLoading(true);
		setCurrentResult(null);
		setLastTargetUrl(url);

		try {
			const response = await apiFetch('/api/scraper/submit', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				requireSession: true,
				body: JSON.stringify({
					url,
					selector,
					autoDetect,
				}),
			});

			const data = await response.json();
			await pollJobStatus(data.jobId, url);
		} catch (error) {
			await syncSessionStatus();
			setIsLoading(false);
			setCurrentResult({
				success: false,
				error: error instanceof Error ? error.message : t('Scraping başarısız', 'Scraping failed'),
				url,
				scrapedAt: Date.now(),
			});
		}
	};

	const handleSelectExample = async (exampleId: string) => {
		setIsLoading(true);
		setCurrentResult(null);

		try {
			const data = await apiJson<any>(`/api/scraper/examples/${exampleId}`);
			setCurrentResult({
				success: true,
				data: data.data,
				url: data.url,
				scrapedAt: data.scrapedAt,
				itemCount: data.itemCount,
				pattern: data.pattern,
				engine: data.engine,
				fallbackUsed: data.fallbackUsed,
				warning: data.warning,
				attemptedEngine: data.attemptedEngine,
			});
			setLastTargetUrl(data.url);
		} catch (error) {
			setCurrentResult({
				success: false,
				error: error instanceof Error ? error.message : t('Örnek yüklenemedi', 'Example could not be loaded'),
				url: lastTargetUrl(),
				scrapedAt: Date.now(),
			});
		} finally {
			setIsLoading(false);
		}
	};

	const activeEngineLabel = () => {
		const result = currentResult();
		if (result?.fallbackUsed && result?.attemptedEngine && result?.engine) {
			return `${result.attemptedEngine} -> ${result.engine}`;
		}
		return result?.engine || 'puppeteer -> cheerio';
	};

	const patternLabel = () => {
		return currentResult()?.pattern ? currentResult()!.pattern!.replace(/-/g, ' ').toUpperCase() : 'AUTO DETECT';
	};

	const executionMode = () => {
		if (currentResult()?.success) {
			return currentResult()?.fallbackUsed ? t('Canlı + Fallback Parity', 'Live + Fallback Parity') : t('Canlı + Dataset Parity', 'Live + Dataset Parity');
		}
		return t('Canlı + Dataset Parity', 'Live + Dataset Parity');
	};

	return (
		<div class="dp-scraper-shell">
			<ScrapeForm
				onSubmit={handleScrapeSubmit}
				isLoading={isLoading()}
				scrapesRemaining={scrapesRemaining()}
			/>

			<section class="dp-scraper-telemetry-grid">
				<div class="dp-scraper-telemetry-card">
					<span class="dp-scraper-telemetry-value tone-warn">{activeEngineLabel()}</span>
					<span class="dp-scraper-telemetry-label">{t('Motor Fallback Durumu', 'Engine Fallback Status')}</span>
				</div>
				<div class="dp-scraper-telemetry-card">
					<span class="dp-scraper-telemetry-value">{patternLabel()}</span>
					<span class="dp-scraper-telemetry-label">{t('Pattern Tanıma', 'Pattern Recognition')}</span>
				</div>
				<div class="dp-scraper-telemetry-card">
					<span class="dp-scraper-telemetry-value">{executionMode()}</span>
					<span class="dp-scraper-telemetry-label">{t('Çalışma Modu', 'Execution Mode')}</span>
				</div>
				<div class="dp-scraper-telemetry-card">
					<span class="dp-scraper-telemetry-value tone-good">{scrapesRemaining()} Remaining</span>
					<span class="dp-scraper-telemetry-label">{t('Demo Oturum Limiti', 'Session Demo Limit')}</span>
				</div>
			</section>

			<section class={`dp-scraper-system-alert ${currentResult()?.fallbackUsed ? 'warning' : 'info'}`}>
				<div class="dp-scraper-alert-icon">{currentResult()?.fallbackUsed ? '[!]' : '[i]'}</div>
				<div class="dp-scraper-alert-body">
					<h4>{currentResult()?.fallbackUsed ? t('Statik HTML modu kontrollü şekilde devreye girdi', 'Static HTML mode activated in a controlled way') : t('Demo & Infrastructure Policy', 'Demo & Infrastructure Policy')}</h4>
					<p>
						{currentResult()?.fallbackUsed && currentResult()?.warning
							? currentResult()!.warning
							: t('Demo kullanıcıları için 3 scrape limiti vardır. Root/Admin oturumunda limit kalkar. Ağır queue altyapısı yoksa scrape jobları aynı oturumda inline çalışır.', 'Demo users have a 3-scrape limit. The limit is removed in Root/Admin sessions. If there is no heavy queue infrastructure, scrape jobs run inline in the same session.')}
					</p>
				</div>
			</section>

			<Show when={isLoading()}>
				<section class="dp-scraper-loading-panel">
					<div class="dp-scraper-loading-kicker">{t('PIPELINE DURUMU', 'PIPELINE_STATUS')}</div>
					<h3>{t('Extraction işi çalışıyor', 'Extraction job is running')}</h3>
					<p>{t(`${lastTargetUrl()} taranıyor. Queue yoksa iş inline tamamlanır ve sonuç tablosu aynı yüzeyde açılır.`, `${lastTargetUrl()} is being scanned. If there is no queue, the job completes inline and the result table opens on the same surface.`)}</p>
					<div class="dp-scraper-loading-log">
						<div>$ scraper.submit() --url {lastTargetUrl()}</div>
						<div>-&gt; session quota verified</div>
						<div>-&gt; extraction pipeline warming up</div>
						<div>-&gt; polling job status</div>
					</div>
				</section>
			</Show>

			<ResultsView result={currentResult()} />

			<section class="dp-scraper-doc-layout">
				<div>
					<h2 class="dp-scraper-section-title">{t('ENGINE_MANUAL // NASIL ÇALIŞIR?', 'ENGINE_MANUAL // HOW IT WORKS')}</h2>
					<div class="dp-scraper-step-list">
						<div class="dp-scraper-step-item">
							<div class="dp-scraper-step-num">01</div>
							<div class="dp-scraper-step-body">
								<h4>{t('Hedef Başlatma', 'Target Initialization')}</h4>
								<p>{t('URL girin ve otomatik pattern algılama ile scraping daemon akışını başlatın.', 'Enter a URL and start the scraping daemon flow with automatic pattern detection.')}</p>
							</div>
						</div>
						<div class="dp-scraper-step-item">
							<div class="dp-scraper-step-num">02</div>
							<div class="dp-scraper-step-body">
								<h4>{t('Selector Override', 'Selector Override')}</h4>
								<p>{t("Algılama yeterli değilse belirli DOM node'larını CSS selector ile manuel override edin.", 'If detection is not enough, manually override specific DOM nodes with CSS selectors.')}</p>
							</div>
						</div>
						<div class="dp-scraper-step-item">
							<div class="dp-scraper-step-num">03</div>
							<div class="dp-scraper-step-body">
								<h4>{t('Motor Yönlendirme', 'Engine Routing')}</h4>
								<p>{t('Puppeteer önce denenir. Ortam engellerse Cheerio aynı veri akışında fallback olarak devreye girer.', 'Puppeteer is tried first. If the environment blocks it, Cheerio falls back in the same data flow.')}</p>
							</div>
						</div>
						<div class="dp-scraper-step-item">
							<div class="dp-scraper-step-num">04</div>
							<div class="dp-scraper-step-body">
								<h4>Data Serialization</h4>
								<p>Sonuclari tablo veya JSON olarak inceleyin; JSON ve CSV export ile local sisteme alin.</p>
							</div>
						</div>
					</div>

					<section class="dp-scraper-system-alert info compact">
						<div class="dp-scraper-alert-icon">[i]</div>
						<div class="dp-scraper-alert-body">
							<h4>Operational Notes</h4>
							<p>Fallback veri sürekliliği içindir. Dynamic alanlar eksik gelebilir ama pipeline bozulmuş sayılmaz. Cached parity datasets aynı sonuç panelini kullanır.</p>
						</div>
					</section>
				</div>

				<div>
					<ShowcaseGallery onSelectExample={handleSelectExample} />
				</div>
			</section>

			<footer class="dp-scraper-footer-note">
				DP // DATAPULSE SCRAPER ENGINE - FALLBACK AWARE - TARGET {lastTargetUrl()}
			</footer>
		</div>
	);
}
