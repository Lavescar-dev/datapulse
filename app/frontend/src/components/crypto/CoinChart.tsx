// @ts-nocheck
import { createSignal, onMount, onCleanup, Show } from 'solid-js';
import { createChart, ColorType, type IChartApi, type ISeriesApi } from 'lightweight-charts';

type TimeRange = '1d' | '7d' | '30d';

interface CoinChartProps {
	coinId: string;
	coinName: string;
}

export default function CoinChart(props: CoinChartProps) {
	const [timeRange, setTimeRange] = createSignal<TimeRange>('7d');
	const [loading, setLoading] = createSignal(true);
	let chartContainer: HTMLDivElement | undefined;
	let chart: IChartApi | undefined;
	let series: ISeriesApi<'Area'> | undefined;

	const fetchChartData = async (range: TimeRange) => {
		setLoading(true);
		try {
			// For Phase 01, we'll use mock data since CoinGecko historical data requires premium API
			// In production, this would call: /api/crypto/history/${props.coinId}?range=${range}

			const mockData = generateMockData(range);
			updateChart(mockData);
		} catch (error) {
			console.error('Error fetching chart data:', error);
		} finally {
			setLoading(false);
		}
	};

	const generateMockData = (range: TimeRange) => {
		const days = range === '1d' ? 1 : range === '7d' ? 7 : 30;
		const points = days * 24; // Hourly data
		const data = [];
		const now = Date.now() / 1000;
		const basePrice = 50000 + Math.random() * 20000;

		for (let i = 0; i < points; i++) {
			const time = now - (points - i) * 3600;
			const randomWalk = (Math.random() - 0.5) * 2000;
			const price = basePrice + randomWalk;
			data.push({
				time: time as any,
				value: price,
			});
		}

		return data;
	};

	const updateChart = (data: any[]) => {
		if (!series || !chart) return;

		series.setData(data);
		chart.timeScale().fitContent();
	};

	onMount(() => {
		if (!chartContainer) return;

		chart = createChart(chartContainer, {
			layout: {
				background: { type: ColorType.Solid, color: '#111827' },
				textColor: '#9CA3AF',
			},
			grid: {
				vertLines: { color: '#1F2937' },
				horzLines: { color: '#1F2937' },
			},
			width: chartContainer.clientWidth,
			height: 400,
			timeScale: {
				borderColor: '#374151',
				timeVisible: true,
			},
			rightPriceScale: {
				borderColor: '#374151',
			},
		});

		series = chart.addAreaSeries({
			topColor: 'rgba(59, 130, 246, 0.4)',
			bottomColor: 'rgba(59, 130, 246, 0.0)',
			lineColor: 'rgba(59, 130, 246, 1)',
			lineWidth: 2,
		});

		// Handle window resize
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
			}
		});

		// Load initial data
		fetchChartData(timeRange());
	});

	const handleTimeRangeChange = (range: TimeRange) => {
		setTimeRange(range);
		fetchChartData(range);
	};

	return (
		<div class="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
			{/* Header */}
			<div class="p-4 border-b border-gray-800 flex items-center justify-between">
				<h3 class="text-lg font-semibold">{props.coinName} Fiyat Grafiği</h3>
				<div class="flex gap-2">
					<button
						class={`px-3 py-1 rounded text-sm font-medium transition-colors ${
							timeRange() === '1d'
								? 'bg-blue-600 text-white'
								: 'bg-gray-800 text-gray-400 hover:bg-gray-700'
						}`}
						onClick={() => handleTimeRangeChange('1d')}
					>
						1G
					</button>
					<button
						class={`px-3 py-1 rounded text-sm font-medium transition-colors ${
							timeRange() === '7d'
								? 'bg-blue-600 text-white'
								: 'bg-gray-800 text-gray-400 hover:bg-gray-700'
						}`}
						onClick={() => handleTimeRangeChange('7d')}
					>
						7G
					</button>
					<button
						class={`px-3 py-1 rounded text-sm font-medium transition-colors ${
							timeRange() === '30d'
								? 'bg-blue-600 text-white'
								: 'bg-gray-800 text-gray-400 hover:bg-gray-700'
						}`}
						onClick={() => handleTimeRangeChange('30d')}
					>
						30G
					</button>
				</div>
			</div>

			{/* Chart Container */}
			<div class="relative">
				<Show when={loading()}>
					<div class="absolute inset-0 flex items-center justify-center bg-gray-900/50 z-10">
						<div class="text-gray-400">Grafik yükleniyor...</div>
					</div>
				</Show>
				<div ref={chartContainer} />
			</div>

			{/* Footer Note */}
			<div class="p-3 bg-gray-800/50 border-t border-gray-800">
				<p class="text-xs text-gray-500 text-center">
					📝 Demo verisi kullanılmaktadır. Gerçek geçmiş veriler için premium API gereklidir.
				</p>
			</div>
		</div>
	);
}
