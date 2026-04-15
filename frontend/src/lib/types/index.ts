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
	data_count: number; // Backend uses data_count not data_points
	category: string;
	schedule: string;
	avg_duration_secs: number;
}

export interface Product {
	id: string;
	name: string;
	source: string;
	category: string;
	price: number;
	currency: string;
	in_stock: boolean;
	price_history: Array<{ date: string; price: number }>;
}

export interface SocialTrend {
	id: string;
	name: string; // Backend uses 'name' not 'topic'
	hashtag: string;
	mention_count: number; // Backend uses 'mention_count' not 'mentions'
	sentiment: {
		positive: number;
		negative: number;
		neutral: number;
	};
	platform: string;
	trending_since: string;
	peak_hour: string;
}

export interface NewsArticle {
	id: string;
	title: string;
	source: string;
	published_at: string; // Backend uses published_at
	category: string;
	summary: string;
	url: string;
	author: string;
	image_url: string;
	read_time_minutes: number;
}

export interface CryptoPrice {
	id: string;
	symbol: string;
	name: string;
	current_price: number; // Backend uses current_price
	change_24h: number;
	change_24h_percent: number; // Backend provides this
	change_7d_percent: number;
	market_cap: number;
	volume_24h: number;
	rank: number;
	currency: string;
	sparkline: number[];
}

export interface WeatherData {
	city: string;
	country: string;
	current: {
		temperature_c: number; // Backend uses temperature_c
		feels_like_c: number; // Backend uses feels_like_c
		humidity: number;
		wind_speed_kmh: number; // Backend uses wind_speed_kmh
		wind_direction: string;
		pressure_hpa: number;
		visibility_km: number;
		uv_index: number;
		condition: string;
	};
	forecast: WeatherForecast[];
	last_updated: string;
}

export interface WeatherForecast {
	date: string;
	high_c: number; // Backend uses high_c
	low_c: number; // Backend uses low_c
	condition: string;
	precipitation_chance: number; // Backend uses precipitation_chance
	humidity: number;
	wind_speed_kmh: number;
}
