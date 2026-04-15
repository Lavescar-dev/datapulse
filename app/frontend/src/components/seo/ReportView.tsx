import { For, Show, createMemo, createSignal } from 'solid-js';
import { createLocaleSignal } from '../../lib/locale';
import type {
	AssetBreakdown,
	MetaTags,
	PerformanceScore,
	RenderingRisk,
	SEOCategory,
	SEOCategoryScore,
	SEOFinding,
	SEORecommendation,
	SEOReport,
	SERPPreview,
} from '../../../../shared/types/jobs';

interface ReportViewProps {
	report: SEOReport | null;
	error?: string;
	analyzedAt?: number;
	analyzedUrl?: string;
}

type ReportTab = 'overview' | 'opportunities' | 'diagnostics' | 'passed';

interface PassedAuditItem {
	id: string;
	category: SEOCategory;
	title: string;
	detail: string;
}

const CATEGORY_ORDER: SEOCategory[] = ['on-page', 'technical', 'performance', 'usability', 'social', 'links'];

const CATEGORY_META: Record<SEOCategory, { label: string; tone: string }> = {
	'on-page': { label: 'Sayfa İçi', tone: 'amber' },
	technical: { label: 'Teknik', tone: 'cyan' },
	performance: { label: 'Performans', tone: 'emerald' },
	usability: { label: 'Kullanılabilirlik', tone: 'slate' },
	social: { label: 'Sosyal', tone: 'cyan' },
	links: { label: 'Bağlantılar', tone: 'amber' },
};

const TAB_META: Record<ReportTab, { label: string; description: string }> = {
	overview: { label: 'Genel Bakış', description: 'Özet görünüm' },
	opportunities: { label: 'Fırsatlar', description: 'Öncelikli iyileştirmeler' },
	diagnostics: { label: 'Tanılar', description: 'Ayrıntılı bulgular' },
	passed: { label: 'Geçen kontroller', description: 'Olumlu sinyaller' },
};

interface DerivedSummary {
	headline: string;
	strongestCategories: SEOCategory[];
	weakestCategories: SEOCategory[];
	recommendationCount: number;
}

interface DerivedSocialPresence {
	openGraph: boolean;
	twitterCard: boolean;
	hasPreviewImage: boolean;
	completenessScore: number;
	missing: string[];
}

interface PriorityLaneItem {
	id: string;
	kind: 'recommendation' | 'finding';
	category: SEOCategory;
	level: 'high' | 'medium' | 'low' | 'info';
	label: string;
	title: string;
	body: string;
	evidence: string[];
	scoreImpact?: number;
	weight: number;
}

type ScoreTone = 'good' | 'average' | 'poor';

function clampScore(score?: number) {
	return Math.max(0, Math.min(100, Math.round(score ?? 0)));
}

