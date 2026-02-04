use axum::extract::{ConnectInfo, State};
use axum::http::StatusCode;
use axum::Json;
use chrono::Utc;
use serde::Serialize;
use std::net::SocketAddr;

use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct DashboardStats {
    pub total_scrapers: u32,
    pub active_scrapers: u32,
    pub data_points: u64,
    pub last_updated: String,
    pub uptime_percent: f64,
    pub scrapers_status: Vec<ScraperSummary>,
    pub requests_today: u64,
    pub avg_response_time_ms: u32,
}

#[derive(Debug, Serialize)]
pub struct ScraperSummary {
    pub name: String,
    pub status: String,
    pub category: String,
}

pub async fn get_stats(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
) -> Result<Json<DashboardStats>, StatusCode> {
    state
        .rate_limiter
        .check_rate_limit(&addr.ip().to_string(), "dashboard/stats")?;

    let now = Utc::now();

    let scrapers_status = vec![
        ScraperSummary {
            name: "E-Commerce Price Tracker".to_string(),
            status: "running".to_string(),
            category: "ecommerce".to_string(),
        },
        ScraperSummary {
            name: "Social Media Trends".to_string(),
            status: "running".to_string(),
            category: "social".to_string(),
        },
        ScraperSummary {
            name: "News Aggregator".to_string(),
            status: "running".to_string(),
            category: "news".to_string(),
        },
        ScraperSummary {
            name: "Crypto Market Data".to_string(),
            status: "running".to_string(),
            category: "crypto".to_string(),
        },
        ScraperSummary {
            name: "Weather Data Collector".to_string(),
            status: "running".to_string(),
            category: "weather".to_string(),
        },
        ScraperSummary {
            name: "Job Listings Monitor".to_string(),
            status: "paused".to_string(),
            category: "jobs".to_string(),
        },
        ScraperSummary {
            name: "Real Estate Tracker".to_string(),
            status: "paused".to_string(),
            category: "realestate".to_string(),
        },
        ScraperSummary {
            name: "Flight Price Monitor".to_string(),
            status: "error".to_string(),
            category: "travel".to_string(),
        },
    ];

    Ok(Json(DashboardStats {
        total_scrapers: 8,
        active_scrapers: 5,
        data_points: 1_234_567,
        last_updated: now.to_rfc3339(),
        uptime_percent: 99.7,
        scrapers_status,
        requests_today: 4_821,
        avg_response_time_ms: 142,
    }))
}
