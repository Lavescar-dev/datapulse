import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import { createChart, ColorType, type IChartApi, type ISeriesApi } from 'lightweight-charts';
import type { Product, PriceStats } from '../../../../shared/types/price';
import { apiUrl } from '../../lib/api';
import { createLocaleSignal } from '../../lib/locale';

interface ProductCardProps {
	product: Product;
	isAdmin: boolean;
	onRemove?: (id: string) => void;
	onExport?: (id: string) => void;
}

export default function ProductCard(props: ProductCardProps) {
	const locale = createLocaleSignal();
	const t = (tr: string, en: string) => (locale() === 'en' ? en : tr);
	const [stats, setStats] = createSignal<PriceStats | null>(null);
	const [loading, setLoading] = createSignal(true);
	const [showChart, setShowChart] = createSignal(false);
	let chartContainer: HTMLDivElement | undefined;
	let chart: IChartApi | undefined;
	let series: ISeriesApi<'Line'> | undefined;

	const getMarketplaceIcon = (marketplace: string) => {
		switch (marketplace) {
			case 'trendyol':
				return '🛍️';
			case 'hepsiburada':
				return '🛒';
			case 'n11':
				return '📦';
			case 'amazon-tr':
				return '📦';
			default:
				return '🏪';
		}
	};

	const getMarketplaceName = (marketplace: string) => {
		switch (marketplace) {
			case 'trendyol':
				return 'Trendyol';
			case 'hepsiburada':
				return 'Hepsiburada';
			case 'n11':
				return 'N11';
			case 'amazon-tr':
				return 'Amazon TR';
			default:
				return marketplace;
		}
	};

	const formatPrice = (price: number, currency: string) => {
		return new Intl.NumberFormat('tr-TR', {
			style: 'currency',
			currency: currency === 'TRY' ? 'TRY' : 'USD',
		}).format(price);
	};

	const formatDate = (dateString: string) => {
		const date = new Date(dateString);
		return date.toLocaleDateString('tr-TR', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
		});
	};

	const isShowcaseFallback = () => props.product.source === 'showcase-fallback';

	const getProductLinkHref = () => {
		if (!isShowcaseFallback()) return props.product.url;

		const query = encodeURIComponent(props.product.name);

		switch (props.product.marketplace) {
			case 'trendyol':
				return `https://www.trendyol.com/sr?q=${query}`;
			case 'hepsiburada':
				return `https://www.hepsiburada.com/ara?q=${query}`;
			case 'n11':
				return `https://www.n11.com/arama?q=${query}`;
			case 'amazon-tr':
				return `https://www.amazon.com.tr/s?k=${query}`;
			default:
				return props.product.url;
		}
	};

	const getProductLinkText = () => {
		if (!isShowcaseFallback()) return props.product.url;
		return t(`${getMarketplaceName(props.product.marketplace)} içinde ara`, `Search within ${getMarketplaceName(props.product.marketplace)}`);
	};

	const fetchStats = async () => {
		setLoading(true);
		try {
			const response = await fetch(apiUrl(`/api/price/products/${props.product.id}/stats`), {
				credentials: 'include',
			});

			if (response.ok) {
				const data = await response.json();
				setStats(data.stats);
			}
		} catch (error) {
			console.error('Error fetching stats:', error);
		} finally {
			setLoading(false);
		}
	};

	const initChart = () => {
		if (!chartContainer || chart) return;

		chart = createChart(chartContainer, {
			layout: {
				background: { type: ColorType.Solid, color: '#0c0c0e' },
				textColor: '#71717a',
			},
			grid: {
				vertLines: { color: '#1f1f23' },
				horzLines: { color: '#1f1f23' },
			},
			width: chartContainer.clientWidth,
			height: 220,
			timeScale: {
				borderColor: '#27272a',
				timeVisible: true,
			},
			rightPriceScale: {
				borderColor: '#27272a',
			},
		});

		series = (chart as any).addLineSeries({
			color: 'rgba(59, 130, 246, 1)',
			lineWidth: 2,
		});

		const chartData = props.product.priceHistory.map((point) => ({
			time: Math.floor(new Date(point.timestamp).getTime() / 1000) as any,
			value: point.price,
		}));

		series?.setData(chartData);
		chart.timeScale().fitContent();

		const handleResize = () => {
			if (chart && chartContainer) {
				chart.applyOptions({ width: chartContainer.clientWidth });
			}
		};

		window.addEventListener('resize', handleResize);
		onCleanup(() => {
			window.removeEventListener('resize', handleResize);
			if (chart) {
				chart.remove();
				chart = undefined;
				series = undefined;
			}
		});
	};

	const toggleChart = () => {
		setShowChart(!showChart());
		if (!showChart() && chart) {
			chart.remove();
			chart = undefined;
			series = undefined;
		}
	};

	const getStatPrice = (kind: 'lowest' | 'highest' | 'average') => {
		const currentStats = stats();
		if (!currentStats) return formatPrice(props.product.currentPrice, props.product.currency);
		if (kind === 'lowest') return formatPrice(currentStats.lowestPrice, props.product.currency);
		if (kind === 'highest') return formatPrice(currentStats.highestPrice, props.product.currency);
		return formatPrice(currentStats.averagePrice, props.product.currency);
	};

	const getChangeLabel = () => {
		const currentStats = stats();
		if (!currentStats) return '0.00%';
		const prefix = currentStats.priceChangePercent > 0 ? '+' : '';
		return `${prefix}${currentStats.priceChangePercent.toFixed(2)}%`;
	};

	onMount(() => {
		fetchStats();
	});

	return (
		<div class="dp-price-product-card">
			<div class="dp-price-product-tags">
				<span class="dp-price-tag">{isShowcaseFallback() ? t('Demo Anlık Görüntü', 'Demo Snapshot') : t('Canlı Senkron', 'Live Sync')}</span>
				<span class={`dp-price-tag ${props.product.available ? 'is-success' : 'is-alert'}`}>
					{props.product.available ? t('Stokta', 'In stock') : t('Stok yok', 'Out of stock')}
				</span>
			</div>

			<div class="dp-price-product-title">{props.product.name}</div>
			<div class="dp-price-product-price">{formatPrice(props.product.currentPrice, props.product.currency)}</div>
			<div class="dp-price-product-date">SYNC: {formatDate(props.product.lastChecked)}</div>

			<Show when={props.product.sourceNote}>
				<div class="dp-price-product-note">{props.product.sourceNote}</div>
			</Show>

			<div class="dp-price-stat-grid">
				<div class="dp-price-stat-block">
					<span class="dp-price-stat-label">{t('En Düşük', 'Lowest')}</span>
					<span class="dp-price-stat-value">{getStatPrice('lowest')}</span>
				</div>
				<div class="dp-price-stat-block">
					<span class="dp-price-stat-label">{t('En Yüksek', 'Highest')}</span>
					<span class="dp-price-stat-value">{getStatPrice('highest')}</span>
				</div>
				<div class="dp-price-stat-block">
					<span class="dp-price-stat-label">{t('Ortalama', 'Average')}</span>
					<span class="dp-price-stat-value">{getStatPrice('average')}</span>
				</div>
				<div class="dp-price-stat-block">
					<span class="dp-price-stat-label">Degisim</span>
					<span
						class={`dp-price-stat-value ${
							stats() && stats()!.priceChangePercent > 0
								? 'is-danger'
								: stats() && stats()!.priceChangePercent < 0
								? 'is-success'
								: 'is-dim'
						}`}
					>
						{loading() ? '...' : getChangeLabel()}
					</span>
				</div>
			</div>

			<div class="dp-price-product-meta">
				<span>
					{getMarketplaceIcon(props.product.marketplace)} {getMarketplaceName(props.product.marketplace)}
				</span>
				<span>{props.product.priceHistory.length} samples</span>
			</div>

			<a
				href={getProductLinkHref()}
				target="_blank"
				rel="noopener noreferrer"
				class="dp-price-product-link"
				title={isShowcaseFallback() ? props.product.name : props.product.url}
			>
				<span>{isShowcaseFallback() ? '🔎' : '🔗'}</span>
				<span>{getProductLinkText()}</span>
			</a>

			<div class="dp-price-product-actions">
				<button onClick={toggleChart} class="dp-price-action-button" type="button">
					{showChart() ? t('GRAFİĞİ GİZLE', 'HIDE GRAPH') : t('GRAFİĞİ GÖSTER', 'SHOW GRAPH')}
				</button>
				<Show when={props.isAdmin}>
					<button onClick={() => props.onExport?.(props.product.id)} class="dp-price-action-button" type="button">
						EXPORT CSV
					</button>
					<button onClick={() => props.onRemove?.(props.product.id)} class="dp-price-action-button is-danger" type="button">
						REMOVE
					</button>
				</Show>
			</div>

			<Show when={showChart()}>
				<div class="dp-price-chart-panel">
					<div
						ref={(el) => {
							chartContainer = el;
							initChart();
						}}
					/>
				</div>
			</Show>
		</div>
	);
}
