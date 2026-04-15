import { Show, createSignal } from 'solid-js';
import { createLocaleSignal } from '../../lib/locale';

interface ScrapeFormProps {
	onSubmit: (url: string, selector?: string, autoDetect?: boolean) => void;
	isLoading: boolean;
	scrapesRemaining: number;
}

export default function ScrapeForm(props: ScrapeFormProps) {
	const locale = createLocaleSignal();
	const t = (tr: string, en: string) => (locale() === 'en' ? en : tr);
	const [url, setUrl] = createSignal('');
	const [selector, setSelector] = createSignal('');
	const [autoDetect, setAutoDetect] = createSignal(true);
	const [showAdvanced, setShowAdvanced] = createSignal(false);
	const [error, setError] = createSignal('');

	const quickTargets = [
		{ label: 'Ahmet Demir', url: 'https://ahmetdemir.dk' },
		{ label: 'TechCrunch', url: 'https://techcrunch.com' },
		{ label: 'Hepsiburada', url: 'https://www.hepsiburada.com/laptop-notebook-dizustu-bilgisayarlar-c-98' },
	];

	const normalizeUrl = (input: string): string => {
		const trimmed = input.trim();
		if (!trimmed) return '';
		return /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
	};

	const validateUrl = (input: string): boolean => {
		try {
			const parsed = new URL(input);
			return parsed.protocol === 'http:' || parsed.protocol === 'https:';
		} catch {
			return false;
		}
	};

	const handleSubmit = (e: Event) => {
		e.preventDefault();
		setError('');

		const normalizedUrl = normalizeUrl(url());

		if (!normalizedUrl) {
			setError(t('Scrape için bir URL girin.', 'Please enter a URL for scraping.'));
			return;
		}

		if (!validateUrl(normalizedUrl)) {
			setError(t('Geçerli bir URL girin. Örnek: https://example.com', 'Enter a valid URL. Example: https://example.com'));
			return;
		}

		if (props.scrapesRemaining <= 0) {
			setError(t('Demo scrape limitiniz doldu.', 'You have reached your demo scrape limit.'));
			return;
		}

		setUrl(normalizedUrl);
		props.onSubmit(normalizedUrl, selector().trim() || undefined, autoDetect());
	};

	const handleTarget = (targetUrl: string) => {
		setUrl(targetUrl);
		setAutoDetect(true);
		setSelector('');
		setError('');
	};

	return (
		<section class="dp-scraper-cli-wrap">
			<form onSubmit={handleSubmit} class="dp-scraper-cli" aria-label={t('Veri kazıma komut çubuğu', 'Data scrape command bar')}>
				<span class="dp-scraper-cli-prompt">$ scraper.init() --url</span>
				<input
					type="text"
					value={url()}
					onInput={(e) => setUrl(e.currentTarget.value)}
					placeholder="https://example.com"
					class="dp-scraper-cli-input"
					disabled={props.isLoading}
				/>
				<button
					type="submit"
					disabled={props.isLoading || props.scrapesRemaining <= 0}
					class="dp-scraper-cli-button"
				>
					{props.isLoading ? t('ÇALIŞIYOR', 'RUNNING') : t('ÇALIŞTIR', 'EXECUTE')}
				</button>
			</form>

			<div class="dp-scraper-cli-toolbar">
				<div class="dp-scraper-cli-meta">
					<span>{autoDetect() ? t('OTOMATİK ALGILA', 'AUTO DETECT') : t('MANUEL SELECTOR', 'MANUAL SELECTOR')}</span>
					<span>{selector().trim() ? t('SELECTOR OVERRIDE AKTİF', 'SELECTOR OVERRIDE ACTIVE') : t('SELECTOR İSTEĞE BAĞLI', 'SELECTOR OPTIONAL')}</span>
					<span>{props.scrapesRemaining} {t('KALDI', 'REMAINING')}</span>
				</div>
				<div class="dp-scraper-quick-row">
					{quickTargets.map((target) => (
						<button
							type="button"
							onClick={() => handleTarget(target.url)}
							disabled={props.isLoading}
							class="dp-scraper-quick-button"
						>
							{target.label}
						</button>
					))}
				</div>
			</div>

			<Show when={error()}>
				<p class="dp-scraper-cli-error">{error()}</p>
			</Show>

			<section class="dp-scraper-advanced-box">
				<button
					type="button"
					onClick={() => setShowAdvanced(!showAdvanced())}
					class="dp-scraper-advanced-toggle"
				>
					<span>{t('SELECTOR_KATMANI', 'SELECTOR_OVERRIDE')}</span>
					<span>{showAdvanced() ? t('GİZLE', 'HIDE') : t('GÖSTER', 'SHOW')}</span>
				</button>
				<Show when={showAdvanced()}>
					<div class="dp-scraper-advanced-grid">
						<div class="dp-scraper-advanced-field">
							<label for="scraper-selector">{t('CSS Seçici', 'CSS Selector')}</label>
							<input
								id="scraper-selector"
								type="text"
								value={selector()}
								onInput={(e) => setSelector(e.currentTarget.value)}
								placeholder=".article, .product-card, table tr"
								class="dp-scraper-advanced-input"
								disabled={props.isLoading}
							/>
						</div>
						<label class="dp-scraper-toggle-card" for="scraper-auto-detect">
							<div>
								<strong>{t('Desen Algılama', 'Pattern Detection')}</strong>
								<p>{t('Ürün, makale, tablo ve liste bloklarını otomatik algılar.', 'Automatically detects product, article, table, and list blocks.')}</p>
							</div>
							<input
								id="scraper-auto-detect"
								type="checkbox"
								checked={autoDetect()}
								onChange={(e) => setAutoDetect(e.currentTarget.checked)}
								disabled={props.isLoading}
							/>
						</label>
					</div>
				</Show>
			</section>
		</section>
	);
}
