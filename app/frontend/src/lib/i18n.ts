export const defaultLocale = 'tr' as const;

export const i18nMessages = {
	tr: {
		nav: {
			dashboard: 'Kripto',
			news: 'Haberler',
			social: 'Sosyal Medya',
			scraper: 'Scraper',
			seo: 'SEO',
			priceTracker: 'Fiyat',
			apiMonitor: 'API',
			dashboardBuilder: 'Dashboard',
		},
		page: {
			dashboard: 'Dashboard - DataPulse',
			homeMeta:
				'DataPulse, gerçek zamanlı kripto, haber, sosyal medya, scraper, SEO, fiyat ve API izleme modüllerini tek yerde toplar.',
			news: 'Haberler - DataPulse',
			social: 'Sosyal Medya - DataPulse',
			scraper: 'Web Kazıyıcı - DataPulse',
			seo: 'SEO Analiz - DataPulse',
			priceTracker: 'Fiyat Takibi - DataPulse',
			apiMonitor: 'API Sağlığı - DataPulse',
			dashboardBuilder: 'Dashboard Builder - DataPulse',
		},
		langLabel: 'Dil',
		session: {
			admin: 'Admin oturumu aktif',
			demoActive: 'Demo aktif: {minutes} dakika kaldı',
			requests: '{count} istek / {minutes} dk',
			scrapes: '{count} scrape / {minutes} dk',
			analysis: '{count} analiz / {minutes} dk',
		},
		common: {
			sessionExpiredKicker: 'Oturum Süresi Doldu',
			sessionExpiredTitle: 'Demo oturumu sonlandı',
			sessionExpiredBody:
				'Oturum veya istek limiti tükenince akış kilitlenir. Yeni bir demo başlatarak tekrar giriş yapabilirsiniz.',
			sessionExpiredRestart: 'Yeni Demo Başlat',
		},
	},
	en: {
		nav: {
			dashboard: 'Crypto',
			news: 'News',
			social: 'Social Media',
			scraper: 'Scraper',
			seo: 'SEO',
			priceTracker: 'Pricing',
			apiMonitor: 'API',
			dashboardBuilder: 'Dashboard',
		},
		page: {
			dashboard: 'Dashboard - DataPulse',
			homeMeta:
				'DataPulse unifies real-time crypto, news, social media, scraper, SEO, pricing, and API monitoring modules in one place.',
			news: 'News - DataPulse',
			social: 'Social Media - DataPulse',
			scraper: 'Web Scraper - DataPulse',
			seo: 'SEO Analysis - DataPulse',
			priceTracker: 'Price Tracking - DataPulse',
			apiMonitor: 'API Health - DataPulse',
			dashboardBuilder: 'Dashboard Builder - DataPulse',
		},
		langLabel: 'Language',
		session: {
			admin: 'Admin session active',
			demoActive: 'Demo active: {minutes} minutes left',
			requests: '{count} requests / {minutes} min',
			scrapes: '{count} scrapes / {minutes} min',
			analysis: '{count} analyses / {minutes} min',
		},
		common: {
			sessionExpiredKicker: 'Session Expired',
			sessionExpiredTitle: 'Demo session ended',
			sessionExpiredBody:
				'When the session or request limit runs out, the flow is locked. Start a new demo to continue.',
			sessionExpiredRestart: 'Start New Demo',
		},
	},
} as const;

export type DataPulseLocale = keyof typeof i18nMessages;
