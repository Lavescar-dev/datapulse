export interface DashboardStats {
	total_scrapers: number;
	active_scrapers: number;
	data_points: number;
	uptime: number;
	scrapers: ScraperStatus[];
}

export interface ScraperStatus {
	id: string;
	name: string;
	status: 'running' | 'idle' | 'error' | 'paused';
	last_run: string;
	success_rate: number;
	data_points: number;
	category: string;
}

export interface Product {
	id: string;
	name: string;
	source: string;
	price: number;
	change_24h: number;
	rating: number;
	price_history: number[];
}

export interface SocialTrend {
	id: string;
	topic: string;
	mentions: number;
	sentiment: {
		positive: number;
		negative: number;
		neutral: number;
	};
	platform: string;
	trending_since: string;
}

export interface NewsArticle {
	id: string;
	title: string;
	source: string;
	published: string;
	category: string;
	summary: string;
	url: string;
}

export interface CryptoPrice {
	id: string;
	symbol: string;
	name: string;
	price: number;
	change_24h: number;
	market_cap: number;
	sparkline: number[];
}

export interface WeatherData {
	city: string;
	current: {
		temp: number;
		feels_like: number;
		humidity: number;
		wind_speed: number;
		condition: string;
		icon: string;
	};
	forecast: WeatherForecast[];
}

export interface WeatherForecast {
	date: string;
	temp_high: number;
	temp_low: number;
	condition: string;
	icon: string;
	precipitation: number;
}