function formatDate(date?: string | number) {
	if (!date) return 'Bilinmiyor';
	try {
		return new Date(date).toLocaleString('tr-TR', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	} catch {
		return String(date);
	}
}

function formatNumber(value?: number) {
	if (value === undefined || value === null || Number.isNaN(value)) return '-';
	return new Intl.NumberFormat('tr-TR').format(value);
}

function formatBytes(value?: number) {
	if (!value || value <= 0) return '-';
	const units = ['B', 'KB', 'MB', 'GB'];
	let size = value;
	let unitIndex = 0;
	while (size >= 1024 && unitIndex < units.length - 1) {
		size /= 1024;
		unitIndex += 1;
	}
	return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatMs(value?: number) {
	if (!value && value !== 0) return '-';
	return value >= 1000 ? `${(value / 1000).toFixed(2)} sn` : `${Math.round(value)} ms`;
}

function safeDomain(input?: string) {
	if (!input) return '-';
	try {
		return new URL(input).hostname;
	} catch {
		return input;
	}
}

function getScoreStatus(score?: number) {
	const value = clampScore(score);
	if (value >= 90) return { label: 'Mükemmel', tone: 'good' };
	if (value >= 70) return { label: 'İyi', tone: 'good' };
	if (value >= 50) return { label: 'Geliştirilmeli', tone: 'warn' };
	return { label: 'Zayıf', tone: 'bad' };
}

function getGaugeTone(score?: number): ScoreTone {
	const value = clampScore(score);
	if (value >= 90) return 'good';
	if (value >= 50) return 'average';
	return 'poor';
}

function getStatusLabel(status?: SEOCategoryScore['status']) {
	switch (status) {
		case 'good':
			return 'İyi';
		case 'needs-attention':
			return 'Geliştirilmeli';
		case 'poor':
			return 'Zayıf';
		default:
			return 'Sınırlı veri';
	}
}

function getRecommendationTone(priority?: SEORecommendation['priority']) {
	if (priority === 'high') return 'high';
	if (priority === 'medium') return 'medium';
	return 'low';
}

function getFindingTone(severity?: SEOFinding['severity']) {
	if (severity === 'high') return 'high';
	if (severity === 'medium') return 'medium';
	if (severity === 'low') return 'low';
	return 'info';
}

function metricBarWidth(value: number, total: number) {
	if (!total) return '0%';
	return `${Math.max(6, Math.min(100, Math.round((value / total) * 100)))}%`;
}

function buildCategoryScore(score: number, reasons: string[], availableSignals: number, totalSignals: number): SEOCategoryScore {
	const normalized = clampScore(score);
	return {
		score: normalized,
		status: normalized >= 75 ? 'good' : normalized >= 50 ? 'needs-attention' : 'poor',
		reasons: reasons.length ? reasons : ['Bu kategori klasik SEO yükünden türetildi.'],
		availableSignals,
		totalSignals,
	};
}

function deriveSocialPresence(report: SEOReport): DerivedSocialPresence {
	const meta = report.meta;
	const openGraph = Boolean(meta?.ogTitle || meta?.ogDescription || meta?.ogImage || meta?.ogType);
	const twitterCard = Boolean(meta?.twitterCard || meta?.twitterTitle || meta?.twitterDescription || meta?.twitterImage);
	const hasPreviewImage = Boolean(meta?.ogImage || meta?.twitterImage);
	const checks = [
		{ ok: openGraph, label: 'Open Graph alanları' },
		{ ok: twitterCard, label: 'Twitter Card alanları' },
		{ ok: hasPreviewImage, label: 'Paylaşım görseli' },
	];
	return {
		openGraph,
		twitterCard,
		hasPreviewImage,
		completenessScore: Math.round((checks.filter((item) => item.ok).length / checks.length) * 100),
		missing: checks.filter((item) => !item.ok).map((item) => item.label),
	};
}

function deriveCategoryScores(report: SEOReport): Partial<Record<SEOCategory, SEOCategoryScore>> {
	const perf = report.performanceScore;
	const meta = report.meta;
	const social = deriveSocialPresence(report);
	const securityMissing = perf?.breakdown.securityHeaders.missing ?? [];
	const metaMissing = perf?.breakdown.meta.missing ?? [];
	const metaPresent = perf?.breakdown.meta.present ?? [];
	const securityPresent = perf?.breakdown.securityHeaders.present ?? [];

	const onPageReasons = [
		meta?.title ? 'Title etiketi bulundu.' : 'Title etiketi eksik.',
		meta?.description ? 'Meta description bulundu.' : 'Meta description eksik.',
		meta?.canonical ? 'Canonical tanımlı.' : 'Canonical etiketi yok.',
		meta?.schemaTypes?.length || meta?.schemaOrg?.length ? 'Yapılandırılmış veri tespit edildi.' : 'Schema sinyali görülmedi.',
		meta?.h1?.length ? `H1 bulundu (${meta.h1.length}).` : 'H1 tespit edilmedi.',
	].filter(Boolean);

	const technicalReasons = [
		report.ssl?.valid ? 'SSL sertifikası geçerli.' : 'SSL sertifikası sorunlu veya eksik.',
		securityMissing.length ? `Eksik güvenlik başlıkları: ${securityMissing.join(', ')}.` : 'Temel güvenlik başlıkları mevcut görünüyor.',
		report.robots?.exists ? 'Robots.txt bulundu.' : 'Robots.txt bulunamadı.',
		report.sitemap?.exists ? 'Sitemap.xml bulundu.' : 'Sitemap.xml bulunamadı.',
	].filter(Boolean);

	const performanceReasons = [
		perf?.loadTime !== undefined ? `Ölçülen yükleme süresi ${formatMs(perf.loadTime)}.` : 'Yükleme süresi sinyali sınırlı.',
		perf?.breakdown.observed?.renderBlockingRequests !== undefined
			? `${perf.breakdown.observed.renderBlockingRequests} render-blocking istek görüldü.`
			: 'Render-blocking ayrıntıları klasik payload ile sınırlı.',
		perf?.breakdown.observed?.htmlBytes !== undefined ? `HTML boyutu ${formatBytes(perf.breakdown.observed.htmlBytes)}.` : 'HTML boyutu sinyali yok.',
	].filter(Boolean);

	const usabilityReasons = [
		meta?.viewport ? 'Mobil viewport tanımlı.' : 'Viewport etiketi eksik.',
		meta?.lang ? `Dil etiketi ${meta.lang}.` : 'Dil etiketi görülmedi.',
		meta?.statusCode ? `HTTP durum kodu ${meta.statusCode}.` : 'HTTP durum kodu yok.',
		meta?.images && meta.images.withoutAlt > 0 ? `${meta.images.withoutAlt} görselde alt eksiği var.` : 'Kritik alt eksiği sinyali görülmedi.',
	].filter(Boolean);

	const socialReasons = [
		social.openGraph ? 'Open Graph alanları mevcut.' : 'Open Graph alanları eksik.',
		social.twitterCard ? 'Twitter Card alanları mevcut.' : 'Twitter Card alanları eksik.',
		social.hasPreviewImage ? 'Paylaşım görseli bulundu.' : 'Paylaşım görseli tespit edilmedi.',
	].filter(Boolean);

	const linkReasons = [
		meta?.canonical ? 'Canonical URL bağlantı sinyalini destekliyor.' : 'Canonical URL yok.',
		report.sitemap?.exists ? 'Sitemap tarama yolunu destekliyor.' : 'Sitemap sinyali eksik.',
		meta?.links ? `${meta.links.internal} iç link, ${meta.links.external} dış link görüldü.` : 'Link özeti dönmedi.',
		meta?.links?.missingAnchorText ? `${meta.links.missingAnchorText} linkte anchor metni eksik.` : 'Anchor metni problemi sinyali sınırlı.',
	].filter(Boolean);

	const onPageBase = perf?.metaCompleteness ?? Math.round(((metaPresent.length || (meta?.title ? 1 : 0) + (meta?.description ? 1 : 0) + (meta?.canonical ? 1 : 0)) / Math.max(1, metaPresent.length + metaMissing.length || 4)) * 100);
	const technicalBase = Math.round(((perf?.ssl ?? (report.ssl?.valid ? 100 : 35)) + (perf?.securityHeaders ?? Math.round((securityPresent.length / Math.max(1, securityPresent.length + securityMissing.length || 6)) * 100)) + (report.robots?.exists ? 90 : 45) + (report.sitemap?.exists ? 90 : 45)) / 4);
	const performanceBase = perf?.overall ?? Math.round(((perf?.loadTime && perf.loadTime < 1200 ? 90 : perf?.loadTime && perf.loadTime < 2500 ? 70 : perf?.loadTime ? 50 : 55) + (perf?.breakdown.observed?.renderBlockingRequests !== undefined ? Math.max(25, 100 - perf.breakdown.observed.renderBlockingRequests * 12) : 55)) / 2);
	const usabilityBase = Math.round(((meta?.viewport ? 100 : 35) + (meta?.lang ? 85 : 55) + (meta?.images ? Math.max(35, 100 - meta.images.withoutAlt * 12) : 60)) / 3);
	const socialBase = social.completenessScore;
	const linksBase = Math.round(((meta?.canonical ? 90 : 45) + (report.sitemap?.exists ? 85 : 45) + (meta?.links ? Math.max(35, 100 - meta.links.missingAnchorText * 10) : 55)) / 3);

	return {
		'on-page': buildCategoryScore(onPageBase, onPageReasons, metaPresent.length || 3, Math.max(metaPresent.length + metaMissing.length, 5)),
		technical: buildCategoryScore(technicalBase, technicalReasons, securityPresent.length + Number(Boolean(report.ssl)) + Number(Boolean(report.robots?.exists)) + Number(Boolean(report.sitemap?.exists)), Math.max(securityPresent.length + securityMissing.length + 3, 6)),
		performance: buildCategoryScore(performanceBase, performanceReasons, perf?.breakdown.observed ? 3 : 1, 3),
		usability: buildCategoryScore(usabilityBase, usabilityReasons, Number(Boolean(meta?.viewport)) + Number(Boolean(meta?.lang)) + Number(Boolean(meta?.images)), 3),
		social: buildCategoryScore(socialBase, socialReasons, 3 - social.missing.length, 3),
		links: buildCategoryScore(linksBase, linkReasons, Number(Boolean(meta?.canonical)) + Number(Boolean(report.sitemap?.exists)) + Number(Boolean(meta?.links)), 3),
	};
}

function deriveFallbackRecommendations(report: SEOReport, social: DerivedSocialPresence): SEORecommendation[] {
	const perf = report.performanceScore;
	const meta = report.meta;
	const items: SEORecommendation[] = [];
	const push = (item: SEORecommendation) => items.push(item);

	if (perf?.breakdown.meta.missing.includes('description') || !meta?.description) {
		push({ id: 'fallback-meta-description', category: 'on-page', priority: 'high', title: 'Meta description alanını tamamlayın', fix: 'Her sayfada benzersiz ve amacı net bir meta description kullanın.', impact: 'Arama sonucunda tıklanma potansiyelini ve snippet netliğini artırır.', evidence: ['Meta description eksik veya klasik payload içinde zayıf görünüyor.'], scoreImpact: 6 });
	}
	if (!meta?.canonical) {
		push({ id: 'fallback-canonical', category: 'links', priority: 'medium', title: 'Canonical URL tanımlayın', fix: "Tekil sayfalarda canonical etiketi ile tercih edilen URL'yi belirtin.", impact: 'Kopya sayfa riskini azaltır ve indeksleme sinyalini netleştirir.', evidence: ['Canonical etiketi tespit edilmedi.'], scoreImpact: 4 });
	}
	if (perf?.breakdown.securityHeaders.missing.length) {
		push({ id: 'fallback-security-headers', category: 'technical', priority: 'high', title: 'Eksik güvenlik başlıklarını tamamlayın', fix: `En azından ${perf.breakdown.securityHeaders.missing.slice(0, 3).join(', ')} başlıklarını ekleyin.`, impact: 'Tarayıcı güvenliğini ve teknik kalite algısını güçlendirir.', evidence: perf.breakdown.securityHeaders.missing, scoreImpact: 8 });
	}
	if (!report.robots?.exists) {
		push({ id: 'fallback-robots', category: 'technical', priority: 'medium', title: 'Robots.txt dosyası yayınlayın', fix: 'Tarama kurallarını ve sitemap referanslarını robots.txt içinde sunun.', impact: 'Crawler davranışını netleştirir ve audit eksiklerini azaltır.', evidence: ['Robots.txt bulunamadı.'], scoreImpact: 4 });
	}
	if (!report.sitemap?.exists) {
		push({ id: 'fallback-sitemap', category: 'technical', priority: 'medium', title: 'Sitemap.xml ekleyin', fix: "İndekslenmesini istediğiniz URL'leri sitemap.xml ile yayınlayın.", impact: 'Arama motorlarının URL keşfini hızlandırır.', evidence: ['Sitemap.xml bulunamadı.'], scoreImpact: 4 });
	}
	if (!meta?.viewport) {
		push({ id: 'fallback-viewport', category: 'usability', priority: 'high', title: 'Viewport etiketi ekleyin', fix: 'Responsive davranış için head bölümüne uygun viewport meta etiketi koyun.', impact: 'Mobil kullanılabilirliği ve sayfa algısını iyileştirir.', evidence: ['Viewport etiketi eksik.'], scoreImpact: 7 });
	}
	if (!social.openGraph || !social.twitterCard || !social.hasPreviewImage) {
		push({ id: 'fallback-social', category: 'social', priority: 'medium', title: 'Sosyal önizleme alanlarını tamamlayın', fix: 'OG/Twitter title, description ve uygun bir önizleme görseli tanımlayın.', impact: 'Paylaşım kartlarında daha güçlü görünürlük sağlar.', evidence: social.missing, scoreImpact: 5 });
	}
	if (!report.ssl?.valid) {
		push({ id: 'fallback-ssl', category: 'technical', priority: 'high', title: 'SSL kurulumunu doğrulayın', fix: 'HTTPS sertifikasının geçerliliğini, zincirini ve yenileme tarihini kontrol edin.', impact: 'Güven ve tarayıcı uyumluluğu için temel bir gerekliliktir.', evidence: [report.ssl?.validTo ? `SSL bitiş tarihi ${formatDate(report.ssl.validTo)}.` : 'SSL sertifikası sorunlu veya eksik.'], scoreImpact: 9 });
	}

	return items.slice(0, 8);
}

function deriveFallbackFindings(report: SEOReport, social: DerivedSocialPresence): SEOFinding[] {
	const perf = report.performanceScore;
	const findings: SEOFinding[] = [];
	const push = (item: SEOFinding) => findings.push(item);

	if (perf?.breakdown.securityHeaders.missing.length) {
		push({ id: 'finding-security-missing', category: 'technical', severity: 'high', title: 'Eksik güvenlik başlıkları tespit edildi', detail: 'Klasik payload, temel güvenlik başlıklarının tam olmadığını gösteriyor.', evidence: perf.breakdown.securityHeaders.missing, scoreImpact: 8 });
	}
	if (perf?.breakdown.meta.missing.length) {
		push({ id: 'finding-meta-missing', category: 'on-page', severity: 'medium', title: 'Meta tamamlılığı eksik', detail: 'Başlık, açıklama veya başka kritik meta alanları eksik olabilir.', evidence: perf.breakdown.meta.missing, scoreImpact: 6 });
	}
	if (!report.robots?.exists || !report.sitemap?.exists) {
		push({ id: 'finding-crawl-files', category: 'technical', severity: 'medium', title: 'Tarama dosyaları tam değil', detail: 'Robots.txt veya sitemap.xml klasik raporda eksik görünüyor.', evidence: [report.robots?.exists ? 'Robots.txt bulundu.' : 'Robots.txt bulunamadı.', report.sitemap?.exists ? 'Sitemap.xml bulundu.' : 'Sitemap.xml bulunamadı.'], scoreImpact: 5 });
	}
	if (!report.ssl?.valid) {
		push({ id: 'finding-ssl', category: 'technical', severity: 'high', title: 'SSL durumu güven vermiyor', detail: 'HTTPS sertifikası geçerli değil veya yanıt içinde doğrulanamadı.', evidence: [report.ssl?.issuer || 'Issuer bilgisi yok', report.ssl?.validTo ? `Bitiş: ${formatDate(report.ssl.validTo)}` : 'Bitiş tarihi yok'], scoreImpact: 9 });
	}
	if (!social.openGraph || !social.twitterCard) {
		push({ id: 'finding-social', category: 'social', severity: 'low', title: 'Sosyal önizleme kapsamı sınırlı', detail: 'Paylaşım etiketleri tüm platformları yeterince desteklemiyor.', evidence: social.missing, scoreImpact: 4 });
	}

	return findings.slice(0, 6);
}

function deriveSummary(headlineDomain: string, categories: Partial<Record<SEOCategory, SEOCategoryScore>>, recommendationCount: number): DerivedSummary {
	const ranked = CATEGORY_ORDER.map((category) => ({ category, score: categories[category]?.score ?? 0 })).sort((a, b) => b.score - a.score);
	const strongest = ranked.filter((item) => item.score > 0).slice(0, 2).map((item) => item.category);
	const weakest = [...ranked].reverse().filter((item) => item.score > 0).slice(0, 2).map((item) => item.category);
	const lead = ranked[0];
	const lag = [...ranked].reverse()[0];
	return {
		headline: `${headlineDomain} için uyumlu audit özeti hazırlandı. En güçlü alan ${CATEGORY_META[lead?.category ?? 'performance'].label.toLowerCase()}, ilk bakılacak alan ise ${CATEGORY_META[lag?.category ?? 'technical'].label.toLowerCase()}.`,
		strongestCategories: strongest,
		weakestCategories: weakest,
		recommendationCount,
	};
}

function getPriorityWeight(level: PriorityLaneItem['level']) {
	if (level === 'high') return 4;
	if (level === 'medium') return 3;
	if (level === 'low') return 2;
	return 1;
}

function buildPriorityLane(recommendations: SEORecommendation[], findings: SEOFinding[]): PriorityLaneItem[] {
	const items: PriorityLaneItem[] = [
		...recommendations.map((item) => ({
			id: item.id,
			kind: 'recommendation' as const,
			category: item.category,
			level: getRecommendationTone(item.priority) as PriorityLaneItem['level'],
			label: item.priority === 'high' ? 'Yüksek öncelik' : item.priority === 'medium' ? 'Orta öncelik' : 'Düşük öncelik',
			title: item.title,
			body: item.fix,
			evidence: item.evidence,
			scoreImpact: item.scoreImpact,
			weight: getPriorityWeight(getRecommendationTone(item.priority)) * 100 + (item.scoreImpact ?? 0),
		})),
		...findings.map((item) => ({
			id: item.id,
			kind: 'finding' as const,
			category: item.category,
			level: getFindingTone(item.severity) as PriorityLaneItem['level'],
			label: item.severity === 'high' ? 'Kritik bulgu' : item.severity === 'medium' ? 'Önemli bulgu' : item.severity === 'low' ? 'Bulgu' : 'Bilgi',
			title: item.title,
			body: item.detail,
			evidence: item.evidence,
			scoreImpact: item.scoreImpact,
			weight: getPriorityWeight(getFindingTone(item.severity)) * 100 + (item.scoreImpact ?? 0),
		})),
	];

	return items.sort((a, b) => b.weight - a.weight).slice(0, 8);
}

function buildVerdict(score: number, laneCount: number, weakest: SEOCategory[]) {
	const weakestLabel = weakest.length ? CATEGORY_META[weakest[0]].label.toLowerCase() : 'temel teknikler';
	if (score >= 85) return `Genel tablo güçlü. Kısa vadede ${weakestLabel} tarafındaki rafine iyileştirmeler yeterli görünüyor.`;
	if (score >= 70) return `Temel kalite iyi, ancak ${weakestLabel} alanında net iyileştirme payı var.`;
	if (score >= 50) return `Rapor okunabilir bir temel sunuyor; ilk etapta ${laneCount} öncelikli madde ve ${weakestLabel} alanına odaklanın.`;
	return `Audit açık bir toparlama ihtiyacı gösteriyor. İlk adım olarak ${weakestLabel} ve yüksek etkili maddeleri ele alın.`;
}

function derivePassedAudits(report: SEOReport, social: DerivedSocialPresence): PassedAuditItem[] {
	const items: PassedAuditItem[] = [];
	const push = (item: PassedAuditItem | false) => {
		if (item) items.push(item);
	};

	push(report.meta?.title ? { id: 'passed-title', category: 'on-page', title: t('Title etiketi mevcut', 'Title tag present'), detail: t('Sayfa başlığı tespit edildi ve arama görünümü için temel sinyal sağlanıyor.', 'Page title detected and providing a core search visibility signal.') } : false);
	push(report.meta?.description ? { id: 'passed-description', category: 'on-page', title: t('Meta description mevcut', 'Meta description present'), detail: t('Açıklama alanı doldurulmuş görünüyor.', 'The description field appears to be filled.') } : false);
	push(report.meta?.canonical ? { id: 'passed-canonical', category: 'links', title: t('Canonical URL tanımlı', 'Canonical URL defined'), detail: t('Tercih edilen URL sinyali bulunuyor.', 'Preferred URL signal is present.') } : false);
	push(report.meta?.viewport ? { id: 'passed-viewport', category: 'usability', title: t('Viewport etiketi mevcut', 'Viewport tag present'), detail: t('Mobil düzen için temel viewport meta etiketi bulundu.', 'A basic viewport meta tag was found for mobile layout.') } : false);
	push(report.meta?.lang ? { id: 'passed-lang', category: 'usability', title: t('Dil etiketi mevcut', 'Language tag present'), detail: t(`Belge dili ${report.meta.lang} olarak bildiriliyor.`, `Document language reported as ${report.meta.lang}.`) } : false);
	push(report.ssl?.valid ? { id: 'passed-ssl', category: 'technical', title: t('SSL sertifikası geçerli', 'SSL certificate valid'), detail: t('HTTPS kurulumu geçerli sinyal veriyor.', 'HTTPS setup is returning a valid signal.') } : false);
	push(report.robots?.exists ? { id: 'passed-robots', category: 'technical', title: t('Robots.txt bulundu', 'Robots.txt found'), detail: t('Tarama kuralları için temel dosya mevcut.', 'A baseline crawl rules file is present.') } : false);
	push(report.sitemap?.exists ? { id: 'passed-sitemap', category: 'technical', title: t('Sitemap.xml bulundu', 'Sitemap.xml found'), detail: t('URL keşfi için sitemap sinyali mevcut.', 'Sitemap signal is present for URL discovery.') } : false);
	push(social.openGraph ? { id: 'passed-og', category: 'social', title: t('Open Graph alanları mevcut', 'Open Graph fields present'), detail: t('Sosyal paylaşım önizlemesi için OG verileri bulundu.', 'OG data found for social preview.') } : false);
	push(social.twitterCard ? { id: 'passed-twitter', category: 'social', title: t('Twitter Card alanları mevcut', 'Twitter Card fields present'), detail: t('Twitter/X önizleme sinyali mevcut.', 'Twitter/X preview signal is present.') } : false);
	push(social.hasPreviewImage ? { id: 'passed-social-image', category: 'social', title: t('Paylaşım görseli bulundu', 'Share image found'), detail: t('Sosyal kartlarda kullanılabilecek bir görsel tespit edildi.', 'An image suitable for social cards was detected.') } : false);
	push((report.meta?.images?.withoutAlt ?? 0) === 0 && (report.meta?.images?.total ?? 0) > 0 ? { id: 'passed-alt', category: 'usability', title: t('Alt metni eksik görsel görünmüyor', 'No missing-alt images detected'), detail: t('Raporlanan görsellerde eksik alt metni sinyali yok.', 'No missing alt-text signal was found in the reported images.') } : false);
	push((report.meta?.links?.missingAnchorText ?? 0) === 0 && (report.meta?.links?.total ?? 0) > 0 ? { id: 'passed-anchor', category: 'links', title: t('Anchor metni eksiği görünmüyor', 'No missing anchor text detected'), detail: t('Raporlanan bağlantılarda eksik anchor text sinyali yok.', 'No missing anchor text signal was found in the reported links.') } : false);

	return items.slice(0, 12);
}

function PerformanceSnapshot(props: { performance?: PerformanceScore; assets?: AssetBreakdown; renderingRisk?: RenderingRisk }) {
	const observed = () => props.performance?.breakdown.observed;
	const totalKnownBytes = () => props.assets?.totals.knownBytes ?? observed()?.knownAssetBytes ?? 0;
	const resources = () => {
		const value = props.assets?.resources;
		if (!value) return [];
		return [
			{ key: 'scripts', label: 'Script', data: value.scripts, tone: 'seo-tone-cyan' },
			{ key: 'stylesheets', label: 'CSS', data: value.stylesheets, tone: 'seo-tone-amber' },
			{ key: 'images', label: 'Görsel', data: value.images, tone: 'seo-tone-emerald' },
			{ key: 'fonts', label: 'Font', data: value.fonts, tone: 'seo-tone-slate' },
			{ key: 'other', label: 'Diğer', data: value.other, tone: 'seo-tone-rose' },
		];
	};

	return (
		<div class="seo-lh-diagnostic-grid">
			<div class="seo-panel seo-panel-secondary">
				<div class="seo-section-head">
					<div>
						<p class="seo-kicker">Gözlemlenen metrikler</p>
						<h3 class="seo-section-title">Canlı performans sinyalleri</h3>
					</div>
				</div>
				<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					<div class="seo-mini-stat"><span class="seo-mini-label">HTML boyutu</span><strong>{formatBytes(observed()?.htmlBytes ?? props.assets?.html?.bytes)}</strong></div>
					<div class="seo-mini-stat"><span class="seo-mini-label">Asset isteği</span><strong>{formatNumber(observed()?.assetRequests ?? props.assets?.totals.requests)}</strong></div>
					<div class="seo-mini-stat"><span class="seo-mini-label">Render-blocking</span><strong>{formatNumber(observed()?.renderBlockingRequests ?? props.assets?.totals.renderBlockingRequests)}</strong></div>
					<div class="seo-mini-stat"><span class="seo-mini-label">Yükleme süresi</span><strong>{formatMs(observed()?.fetchTimeMs ?? props.performance?.loadTime)}</strong></div>
				</div>
				<Show when={resources().length}>
					<div class="seo-lh-subsection">
						<div class="seo-lh-subsection-head">
							<h4>Kaynak dağılımı</h4>
							<span>{resources().length} grup</span>
						</div>
						<div class="space-y-3">
							<For each={resources()}>
								{(resource) => (
									<div class="seo-resource-row">
										<div class="flex items-center justify-between gap-3 text-sm">
											<div>
												<p class="font-semibold text-gray-100">{resource.label}</p>
												<p class="text-gray-400">{formatNumber(resource.data.count)} istek · {formatBytes(resource.data.knownBytes)} bilinen boyut</p>
											</div>
											<span class="text-gray-400">{resource.data.externalCount} harici</span>
										</div>
										<div class="seo-resource-track">
											<div class={`seo-resource-fill ${resource.tone}`} style={{ width: metricBarWidth(resource.data.knownBytes || resource.data.count, totalKnownBytes() || props.assets?.totals.requests || 1) }} />
										</div>
									</div>
								)}
							</For>
						</div>
					</div>
				</Show>
			</div>

			<div class="seo-panel seo-panel-secondary seo-risk-panel">
				<div class="seo-section-head">
					<div>
						<p class="seo-kicker">Rendering risk</p>
						<h3 class="seo-section-title">Render riski</h3>
					</div>
				</div>
				<Show when={props.renderingRisk} fallback={<p class="seo-subtle-note">Render riski verisi mevcut değil.</p>}>
					{(risk) => (
						<>
							<div class={`seo-risk-badge is-${risk().level}`}>
								<span>Risk seviyesi</span>
								<strong>{risk().level === 'high' ? 'Yüksek' : risk().level === 'medium' ? 'Orta' : risk().level === 'low' ? 'Düşük' : 'Bilinmiyor'}</strong>
							</div>
							<div class="seo-meter mt-4">
								<div class="seo-meter-bar"><div class="seo-meter-fill seo-tone-amber" style={{ width: `${clampScore(risk().score)}%` }} /></div>
								<div class="flex items-center justify-between text-xs text-gray-400"><span>0</span><span>{clampScore(risk().score)}/100</span><span>100</span></div>
							</div>
							<div class="mt-4 grid gap-3 sm:grid-cols-2">
								<div class="seo-mini-stat"><span class="seo-mini-label">CSS blokajı</span><strong>{risk().blockers.renderBlockingStylesheets}</strong></div>
								<div class="seo-mini-stat"><span class="seo-mini-label">Senkron script</span><strong>{risk().blockers.synchronousScripts}</strong></div>
								<div class="seo-mini-stat"><span class="seo-mini-label">Büyük HTML</span><strong>{risk().blockers.largeHtmlDocument ? 'Evet' : 'Hayır'}</strong></div>
								<div class="seo-mini-stat"><span class="seo-mini-label">Viewport eksik</span><strong>{risk().blockers.missingViewport ? 'Evet' : 'Hayır'}</strong></div>
							</div>
							<Show when={risk().reasons.length}>
								<div class="mt-4 space-y-2">
									<For each={risk().reasons}>{(reason) => <p class="seo-inline-note">{reason}</p>}</For>
								</div>
							</Show>
						</>
					)}
				</Show>
			</div>
		</div>
	);
}

function SerpCard(props: { serp?: SERPPreview; meta?: MetaTags; url: string }) {
	const title = () => props.serp?.title || props.meta?.title || 'Başlık tespit edilmedi';
	const description = () => props.serp?.description || props.meta?.description || 'Açıklama etiketi bulunamadı.';
	const displayUrl = () => props.serp?.displayUrl || props.serp?.canonicalUrl || props.meta?.canonical || props.meta?.finalUrl || props.url;

	return (
		<div class="seo-serp-card seo-lh-serp-card">
			<p class="seo-serp-url">{displayUrl()}</p>
			<h4>{title()}</h4>
			<p>{description()}</p>
			<div class="mt-4 flex flex-wrap gap-2 text-xs text-gray-400">
				<span>Başlık: {formatNumber(props.serp?.titleLength ?? props.meta?.title?.length)}</span>
				<span>Açıklama: {formatNumber(props.serp?.descriptionLength ?? props.meta?.description?.length)}</span>
				<Show when={props.serp?.robots || props.meta?.robots}><span>Robots: {props.serp?.robots || props.meta?.robots}</span></Show>
			</div>
		</div>
	);
}

function SectionHeader(props: { kicker: string; title: string; description?: string; badge?: string }) {
	return (
		<div class="seo-audit-section-head">
			<div>
				<p class="seo-kicker">{props.kicker}</p>
				<h3 class="seo-section-title">{props.title}</h3>
				<Show when={props.description}><p class="seo-section-copy">{props.description}</p></Show>
			</div>
			<Show when={props.badge}><span class="seo-inline-note">{props.badge}</span></Show>
		</div>
	);
}

function CategoryGlyph(props: { category: SEOCategory }) {
	switch (props.category) {
		case 'on-page':
			return (
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M6 6h12" />
					<path d="M6 10h12" />
					<path d="M6 14h7" />
					<path d="M6 18h10" />
				</svg>
			);
		case 'technical':
			return (
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M8 8 4 12l4 4" />
					<path d="m16 8 4 4-4 4" />
					<path d="m13 5-2 14" />
				</svg>
			);
		case 'performance':
			return (
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M12 4a8 8 0 1 0 8 8" />
					<path d="M12 12 18.5 5.5" />
					<path d="M15 5h4v4" />
				</svg>
			);
		case 'usability':
			return (
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<rect x="5" y="3.5" width="14" height="17" rx="2.5" />
					<path d="M9 7.5h6" />
					<path d="M10.5 16.5h3" />
				</svg>
			);
		case 'social':
			return (
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M7 8a3 3 0 1 1 0 6h-.5A2.5 2.5 0 0 0 4 16.5 2.5 2.5 0 0 0 6.5 19H12" />
					<path d="M17 16a3 3 0 1 1 0-6h.5A2.5 2.5 0 0 0 20 7.5 2.5 2.5 0 0 0 17.5 5H12" />
					<path d="M8 12h8" />
				</svg>
			);
		case 'links':
			return (
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M10 13a5 5 0 0 1 0-7l1.5-1.5a5 5 0 0 1 7 7L17 13" />
					<path d="M14 11a5 5 0 0 1 0 7L12.5 19.5a5 5 0 0 1-7-7L7 11" />
				</svg>
			);
		default:
			return (
				<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
					<circle cx="12" cy="12" r="3" />
				</svg>
			);
	}
}

function ScoreGauge(props: { score: number; label: string; size?: 'large' | 'small'; status?: string; detail?: string }) {
	const normalized = clampScore(props.score);
	const isSmall = (props.size ?? 'large') === 'small';
	const radius = props.size === 'small' ? 28 : 58;
	const strokeWidth = props.size === 'small' ? 5 : 8;
	const normalizedRadius = radius - strokeWidth / 2;
	const circumference = 2 * Math.PI * normalizedRadius;
	const dashoffset = circumference - (normalized / 100) * circumference;
	const tone = getGaugeTone(normalized);

	return (
		<div class={`seo-score-gauge is-${props.size ?? 'large'} tone-${tone}`}>
			<div class="seo-score-gauge-ring">
				<svg viewBox={`0 0 ${radius * 2} ${radius * 2}`} aria-hidden="true">
					<circle class="seo-score-gauge-track" cx={String(radius)} cy={String(radius)} r={String(normalizedRadius)} stroke-width={String(strokeWidth)} fill="none" />
					<circle
						class="seo-score-gauge-progress"
						cx={String(radius)}
						cy={String(radius)}
						r={String(normalizedRadius)}
						stroke-width={String(strokeWidth)}
						fill="none"
						stroke-dasharray={String(circumference)}
						stroke-dashoffset={String(dashoffset)}
					/>
				</svg>
				<div class="seo-score-gauge-center">
					<strong>{normalized}</strong>
					<Show when={props.label}><span>{props.label}</span></Show>
					<Show when={props.status}><em>{props.status}</em></Show>
				</div>
			</div>
			<Show when={!isSmall}><div class="seo-score-gauge-scale"><span>0</span><span>50</span><span>100</span></div></Show>
			<Show when={props.detail}><p class="seo-score-gauge-detail">{props.detail}</p></Show>
		</div>
	);
}

function CategoryScoreCard(props: { category: SEOCategory; label: string; scoreData?: SEOCategoryScore }) {
	const score = clampScore(props.scoreData?.score);
	const tone = getGaugeTone(score);
	const availableSignals = props.scoreData?.availableSignals ?? 0;
	const totalSignals = Math.max(props.scoreData?.totalSignals ?? 0, 1);
	const coverage = Math.round((availableSignals / totalSignals) * 100);
	const scoreStatus = getScoreStatus(score);

	return (
		<article class={`seo-lh-category-card tone-${tone} category-${props.category}`}>
			<div class="seo-lh-category-card-head">
				<div class="seo-category-mark" aria-hidden="true">
					<CategoryGlyph category={props.category} />
				</div>
				<div class="seo-lh-category-copy">
					<p class="seo-lh-category-title">{props.label}</p>
					<p class="seo-lh-category-status">{getStatusLabel(props.scoreData?.status)} · {availableSignals}/{totalSignals} sinyal</p>
				</div>
				<div class="seo-lh-category-value">
					<strong>{score}</strong>
					<span>{scoreStatus.label}</span>
				</div>
			</div>
			<div class="seo-lh-category-body">
				<ScoreGauge score={score} label="" size="small" status={undefined} />
				<div class="seo-lh-category-meta">
					<p class="seo-strip-reason">{props.scoreData?.reasons[0] || 'Bu kategori için ayrıntılı sinyal dönmedi.'}</p>
					<div class="seo-lh-category-footer">
						<div class="seo-lh-category-coverage" aria-hidden="true">
							<div class={`seo-lh-category-coverage-fill tone-${tone}`} style={{ width: `${coverage}%` }} />
						</div>
						<div class="seo-lh-category-signals">
							<span>Sinyal kapsamı</span>
							<strong>{coverage}%</strong>
						</div>
					</div>
				</div>
			</div>
		</article>
	);
}

export default function ReportView(props: ReportViewProps) {
	const locale = createLocaleSignal();
	const t = (tr: string, en: string) => (locale() === 'en' ? en : tr);
	const [activeTab, setActiveTab] = createSignal<ReportTab>('overview');
	const report = createMemo(() => props.report);
	const fallbackSocialPresence = createMemo(() => (report() ? deriveSocialPresence(report()!) : undefined));
	const socialPresence = createMemo(() => report()?.socialPresence ?? fallbackSocialPresence());
	const hasRealCategoryScores = createMemo(() => Boolean(report()?.categoryScores && CATEGORY_ORDER.every((category) => report()!.categoryScores?.[category])));
	const derivedCategoryScores = createMemo(() => (report() ? deriveCategoryScores(report()!) : {}));
	const effectiveCategoryScores = createMemo(() => ({ ...derivedCategoryScores(), ...(report()?.categoryScores ?? {}) }));
	const derivedRecommendations = createMemo(() => (report() && socialPresence() ? deriveFallbackRecommendations(report()!, socialPresence()!) : []));
	const effectiveRecommendations = createMemo(() => (report()?.recommendations?.length ? report()!.recommendations! : derivedRecommendations()));
	const derivedFindings = createMemo(() => (report() && socialPresence() ? deriveFallbackFindings(report()!, socialPresence()!) : []));
	const effectiveFindings = createMemo(() => (report()?.findings?.length ? report()!.findings! : derivedFindings()));
	const derivedSummary = createMemo(() => (report() ? deriveSummary(safeDomain(props.analyzedUrl || report()!.url), effectiveCategoryScores(), effectiveRecommendations().length) : undefined));
	const effectiveSummary = createMemo(() => report()?.summary ?? derivedSummary());
	const compatibilityMode = createMemo(() => Boolean(report() && (!hasRealCategoryScores() || !report()?.recommendations?.length || !report()?.findings?.length || !report()?.summary || !report()?.socialPresence)));
	const categoryCards = createMemo(() => CATEGORY_ORDER.map((category) => ({ key: category, meta: CATEGORY_META[category], data: effectiveCategoryScores()?.[category] })));
	const overallScore = createMemo(() => {
		const perf = report()?.performanceScore?.overall;
		if (perf !== undefined) return clampScore(perf);
		const scores = categoryCards().map((card) => card.data?.score).filter((value): value is number => value !== undefined);
		if (!scores.length) return 0;
		return clampScore(scores.reduce((sum, value) => sum + value, 0) / scores.length);
	});
	const summaryHeadline = createMemo(() => effectiveSummary()?.headline || `${safeDomain(props.analyzedUrl || report()?.url)} için temel SEO audit özeti çıkarıldı.`);
	const scoreStatus = createMemo(() => getScoreStatus(overallScore()));
	const strongest = createMemo(() => effectiveSummary()?.strongestCategories ?? []);
	const weakest = createMemo(() => effectiveSummary()?.weakestCategories ?? []);
	const priorityLane = createMemo(() => buildPriorityLane(effectiveRecommendations(), effectiveFindings()));
	const primaryPriority = createMemo(() => priorityLane().slice(0, 4));
	const secondaryPriority = createMemo(() => priorityLane().slice(4));
	const verdict = createMemo(() => buildVerdict(overallScore(), priorityLane().length, weakest()));
	const passedAudits = createMemo(() => (report() && socialPresence() ? derivePassedAudits(report()!, socialPresence()!) : []));

	return (
		<Show
			when={!props.error && report()}
			fallback={
				<Show when={props.error}>
					<div class="dp-seo-error-panel">
						<h3>{t('Analiz hatası', 'Analysis error')}</h3>
						<p>{props.error}</p>
					</div>
				</Show>
			}
		>
			<div class="dp-seo-report">
				<section class="dp-seo-overview">
					<div class="dp-seo-score-card">
						<div class="dp-seo-score-label">{t('Genel Sağlık Skoru', 'Overall health score')}</div>
						<div class={`dp-seo-score-big tone-${getGaugeTone(overallScore())}`}>{overallScore()}</div>
						<div class={`dp-seo-score-status tone-${getGaugeTone(overallScore())}`}>{scoreStatus().label.toUpperCase()}</div>
					</div>

						<div class="dp-seo-stats-grid">
							<div class="dp-seo-stat-item">
								<span class={`dp-seo-stat-value tone-${priorityLane().length ? 'average' : 'good'}`}>{formatNumber(priorityLane().length)}</span>
								<span class="dp-seo-stat-label">{t('Öncelikli Madde', 'Priority items')}</span>
							</div>
							<div class="dp-seo-stat-item">
								<span class="dp-seo-stat-value">{formatMs(report()!.meta?.fetchTimeMs ?? report()!.performanceScore?.loadTime)}</span>
								<span class="dp-seo-stat-label">{t('Yükleme Süresi', 'Load time')}</span>
							</div>
							<div class="dp-seo-stat-item">
								<span class={`dp-seo-stat-value tone-${report()!.meta?.statusCode === 200 ? 'good' : 'poor'}`}>{report()!.meta?.statusCode ?? '-'}</span>
								<span class="dp-seo-stat-label">{t('HTTP Durum', 'HTTP status')}</span>
							</div>
							<div class="dp-seo-stat-item">
								<span class="dp-seo-stat-value">{clampScore(socialPresence()?.completenessScore)}%</span>
								<span class="dp-seo-stat-label">{t('Sosyal Kapsam', 'Social coverage')}</span>
							</div>
							<div class="dp-seo-stat-item">
								<span class="dp-seo-stat-value">{strongest().length ? CATEGORY_META[strongest()[0]].label : 'Belirsiz'}</span>
								<span class="dp-seo-stat-label">{t('En Güçlü Alan', 'Strongest area')}</span>
							</div>
							<div class="dp-seo-stat-item">
								<span class={`dp-seo-stat-value tone-${weakest().length ? 'poor' : 'good'}`}>{weakest().length ? CATEGORY_META[weakest()[0]].label : t('Yok', 'None')}</span>
								<span class="dp-seo-stat-label">{t('İlk Odak', 'First focus')}</span>
							</div>
						</div>
					</section>

					<section class="dp-seo-block">
					<h2 class="dp-seo-section-title">{t('Kategori Sinyalleri', 'Category signals')}</h2>
					<div class="dp-seo-category-list">
						<For each={categoryCards()}>
							{(card) => (
								<div class="dp-seo-category-row">
									<div class="dp-seo-category-info">
										<h3>{card.meta.label}</h3>
										<p>{getStatusLabel(card.data?.status)} · {card.data?.availableSignals ?? 0}/{Math.max(card.data?.totalSignals ?? 0, 1)} sinyal · Sinyal kapsamı {Math.round(((card.data?.availableSignals ?? 0) / Math.max(card.data?.totalSignals ?? 1, 1)) * 100)}%</p>
									</div>
									<div class={`dp-seo-category-score tone-${getGaugeTone(card.data?.score ?? 0)}`}>{clampScore(card.data?.score)}</div>
								</div>
							)}
						</For>
					</div>
						<Show when={compatibilityMode()}>
							<p class="dp-seo-compat-note">{t('Uyumluluk modu aktif. Bazı maddeler mevcut payload’dan türetildi; veri hattı korunuyor.', 'Compatibility mode active. Some items were derived from the current payload; the data pipeline is preserved.')}</p>
						</Show>
					</section>

				<section class="dp-seo-tabs-shell">
					<div class="dp-seo-tabs-header" role="tablist" aria-label="SEO rapor sekmeleri">
						<For each={Object.keys(TAB_META) as ReportTab[]}>
							{(tab) => (
								<button
									type="button"
									role="tab"
									aria-selected={activeTab() === tab}
									class={`dp-seo-tab-button ${activeTab() === tab ? 'active' : ''}`}
									onClick={() => setActiveTab(tab)}
								>
									{TAB_META[tab].label.toUpperCase()}
									<Show when={tab === 'opportunities'}><span class="dp-seo-badge red">{priorityLane().length}</span></Show>
									<Show when={tab === 'passed'}><span class="dp-seo-badge green">{passedAudits().length}</span></Show>
								</button>
							)}
						</For>
					</div>

					<div class="dp-seo-tab-panel">
						<Show when={activeTab() === 'overview'}>
							<div class="dp-seo-tab-pane active">
								<div class="dp-seo-panel">
									<div class="dp-seo-panel-head">Audit Özeti (SERP & Görünüm)</div>
					<div class="dp-seo-serp-box">
						<div class="dp-seo-serp-link">{report()!.serpPreview?.displayUrl || report()!.serpPreview?.canonicalUrl || report()!.meta?.canonical || report()!.url}</div>
						<div class="dp-seo-serp-title">{report()!.serpPreview?.title || report()!.meta?.title || t('Başlık tespit edilmedi', 'No title detected')}</div>
						<div class="dp-seo-serp-desc">{report()!.serpPreview?.description || report()!.meta?.description || t('Açıklama etiketi bulunamadı.', 'No description tag found.')}</div>
										<div class="dp-seo-serp-meta">
											<span>[TITLE: {formatNumber(report()!.serpPreview?.titleLength ?? report()!.meta?.title?.length)}]</span>
											<span class={report()!.serpPreview?.descriptionTruncated ? 'tone-average' : ''}>[DESC: {formatNumber(report()!.serpPreview?.descriptionLength ?? report()!.meta?.description?.length)}{report()!.serpPreview?.descriptionTruncated ? ' - KESİLEBİLİR' : ''}]</span>
											<span>[ROBOTS: {report()!.serpPreview?.robots || report()!.meta?.robots || '-'}]</span>
										</div>
									</div>
									<div class="dp-seo-audit-cols">
										<div class="dp-seo-audit-col">
											<h4>Güçlü Alanlar</h4>
											<ul>
												<For each={strongest()} fallback={<li>Belirgin güçlü alan yok <span class="tone-average">WARN</span></li>}>
													{(category) => <li>{CATEGORY_META[category].label} <span class="tone-good">OK</span></li>}
												</For>
											</ul>
										</div>
										<div class="dp-seo-audit-col">
											<h4>Odaklanılacaklar</h4>
											<ul>
												<For each={weakest()} fallback={<li>Net odak alanı yok <span class="tone-good">OK</span></li>}>
													{(category) => <li>{CATEGORY_META[category].label} <span class="tone-poor">FAIL</span></li>}
												</For>
											</ul>
										</div>
										<div class="dp-seo-audit-col">
											<h4>Görünüm</h4>
											<ul>
											<li>Canonical <span class={report()!.meta?.canonical ? 'tone-good' : 'tone-poor'}>{report()!.meta?.canonical ? t('UYGUN', 'OK') : t('EKSİK', 'MISSING')}</span></li>
											<li>Başlık <span class={report()!.serpPreview?.titleTruncated ? 'tone-average' : 'tone-good'}>{report()!.serpPreview?.titleTruncated ? t('KESİLEBİLİR', 'TRUNCATED') : t('UYGUN', 'OK')}</span></li>
											<li>Açıklama <span class={report()!.serpPreview?.descriptionTruncated ? 'tone-average' : 'tone-good'}>{report()!.serpPreview?.descriptionTruncated ? t('KESİLDİ', 'TRUNCATED') : t('UYGUN', 'OK')}</span></li>
											</ul>
										</div>
										<div class="dp-seo-audit-col">
											<h4>Erişim / Bot</h4>
											<ul>
											<li>SSL <span class={report()!.ssl?.valid ? 'tone-good' : 'tone-poor'}>{report()!.ssl?.valid ? t('GEÇERLİ', 'VALID') : t('SORUNLU', 'BROKEN')}</span></li>
											<li>Robots.txt <span class={report()!.robots?.exists ? 'tone-good' : 'tone-poor'}>{report()!.robots?.exists ? t('BULUNDU', 'FOUND') : t('EKSİK', 'MISSING')}</span></li>
											<li>Sitemap <span class={report()!.sitemap?.exists ? 'tone-good' : 'tone-poor'}>{report()!.sitemap?.exists ? t('BULUNDU', 'FOUND') : t('EKSİK', 'MISSING')}</span></li>
											</ul>
										</div>
									</div>
								</div>
							</div>
						</Show>

						<Show when={activeTab() === 'opportunities'}>
							<div class="dp-seo-tab-pane active">
								<div class="dp-seo-tab-title">
							<h2>{t('Öncelikli Fırsatlar', 'Priority opportunities')}</h2>
							<span>{t('Yüksek etkili maddeler üstte, destekleyici notlar altta kalıyor.', 'High-impact items are pinned to the top, with supporting notes below.')}</span>
						</div>
						<For each={primaryPriority()} fallback={<div class="dp-seo-panel"><div class="dp-seo-panel-head">{t('Aksiyon yok', 'No actions')}</div><div class="dp-seo-empty">{t('Bu raporda açık bir aksiyon sinyali tespit edilmedi.', 'No clear action signal was detected in this report.')}</div></div>}>
									{(item, index) => (
										<div class={`dp-seo-opportunity-card ${item.level}`}>
											<div class="dp-seo-opportunity-num">{String(index() + 1).padStart(2, '0')}</div>
											<div class="dp-seo-opportunity-content">
												<div class="dp-seo-opportunity-head">
													<div class="dp-seo-opportunity-title">{item.title}</div>
													<div class="dp-seo-opportunity-meta">
														<span class={`tone-${item.level === 'high' ? 'poor' : item.level === 'medium' ? 'average' : 'good'}`}>{item.label}</span>
														<span class="dp-seo-tag">{CATEGORY_META[item.category].label}</span>
													</div>
												</div>
												<div class="dp-seo-opportunity-desc">{item.body}</div>
												<Show when={item.evidence.length}>
													<div class="dp-seo-opportunity-data">
														<For each={item.evidence.slice(0, 3)}>{(evidence) => <div>&gt; {evidence}</div>}</For>
													</div>
												</Show>
											</div>
										</div>
									)}
								</For>

								<Show when={secondaryPriority().length}>
									<div class="dp-seo-tab-title secondary">
										<h2>{t('Diğer Maddeler', 'Other items')}</h2>
										<span>{secondaryPriority().length} {t('kayıt', 'items')}</span>
									</div>
									<For each={secondaryPriority()}>
										{(item, index) => (
											<div class={`dp-seo-opportunity-card ${item.level}`}>
												<div class="dp-seo-opportunity-num">--</div>
												<div class="dp-seo-opportunity-content">
													<div class="dp-seo-opportunity-head">
														<div class="dp-seo-opportunity-title">{item.title}</div>
														<div class="dp-seo-opportunity-meta">
															<span class={`tone-${item.level === 'high' ? 'poor' : item.level === 'medium' ? 'average' : 'good'}`}>{item.label}</span>
															<span class="dp-seo-tag">{CATEGORY_META[item.category].label}</span>
														</div>
													</div>
													<div class="dp-seo-opportunity-desc">{item.body}</div>
												</div>
											</div>
										)}
									</For>
								</Show>
							</div>
						</Show>

						<Show when={activeTab() === 'diagnostics'}>
							<div class="dp-seo-tab-pane active">
								<div class="dp-seo-tab-title">
									<h2>{t('Tanılar ve Detaylar', 'Diagnostics and details')}</h2>
									<span>{t('Performans, teknik yapı, içerik ve sosyal kapsama.', 'Performance, technical structure, content, and social coverage.')}</span>
								</div>

								<div class="dp-seo-diagnostic-grid">
									<div class="dp-seo-panel">
										<div class="dp-seo-panel-head">{t('Canlı Performans Sinyalleri', 'Live performance signals')}</div>
										<ul class="dp-seo-kv-list">
											<li class="dp-seo-kv-item"><span class="dp-seo-kv-key">HTML Boyutu</span><span class="dp-seo-kv-val">{formatBytes(report()!.assetBreakdown?.html?.bytes ?? report()!.meta?.htmlBytes)}</span></li>
											<li class="dp-seo-kv-item"><span class="dp-seo-kv-key">Asset İsteği</span><span class="dp-seo-kv-val">{formatNumber(report()!.assetBreakdown?.totals.requests)}</span></li>
											<li class="dp-seo-kv-item"><span class="dp-seo-kv-key">Render-blocking</span><span class="dp-seo-kv-val tone-poor">{formatNumber(report()!.renderingRisk?.blockers.renderBlockingStylesheets ?? report()!.assetBreakdown?.totals.renderBlockingRequests)}</span></li>
											<li class="dp-seo-kv-item"><span class="dp-seo-kv-key">Yükleme Süresi</span><span class="dp-seo-kv-val">{formatMs(report()!.meta?.fetchTimeMs ?? report()!.performanceScore?.loadTime)}</span></li>
										</ul>
									</div>

									<div class="dp-seo-panel">
										<div class="dp-seo-panel-head">{t('Render Riski', 'Rendering risk')}: <span class={`tone-${getGaugeTone(report()!.renderingRisk?.score ?? 0)}`}>{report()!.renderingRisk?.level ? `${report()!.renderingRisk.level.toUpperCase()} [${clampScore(report()!.renderingRisk.score)}/100]` : t('Sınırlı veri', 'Limited data')}</span></div>
										<ul class="dp-seo-kv-list">
											<li class="dp-seo-kv-item"><span class="dp-seo-kv-key">CSS Blokajı</span><span class="dp-seo-kv-val">{formatNumber(report()!.renderingRisk?.blockers.renderBlockingStylesheets)}</span></li>
											<li class="dp-seo-kv-item"><span class="dp-seo-kv-key">Senkron Script</span><span class="dp-seo-kv-val">{formatNumber(report()!.renderingRisk?.blockers.synchronousScripts)}</span></li>
											<li class="dp-seo-kv-item"><span class="dp-seo-kv-key">Büyük HTML</span><span class="dp-seo-kv-val">{report()!.renderingRisk?.blockers.largeHtmlDocument ? 'Evet' : 'Hayır'}</span></li>
											<li class="dp-seo-kv-item"><span class="dp-seo-kv-key">Viewport Eksik</span><span class="dp-seo-kv-val">{report()!.renderingRisk?.blockers.missingViewport ? 'Evet' : 'Hayır'}</span></li>
										</ul>
									</div>

									<div class="dp-seo-panel">
										<div class="dp-seo-panel-head">{t('Teknik ve İndeksleme', 'Technical and indexing')}</div>
										<ul class="dp-seo-kv-list">
											<li class="dp-seo-kv-item"><span class="dp-seo-kv-key">SSL</span><span class={`dp-seo-kv-val ${report()!.ssl?.valid ? 'tone-good' : 'tone-poor'}`}>{report()!.ssl?.valid ? 'Geçerli' : 'Sorunlu / yok'}</span></li>
											<li class="dp-seo-kv-item"><span class="dp-seo-kv-key">Robots.txt</span><span class={`dp-seo-kv-val ${report()!.robots?.exists ? 'tone-good' : 'tone-poor'}`}>{report()!.robots?.exists ? 'Bulundu' : 'Yok'}</span></li>
											<li class="dp-seo-kv-item"><span class="dp-seo-kv-key">Sitemap.xml</span><span class={`dp-seo-kv-val ${report()!.sitemap?.exists ? 'tone-good' : 'tone-poor'}`}>{report()!.sitemap?.exists ? 'Bulundu' : 'Yok'}</span></li>
											<li class="dp-seo-kv-item"><span class="dp-seo-kv-key">Cache-Control</span><span class="dp-seo-kv-val">{report()!.headers?.caching.cacheControl || '-'}</span></li>
										</ul>
									</div>

									<div class="dp-seo-panel">
										<div class="dp-seo-panel-head">{t('İçerik ve Yapı', 'Content and structure')}</div>
										<ul class="dp-seo-kv-list">
											<li class="dp-seo-kv-item"><span class="dp-seo-kv-key">Dil / Charset</span><span class="dp-seo-kv-val">{report()!.meta?.lang || '-'} · {report()!.meta?.charset || '-'}</span></li>
											<li class="dp-seo-kv-item"><span class="dp-seo-kv-key">Viewport</span><span class="dp-seo-kv-val">{report()!.meta?.viewport ? t('Var', 'Yes') : t('Eksik', 'Missing')}</span></li>
											<li class="dp-seo-kv-item"><span class="dp-seo-kv-key">Kelime Sayısı</span><span class="dp-seo-kv-val">{formatNumber(report()!.meta?.wordCount)}</span></li>
											<li class="dp-seo-kv-item"><span class="dp-seo-kv-key">Alt Eksik Görsel</span><span class="dp-seo-kv-val">{formatNumber(report()!.meta?.images?.withoutAlt)}</span></li>
										</ul>
									</div>

									<div class="dp-seo-panel">
										<div class="dp-seo-panel-head">{t('Arama ve Sosyal Görünüm', 'Search and social appearance')}</div>
										<ul class="dp-seo-kv-list">
											<li class="dp-seo-kv-item"><span class="dp-seo-kv-key">Final URL</span><span class="dp-seo-kv-val">{report()!.meta?.finalUrl || report()!.url}</span></li>
											<li class="dp-seo-kv-item"><span class="dp-seo-kv-key">Open Graph</span><span class="dp-seo-kv-val">{socialPresence()?.openGraph ? t('Var', 'Yes') : t('Eksik', 'Missing')}</span></li>
											<li class="dp-seo-kv-item"><span class="dp-seo-kv-key">Twitter Card</span><span class="dp-seo-kv-val">{socialPresence()?.twitterCard ? t('Var', 'Yes') : t('Eksik', 'Missing')}</span></li>
											<li class="dp-seo-kv-item"><span class="dp-seo-kv-key">OG Görseli</span><span class="dp-seo-kv-val">{report()!.meta?.ogImage || '-'}</span></li>
										</ul>
									</div>

									<div class="dp-seo-panel">
										<div class="dp-seo-panel-head">{t('Bağlantılar & Ek Sinyaller', 'Links & extra signals')}</div>
										<ul class="dp-seo-kv-list">
											<li class="dp-seo-kv-item"><span class="dp-seo-kv-key">Toplam Link</span><span class="dp-seo-kv-val">{formatNumber(report()!.meta?.links?.total)}</span></li>
											<li class="dp-seo-kv-item"><span class="dp-seo-kv-key">İç Link</span><span class="dp-seo-kv-val">{formatNumber(report()!.meta?.links?.internal)}</span></li>
											<li class="dp-seo-kv-item"><span class="dp-seo-kv-key">Dış Link</span><span class="dp-seo-kv-val">{formatNumber(report()!.meta?.links?.external)}</span></li>
											<li class="dp-seo-kv-item"><span class="dp-seo-kv-key">Anchor Eksik</span><span class="dp-seo-kv-val">{formatNumber(report()!.meta?.links?.missingAnchorText)}</span></li>
											<li class="dp-seo-kv-item"><span class="dp-seo-kv-key">Teknoloji Tespiti</span><span class="dp-seo-kv-val">{report()!.techStack?.length ? report()!.techStack!.map((tech) => tech.name).join(', ') : '-'}</span></li>
										</ul>
									</div>
								</div>

								<Show when={report()!.assetBreakdown?.resources}>
									<div class="dp-seo-panel dp-seo-resource-panel">
										<div class="dp-seo-panel-head">Kaynak Dağılımı</div>
										<For
											each={[
												{ label: 'Script', data: report()!.assetBreakdown!.resources.scripts },
												{ label: 'CSS', data: report()!.assetBreakdown!.resources.stylesheets },
												{ label: 'Görsel', data: report()!.assetBreakdown!.resources.images },
												{ label: 'Font', data: report()!.assetBreakdown!.resources.fonts },
												{ label: 'Diğer', data: report()!.assetBreakdown!.resources.other },
											]}
										>
											{(resource) => (
												<div class="dp-seo-resource-row">
													<span class="dp-seo-resource-title">{resource.label}</span>
													<span class="dp-seo-resource-details">{formatNumber(resource.data.count)} istek · {formatBytes(resource.data.knownBytes)} · {resource.data.externalCount} harici</span>
												</div>
											)}
										</For>
									</div>
								</Show>
							</div>
						</Show>

						<Show when={activeTab() === 'passed'}>
							<div class="dp-seo-tab-pane active">
								<div class="dp-seo-tab-title">
									<h2>Geçen Kontroller</h2>
									<span>Bu liste yalnızca doğrulanabilen olumlu sinyalleri gösterir.</span>
								</div>
								<For each={passedAudits()} fallback={<div class="dp-seo-panel"><div class="dp-seo-empty">Bu raporda gösterilecek doğrulanmış olumlu sinyal bulunamadı.</div></div>}>
									{(item) => (
										<div class="dp-seo-pass-card">
											<div class="dp-seo-pass-icon">[OK]</div>
											<div class="dp-seo-pass-content">
												<h4>{item.title}</h4>
												<p>{item.detail}</p>
											</div>
											<div class="dp-seo-pass-tag">{CATEGORY_META[item.category].label.toUpperCase()}</div>
										</div>
									)}
								</For>
							</div>
						</Show>
					</div>
				</section>

				<section class="dp-seo-footer-note">
					DataPulse SEO audit arayuzu • Yerel sandbox • {safeDomain(props.analyzedUrl || report()!.url)} • {formatDate(props.analyzedAt)}
				</section>
			</div>
		</Show>
	);
}
