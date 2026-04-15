import { Show, createSignal } from 'solid-js';
import { createLocaleSignal } from '../../lib/locale';

interface AnalyzeFormProps {
	onSubmit: (url: string) => void;
	isLoading: boolean;
	analysesRemaining: number;
	lastSubmittedUrl?: string;
}

export default function AnalyzeForm(props: AnalyzeFormProps) {
	const locale = createLocaleSignal();
	const t = (tr: string, en: string) => (locale() === 'en' ? en : tr);
	const [url, setUrl] = createSignal(props.lastSubmittedUrl || '');
	const [error, setError] = createSignal('');

	const normalizeUrl = (input: string): string => {
		const trimmedInput = input.trim();

		if (!trimmedInput) {
			return '';
		}

		return /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(trimmedInput)
			? trimmedInput
			: `https://${trimmedInput}`;
	};

	const validateUrl = (input: string): boolean => {
		try {
			const urlObj = new URL(input);
			return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
		} catch {
			return false;
		}
	};

	const handleSubmit = (e: Event) => {
		e.preventDefault();
		setError('');

		const trimmedUrl = url().trim();
		const normalizedUrl = normalizeUrl(trimmedUrl);

		if (!trimmedUrl) {
			setError(t('Analiz için bir URL girin.', 'Please enter a URL for analysis.'));
			return;
		}

		if (!validateUrl(normalizedUrl)) {
			setError(t('Geçerli bir URL girin. Örnek: https://example.com', 'Enter a valid URL. Example: https://example.com'));
			return;
		}

		if (props.analysesRemaining <= 0) {
			setError(t('Demo audit limitinize ulaştınız.', 'You have reached your demo audit limit.'));
			return;
		}

		setUrl(normalizedUrl);
		props.onSubmit(normalizedUrl);
	};

	return (
		<section class="dp-seo-command-shell">
			<form onSubmit={handleSubmit} class="dp-seo-command-bar" aria-label={t('SEO tarama komut çubuğu', 'SEO scan command bar')}>
				<span class="dp-seo-command-prompt">~ / scan --url</span>
				<input
					id="seo-url-input"
					type="text"
					value={url()}
					onInput={(e) => setUrl(e.currentTarget.value)}
					placeholder="https://example.com"
					class="dp-seo-command-input"
					disabled={props.isLoading}
				/>
				<button
					type="submit"
					disabled={props.isLoading || props.analysesRemaining <= 0}
					class="dp-seo-command-button"
				>
					{props.isLoading ? t('ÇALIŞIYOR', 'RUNNING') : t('HAZIR', 'READY')}
				</button>
			</form>

			<div class="dp-seo-command-footer">
				<div class="dp-seo-command-meta">
					<span>{t('Hak', 'Quota')}: {props.analysesRemaining}</span>
					<Show when={props.lastSubmittedUrl}>
							<span>{t('Son URL', 'Last URL')}: {props.lastSubmittedUrl}</span>
					</Show>
				</div>
				<Show when={error()}>
					<p class="dp-seo-command-error">{error()}</p>
				</Show>
			</div>
		</section>
	);
}
