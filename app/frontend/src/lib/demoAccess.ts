export const DEMO_ACCESS_ROUTE = '/demo-access';

const DEMO_ACCESS_STORAGE_KEY = 'datapulse:demo-access';
const DEMO_ACCESS_TTL_MS = 8 * 60 * 60 * 1000;

export interface DemoTarget {
	accent: string;
	accentRgb: string;
	descriptionEn: string;
	descriptionTr: string;
	href: string;
	icon: string;
	signalEn: string;
	signalTr: string;
	titleEn: string;
	titleTr: string;
}

export interface DemoAccessDraft {
	name: string;
	email: string;
	role: string;
	organization: string;
}

export interface DemoAccessSession extends DemoAccessDraft {
	accessId: string;
	startedAt: string;
}

interface BackendSessionStatus {
	active: boolean;
	isAdmin?: boolean;
	requestsRemaining?: number;
	timeRemaining?: number;
	scrapesRemaining?: number;
	seoAnalysesRemaining?: number;
}

export const demoTargets: DemoTarget[] = [
	{
		accent: '#00C2FF',
		accentRgb: '0, 194, 255',
		descriptionEn: 'Live price tracking for the top 100 crypto assets and BTC dominance.',
		descriptionTr: 'Top 100 kripto varlık, dominans ve piyasa kırılımlarını anlık izleyin.',
		href: '/dashboard',
		icon: 'bar-chart-2',
		signalEn: 'Crypto market intelligence',
		signalTr: 'Kripto piyasa istihbaratı',
		titleEn: 'Crypto Tracking',
		titleTr: 'Kripto Takip',
	},
	{
		accent: '#7B61FF',
		accentRgb: '123, 97, 255',
		descriptionEn: 'Collect financial news and run algorithmic sentiment analysis.',
		descriptionTr: 'Finans haber akışını toplayın, etki ve duygu analizini aynı anda görün.',
		href: '/news',
		icon: 'globe',
		signalEn: 'Editorial signal desk',
		signalTr: 'Editoryal sinyal masası',
		titleEn: 'News Aggregation',
		titleTr: 'Haber Toplama',
	},
	{
		accent: '#FF00D6',
		accentRgb: '255, 0, 214',
		descriptionEn: 'Discover trending Reddit and GitHub content in real time.',
		descriptionTr: 'Reddit ve GitHub trendlerini gerçek zamanlı takip edin.',
		href: '/social',
		icon: 'activity',
		signalEn: 'Community pulse tracking',
		signalTr: 'Topluluk nabzı takibi',
		titleEn: 'Social Media',
		titleTr: 'Sosyal Medya',
	},
	{
		accent: '#00C2FF',
		accentRgb: '0, 194, 255',
		descriptionEn: 'Collect products and content automatically with rule-based scraping.',
		descriptionTr: 'Kural bazlı tarama ile ürün ve içerikleri otomatik toplayın.',
		href: '/scraper',
		icon: 'code',
		signalEn: 'Structured collection engine',
		signalTr: 'Yapılandırılmış toplama motoru',
		titleEn: 'Web Scraper',
		titleTr: 'Web Scraper',
	},
	{
		accent: '#7B61FF',
		accentRgb: '123, 97, 255',
		descriptionEn: 'Track site performance and mobile friendliness scores.',
		descriptionTr: 'Site performansı, görünürlük ve mobil uyumluluk skorlarını izleyin.',
		href: '/seo',
		icon: 'search',
		signalEn: 'Visibility scoring',
		signalTr: 'Görünürlük skorlaması',
		titleEn: 'SEO Analysis',
		titleTr: 'SEO Analiz',
	},
	{
		accent: '#FF00D6',
		accentRgb: '255, 0, 214',
		descriptionEn: 'Amazon TR and local marketplace price history with alerts.',
		descriptionTr: 'Pazar yeri fiyat geçmişini ve alarm kurallarını tek akışta izleyin.',
		href: '/price-tracker',
		icon: 'shopping-cart',
		signalEn: 'Marketplace price monitor',
		signalTr: 'Pazar yeri fiyat monitörü',
		titleEn: 'Price Tracking',
		titleTr: 'Fiyat Takip',
	},
	{
		accent: '#00C2FF',
		accentRgb: '0, 194, 255',
		descriptionEn: 'Monitor API uptime and critical system health checks.',
		descriptionTr: 'API sağlığını, uptime ve kritik servis kontrolünü anlık izleyin.',
		href: '/api-monitor',
		icon: 'server',
		signalEn: 'Service health watch',
		signalTr: 'Servis sağlık izleme',
		titleEn: 'API Monitoring',
		titleTr: 'API İzleme',
	},
	{
		accent: '#7B61FF',
		accentRgb: '123, 97, 255',
		descriptionEn: 'Build fully customizable widget grids for your own dashboards.',
		descriptionTr: 'Kendi operasyon panellerinizi özelleştirilebilir widget bloklarıyla kurun.',
		href: '/dashboard-builder',
		icon: 'layout-dashboard',
		signalEn: 'Composable operations workspace',
		signalTr: 'Bileşen tabanlı operasyon alanı',
		titleEn: 'Dashboard Builder',
		titleTr: 'Dashboard Builder',
	},
];

