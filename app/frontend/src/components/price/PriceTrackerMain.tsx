import { createSignal, createResource, Show, For } from 'solid-js';
import ProductCard from './ProductCard';
import AddProduct from './AddProduct';
import type { Product } from '../../../../shared/types/price';
import { apiFetch, apiJson, ApiError } from '../../lib/api';
import { createLocaleSignal } from '../../lib/locale';

export default function PriceTrackerMain() {
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

	const [productsData] = createResource(
		() => refreshTrigger(),
		async () => {
			try {
				setLoadError(null);
				const data = await apiJson<{ products: Product[]; count: number }>('/api/price/products', {
					requireSession: true,
				});
				return data;
			} catch (error) {
				console.error('Error fetching products:', error);
				setLoadError(error instanceof Error ? error.message : t('Ürünler yüklenemedi', 'Products could not be loaded'));
				return { products: [] as Product[], count: 0 };
			}
		}
	);

	const handleProductAdded = () => {
		setRefreshTrigger((prev) => prev + 1);
	};

	const handleRemoveProduct = async (id: string) => {
		if (!confirm('Bu ürünü takipten kaldırmak istediğinize emin misiniz?')) {
			return;
		}

		try {
			const response = await apiFetch(`/api/price/products/${id}`, {
				method: 'DELETE',
				requireSession: true,
			});

			await response.json();
			setRefreshTrigger((prev) => prev + 1);
		} catch (error) {
			alert(error instanceof Error ? error.message : 'Ürün silinirken bir hata oluştu');
			console.error('Error removing product:', error);
		}
	};

	const handleExportProduct = async (id: string) => {
		try {
			const response = await apiFetch(`/api/price/export/${id}`, {
				requireSession: true,
			});

			const csv = await response.text();
			const blob = new Blob([csv], { type: 'text/csv' });
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `price_history_${id}.csv`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			window.URL.revokeObjectURL(url);
		} catch (error) {
			alert(error instanceof Error ? error.message : 'CSV export hatası');
			console.error('Error exporting product:', error);
		}
	};

	const getProducts = (): Product[] => (productsData()?.products || []) as Product[];

	const getProductsByMarketplace = (marketplace: string) => {
		return getProducts().filter((product) => product.marketplace === marketplace);
	};

	const getAllMarketplaces = () => {
		const products = getProducts();
		const marketplaces = new Set(products.map((product) => product.marketplace));
		return Array.from(marketplaces) as string[];
	};

	const getSortedMarketplaces = () => {
		const order = ['trendyol', 'hepsiburada', 'n11', 'amazon-tr'];
		return getAllMarketplaces().sort((a, b) => order.indexOf(a) - order.indexOf(b));
	};

	const getMarketplaceLabel = (marketplace: string) => {
		switch (marketplace) {
			case 'trendyol':
				return 'TRENDYOL';
			case 'hepsiburada':
				return 'HEPSIBURADA';
			case 'n11':
				return 'N11';
			case 'amazon-tr':
				return 'AMAZON_TR';
			default:
				return marketplace.toUpperCase();
		}
	};

	const getShowcaseFallbackCount = () => {
		return getProducts().filter((product) => product.source === 'showcase-fallback').length;
	};

	return (
		<div class="dp-price-shell">
			<div class="dp-price-cli">
				<span class="dp-price-cli-prompt">$ tracker.init() --mode</span>
				<input type="text" value={`showcase --limit ${productsData()?.count || 15}`} readOnly />
			</div>

			<div class="dp-price-telemetry-grid">
				<div class="dp-price-telemetry-card">
					<span class={`dp-price-telemetry-value ${getShowcaseFallbackCount() > 0 ? 'is-warning' : 'is-success'}`}>
						{getShowcaseFallbackCount() > 0 ? t('Offline Snapshot', 'Offline Snapshot') : t('Canlı Senkron', 'Live Sync')}
					</span>
					<span class="dp-price-telemetry-label">{t('Daemon Durumu', 'Daemon Status')}</span>
				</div>
				<div class="dp-price-telemetry-card">
					<span class="dp-price-telemetry-value">{productsData()?.count || 0} {t('Node', 'Nodes')}</span>
					<span class="dp-price-telemetry-label">{t('Takip Edilen Varlıklar', 'Tracked Assets')}</span>
				</div>
				<div class="dp-price-telemetry-card">
					<span class="dp-price-telemetry-value">6h {t('Aralık', 'Interval')}</span>
					<span class="dp-price-telemetry-label">{t('Güncelleme Döngüsü', 'Update Cycle')}</span>
				</div>
				<div class="dp-price-telemetry-card">
					<span class={`dp-price-telemetry-value ${isAdmin() ? 'is-accent' : 'is-success'}`}>
						{isAdmin() ? t('Root Aktif', 'Root Active') : t('Aktif', 'Active')}
					</span>
					<span class="dp-price-telemetry-label">{t('Uyarı Servisi', 'Alert Service')}</span>
				</div>
			</div>

			<div class="dp-price-system-alert">
				<div class="dp-price-alert-icon">[!]</div>
				<div class="dp-price-alert-body">
					<h4>{t('Canlı Tarama Zaman Aşımı // Fallback Aktif', 'Live Scrape Timeout // Fallback Activated')}</h4>
					<p>
						{getShowcaseFallbackCount() > 0
							? t(
								`${getShowcaseFallbackCount()} ürün demo ortamına özel memory-cached showcase snapshot ile gösteriliyor. Root izinleriyle yeni node injection, CSV export ve canlı scrape retry aksiyonları aktif kalır.`,
								`${getShowcaseFallbackCount()} products are being shown from a demo-specific memory-cached showcase snapshot. With root permissions, node injection, CSV export, and live scrape retry actions remain available.`,
							)
							: t(
								'Canlı fiyat akışı ayakta. Showcase parity korunuyor; admin oturumları manual injection, export ve node temizleme operasyonlarını açabilir.',
								'The live pricing flow is healthy. Showcase parity is preserved; admin sessions can unlock manual injection, export, and node cleanup operations.',
							)}
					</p>
				</div>
			</div>

			<Show when={isAdmin()}>
				<AddProduct onProductAdded={handleProductAdded} />
			</Show>

			<Show when={productsData.loading}>
				<div class="dp-price-loading-panel">
					<div class="dp-price-spinner" />
					<p>{t('Tracker node listesi yükleniyor...', 'Tracker node list is loading...')}</p>
				</div>
			</Show>

			<Show when={!productsData.loading}>
				<Show
					when={!loadError() && productsData()?.products.length > 0}
					fallback={
						loadError() ? (
							<div class="dp-price-empty">
								<div class="dp-price-empty-icon">[!]</div>
								<h3>{t('Fiyat akışına erişilemedi', 'Pricing flow could not be reached')}</h3>
								<p>{loadError()}</p>
							</div>
						) : (
							<div class="dp-price-empty">
								<div class="dp-price-empty-icon">[0]</div>
								<h3>{t('Takip listesi henüz hazır değil', 'The watchlist is not ready yet')}</h3>
								<p>
									{isAdmin()
										? t('Yukarıdaki formu kullanarak ürün ekleyebilir veya startup showcase seedinin tamamlanmasını bekleyebilirsiniz.', 'You can use the form above to add a product or wait for the startup showcase seed to finish.')
										: t('Showcase ürünleri backend açılışında yüklenir. Canlı scrape tamamlanamazsa sistem demo snapshot ile devam eder; bu durumda liste kısa bir süre boş kalabilir.', 'Showcase products are seeded during backend startup. If live scraping cannot complete, the system continues with a demo snapshot; the list may stay empty for a short while.')}
								</p>
							</div>
						)
					}
				>
					<For each={getSortedMarketplaces()}>
						{(marketplace) => {
							const marketplaceProducts = getProductsByMarketplace(marketplace);
							if (marketplaceProducts.length === 0) return null;

							return (
								<section class="dp-price-node">
									<div class="dp-price-node-header">
										<span>&gt; PLATFORM: {getMarketplaceLabel(marketplace)}</span>
										<span class="meta">[{marketplaceProducts.length} Nodes Active]</span>
									</div>
									<div class="dp-price-product-grid">
										<For each={marketplaceProducts}>
											{(product) => (
												<ProductCard
													product={product}
													isAdmin={isAdmin()}
													onRemove={handleRemoveProduct}
													onExport={handleExportProduct}
												/>
											)}
										</For>
									</div>
								</section>
							);
						}}
					</For>
				</Show>
			</Show>

			<div class="dp-price-doc-layout">
				<div>
					<h2 class="dp-price-section-title">{t('SYSTEM_MANUAL // NASIL ÇALIŞIR?', 'SYSTEM_MANUAL // HOW IT WORKS')}</h2>
					<div class="dp-price-feature-list">
						<div class="dp-price-feature-item">
							<div class="dp-price-feature-icon">[!]</div>
							<div class="dp-price-feature-body">
								<h4>{t('Otomatize Pipeline', 'Automated Pipeline')}</h4>
								<p>Trendyol, Hepsiburada, N11 ve Amazon TR node'ları her 6 saatte bir taranır; fiyat, stok ve link sinyalleri aynı panelde toplanır.</p>
							</div>
						</div>
						<div class="dp-price-feature-item">
							<div class="dp-price-feature-icon">[#]</div>
							<div class="dp-price-feature-body">
								<h4>{t('Admin Ayrıcalıkları', 'Admin Privileges')}</h4>
								<p>Root/Admin seviyesinde yeni ürün injection, CSV export, ürün silme ve canlı retry operasyonları açık tutulur.</p>
							</div>
						</div>
						<div class="dp-price-feature-item">
							<div class="dp-price-feature-icon">[~]</div>
							<div class="dp-price-feature-body">
								<h4>{t('Demo Konfigürasyonu', 'Demo Configuration')}</h4>
								<p>{productsData()?.count || 15} popüler ürün showcase snapshot olarak tutulur; böylece network gecikmesi olmadan arayüz ve parity testi yapılabilir.</p>
							</div>
						</div>
					</div>
				</div>

				<div>
					<h2 class="dp-price-section-title">{t('CORE_FEATURES // MODÜLLER', 'CORE_FEATURES // MODULES')}</h2>
					<div class="dp-price-feature-list">
						<div class="dp-price-feature-item">
							<div class="dp-price-feature-icon">[=]</div>
							<div class="dp-price-feature-body">
								<h4>{t('Fiyat Grafikleri', 'Price Charts')}</h4>
								<p>Zaman serisi üzerinden düşüş, yükseliş ve ortalama sapmalarını kart içinden açılan grafik paneliyle izleyin.</p>
							</div>
						</div>
						<div class="dp-price-feature-item">
							<div class="dp-price-feature-icon">[@]</div>
							<div class="dp-price-feature-body">
								<h4>{t('Platform Ayrışma', 'Platform Separation')}</h4>
								<p>Pazar yeri bazlı node blokları ile fiyat davranışını Trendyol, Hepsiburada, N11 ve Amazon TR arasında hızla karşılaştırın.</p>
							</div>
						</div>
						<div class="dp-price-feature-item">
							<div class="dp-price-feature-icon">[&gt;]</div>
							<div class="dp-price-feature-body">
								<h4>{t('CSV Export + Alert Ready', 'CSV Export + Alert Ready')}</h4>
								<p>Admin oturumları ham fiyat geçmişini dışarı alabilir; alert servisi aktif olduğunda hedef fiyat akışları aynı node mantığıyla genişler.</p>
							</div>
						</div>
					</div>
				</div>
			</div>

			<footer class="dp-price-footer">DP // DATAPULSE TRACKER ENGINE v2.0.4 - AUTH: ROOT - ISOLATED DAEMON</footer>
		</div>
	);
}
