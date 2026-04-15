import { For, Show, createResource, createSignal } from 'solid-js';
import { apiUrl } from '../../lib/api';
import { createLocaleSignal } from '../../lib/locale';

interface ShowcaseExample {
	id: string;
	url: string;
	title: string;
	description: string;
	pattern: string;
	itemCount: number;
}

interface ShowcaseGalleryProps {
	onSelectExample: (exampleId: string) => void;
	compact?: boolean;
}

export default function ShowcaseGallery(props: ShowcaseGalleryProps) {
	const locale = createLocaleSignal();
	const t = (tr: string, en: string) => (locale() === 'en' ? en : tr);
	const [selectedExample, setSelectedExample] = createSignal<string | null>(null);

	const [examples] = createResource(async () => {
		const response = await fetch(apiUrl('/api/scraper/examples'));
		if (!response.ok) {
			throw new Error(t('Gösterim örnekleri alınamadı', 'Failed to fetch showcase examples'));
		}
		const data = await response.json();
		return data.examples as ShowcaseExample[];
	});

	const handleSelectExample = (exampleId: string) => {
		setSelectedExample(exampleId);
		props.onSelectExample(exampleId);
	};

	const getPatternIcon = (pattern: string) => {
		switch (pattern) {
			case 'products':
				return '🛍️';
			case 'articles':
				return '📰';
			case 'table-rows':
				return '📊';
			case 'list-items':
				return '📋';
			default:
				return '📄';
		}
	};

	const getPatternLabel = (pattern: string) => {
		switch (pattern) {
			case 'products':
				return t('Desen: Ürünler', 'Pattern: Products');
			case 'articles':
				return t('Desen: Makaleler', 'Pattern: Articles');
			case 'table-rows':
				return t('Desen: Tablo', 'Pattern: Table');
			case 'list-items':
				return t('Desen: Liste', 'Pattern: List');
			default:
				return `${t('Desen', 'Pattern')}: ${pattern}`;
		}
	};

	return (
		<div>
			<h2 class="dp-scraper-section-title">{t('DATASET_SHOWCASE // KAYDEDİLMİŞ PARİTE ÖRNEKLERİ', 'DATASET_SHOWCASE // CACHED PARITY SAMPLES')}</h2>
			<p class="dp-scraper-section-copy">
				{t('Canlı scrape döngüsünü beklemeden referans sonuç hiyerarşisini test etmek için bellekte tutulan önceden kazınmış örnekler.', 'Pre-scraped examples kept in memory to test the result hierarchy without waiting for a live scrape cycle.')}
			</p>

			<Show when={examples.loading}>
				<div class="dp-scraper-empty-box">{t('Örnekler yükleniyor...', 'Examples are loading...')}</div>
			</Show>

			<Show when={examples.error}>
				<div class="dp-scraper-empty-box tone-error">{t('Hata', 'Error')}: {examples.error.message}</div>
			</Show>

			<Show when={!examples.loading && !examples.error}>
				<div class="dp-scraper-dataset-list">
					<For each={examples()}>
						{(example) => (
							<button
								type="button"
								onClick={() => handleSelectExample(example.id)}
								class={`dp-scraper-dataset-card ${selectedExample() === example.id ? 'is-active' : ''}`}
							>
								<div class="dp-scraper-dataset-head">
									<div>
										<div class="dp-scraper-dataset-title">{example.title}</div>
										<div class="dp-scraper-dataset-desc">{example.description}</div>
									</div>
									<div class="dp-scraper-dataset-icon">{getPatternIcon(example.pattern)}</div>
								</div>
								<div class="dp-scraper-dataset-meta">
									<span class="dp-scraper-dataset-tag">{getPatternLabel(example.pattern)}</span>
									<span class="dp-scraper-dataset-tag">Rows: {example.itemCount}</span>
									<span class="dp-scraper-dataset-tag tone-accent">{t('Kaynak: Önbellek', 'Source: Cached')}</span>
								</div>
							</button>
						)}
					</For>
				</div>
			</Show>
		</div>
	);
}