function hasWindow() {
	return typeof window !== 'undefined';
}

function parseJsonResponse(text: string) {
	if (!text.trim()) {
		return null;
	}

	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}

function apiUrl(path: string, publicApiBaseUrl = '') {
	return publicApiBaseUrl ? new URL(path, publicApiBaseUrl).toString() : path;
}

export function createDemoAccessSession(draft: DemoAccessDraft): DemoAccessSession {
	return {
		accessId: `dp-demo-${Math.random().toString(36).slice(2, 10)}`,
		name: draft.name.trim(),
		email: draft.email.trim(),
		role: draft.role.trim(),
		organization: draft.organization.trim(),
		startedAt: new Date().toISOString(),
	};
}

export function readDemoAccessSession(): DemoAccessSession | null {
	if (!hasWindow()) {
		return null;
	}

	try {
		const raw = window.sessionStorage.getItem(DEMO_ACCESS_STORAGE_KEY);
		if (!raw) {
			return null;
		}

		const parsed = JSON.parse(raw) as Partial<DemoAccessSession>;
		if (
			typeof parsed !== 'object' ||
			typeof parsed?.accessId !== 'string' ||
			typeof parsed?.name !== 'string' ||
			typeof parsed?.email !== 'string' ||
			typeof parsed?.role !== 'string' ||
			typeof parsed?.organization !== 'string' ||
			typeof parsed?.startedAt !== 'string'
		) {
			window.sessionStorage.removeItem(DEMO_ACCESS_STORAGE_KEY);
			return null;
		}

		const startedAt = new Date(parsed.startedAt);
		if (Number.isNaN(startedAt.getTime()) || Date.now() - startedAt.getTime() > DEMO_ACCESS_TTL_MS) {
			window.sessionStorage.removeItem(DEMO_ACCESS_STORAGE_KEY);
			return null;
		}

		return parsed as DemoAccessSession;
	} catch {
		window.sessionStorage.removeItem(DEMO_ACCESS_STORAGE_KEY);
		return null;
	}
}

export function writeDemoAccessSession(session: DemoAccessSession) {
	if (!hasWindow()) {
		return;
	}

	window.sessionStorage.setItem(DEMO_ACCESS_STORAGE_KEY, JSON.stringify(session));
}

export function clearDemoAccessSession() {
	if (!hasWindow()) {
		return;
	}

	window.sessionStorage.removeItem(DEMO_ACCESS_STORAGE_KEY);
}

export function buildDemoAccessHref(targetPath: string) {
	const params = new URLSearchParams();
	params.set('next', targetPath || '/dashboard');
	return `${DEMO_ACCESS_ROUTE}?${params.toString()}`;
}

export function getDemoTarget(targetPath: string) {
	const normalizedTarget = normalizeTargetPath(targetPath);
	return demoTargets.find((target) => target.href === normalizedTarget) ?? demoTargets[0];
}

export function getRequestedTarget(search: string, fallback = '/dashboard') {
	const params = new URLSearchParams(search);
	const next = params.get('next');

	if (!next || !next.startsWith('/') || next === DEMO_ACCESS_ROUTE) {
		return fallback;
	}

	return next;
}

export function getCurrentTargetPath() {
	if (!hasWindow()) {
		return '/dashboard';
	}

	return normalizeTargetPath(`${window.location.pathname}${window.location.search}`);
}

export function redirectToDemoAccess(targetPath: string, replace = true) {
	if (!hasWindow()) {
		return;
	}

	const href = buildDemoAccessHref(targetPath);
	if (replace) {
		window.location.replace(href);
		return;
	}

	window.location.href = href;
}

export async function startBackendDemoSession(publicApiBaseUrl = '') {
	const response = await fetch(apiUrl('/api/session/start', publicApiBaseUrl), {
		method: 'POST',
		credentials: 'include',
	});
	const text = await response.text();
	const data = parseJsonResponse(text) as { success?: boolean; error?: string } | null;

	if (!response.ok || !data?.success) {
		throw new Error(data?.error || 'Demo oturumu başlatılamadı.');
	}

	return data;
}

export async function fetchBackendSessionStatus(publicApiBaseUrl = '') {
	const response = await fetch(apiUrl('/api/session/status', publicApiBaseUrl), {
		credentials: 'include',
	});
	const text = await response.text();
	const data = parseJsonResponse(text) as BackendSessionStatus | null;
	return response.ok ? data : null;
}

function normalizeTargetPath(targetPath: string) {
	if (!targetPath) {
		return '/dashboard';
	}

	try {
		const url = new URL(targetPath, 'https://datapulse.local');
		return url.pathname || '/dashboard';
	} catch {
		return targetPath.split('?')[0] || '/dashboard';
	}
}
