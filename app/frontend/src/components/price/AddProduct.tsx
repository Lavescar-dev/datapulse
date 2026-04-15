import { createSignal, Show } from 'solid-js';
import { apiUrl } from '../../lib/api';
import { createLocaleSignal } from '../../lib/locale';

interface AddProductProps {
	onProductAdded: () => void;
}

export default function AddProduct(props: AddProductProps) {
	const locale = createLocaleSignal();
	const t = (tr: string, en: string) => (locale() === 'en' ? en : tr);
	const [url, setUrl] = createSignal('');
	const [loading, setLoading] = createSignal(false);
	const [error, setError] = createSignal<string | null>(null);
	const [success, setSuccess] = createSignal<string | null>(null);

	const handleSubmit = async (e: Event) => {
		e.preventDefault();
		setError(null);
		setSuccess(null);

		const urlValue = url().trim();

		if (!urlValue) {
			setError(t('Lütfen bir URL girin', 'Please enter a URL'));
			return;
		}

		try {
			new URL(urlValue);
		} catch {
			setError(t('Geçersiz URL formatı', 'Invalid URL format'));
			return;
		}

		const supportedMarketplaces = ['trendyol.com', 'hepsiburada.com', 'n11.com', 'amazon.com.tr'];
		const isSupported = supportedMarketplaces.some((marketplace) => urlValue.includes(marketplace));

		if (!isSupported) {
			setError(t('Desteklenmeyen marketplace. Sadece Trendyol, Hepsiburada, N11 ve Amazon TR destekleniyor.', 'Unsupported marketplace. Only Trendyol, Hepsiburada, N11, and Amazon TR are supported.'));
			return;
		}

		setLoading(true);

		try {
			const response = await fetch(apiUrl('/api/price/products'), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify({ url: urlValue }),
			});

			if (!response.ok) {
				const data = await response.json();
				throw new Error(data.message || t('Ürün eklenemedi', 'Product could not be added'));
			}

			const data = await response.json();
			setSuccess(`✓ ${data.product.name} ${t('başarıyla eklendi!', 'added successfully!')}`);
			setUrl('');
			props.onProductAdded();

			setTimeout(() => {
				setSuccess(null);
			}, 3000);
		} catch (err) {
			setError(err instanceof Error ? err.message : t('Bilinmeyen bir hata oluştu', 'An unknown error occurred'));
		} finally {
			setLoading(false);
		}
	};

	const exampleUrls = [
		{
			marketplace: 'Trendyol',
			url: 'https://www.trendyol.com/apple/iphone-15-pro-max-256-gb-p-123456',
		},
		{
			marketplace: 'Hepsiburada',
			url: 'https://www.hepsiburada.com/samsung-galaxy-s24-ultra-256-gb-p-123456',
		},
		{
			marketplace: 'N11',
			url: 'https://www.n11.com/urun/xiaomi-redmi-note-13-pro-256-gb-123456',
		},
		{
			marketplace: 'Amazon TR',
			url: 'https://www.amazon.com.tr/Sony-WH-1000XM5-Kulaklik/dp/B123456',
		},
	];

	return (
		<div class="dp-price-admin-panel">
			<div class="dp-price-admin-title">ROOT_INJECTOR // {t('YENİ ÜRÜN EKLE', 'ADD NEW PRODUCT')}</div>

			<form onSubmit={handleSubmit} class="dp-price-admin-form">
				<div class="dp-price-admin-cli">
					<span>$ tracker.inject() --url</span>
					<input
						id="product-url"
						type="text"
						value={url()}
						onInput={(e) => setUrl(e.currentTarget.value)}
						placeholder="https://www.trendyol.com/urun/..."
						disabled={loading()}
					/>
					<button type="submit" disabled={loading() || !url().trim()}>
						{loading() ? t('ÇALIŞIYOR', 'RUNNING') : t('ENJEKTE ET', 'INJECT')}
					</button>
				</div>

				<Show when={error()}>
				<div class="dp-price-inline-alert is-danger">[x] {error()}</div>
				</Show>

				<Show when={success()}>
					<div class="dp-price-inline-alert is-success">{success()}</div>
				</Show>
			</form>

			<div class="dp-price-admin-grid">
				<div class="dp-price-admin-block">
					<h4>{t('DESTEKLENEN PAZARLAR', 'SUPPORTED_MARKETS')}</h4>
					<div class="dp-price-admin-market-grid">
						<div>🛍️ Trendyol</div>
						<div>🛒 Hepsiburada</div>
						<div>📦 N11</div>
						<div>📦 Amazon TR</div>
					</div>
				</div>

				<div class="dp-price-admin-block">
					<h4>{t('ÖRNEK URL’LER', 'EXAMPLE_URLS')}</h4>
					<div class="dp-price-admin-examples">
						{exampleUrls.map((example) => (
							<div>{example.marketplace}: {example.url}</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
