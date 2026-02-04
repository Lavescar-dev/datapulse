use axum::extract::{ConnectInfo, Path, State};
use axum::http::StatusCode;
use axum::response::sse::{Event, KeepAlive, Sse};
use axum::response::IntoResponse;
use axum::Json;
use chrono::Utc;
use rand::Rng;
use serde::Serialize;
use std::convert::Infallible;
use std::net::SocketAddr;
use std::time::Duration;
use tokio_stream::wrappers::ReceiverStream;

use crate::state::AppState;

#[derive(Debug, Serialize)]
pub struct ScraperInfo {
    pub id: String,
    pub name: String,
    pub status: String,
    pub last_run: String,
    pub data_count: u64,
    pub success_rate: f64,
    pub category: String,
    pub schedule: String,
    pub avg_duration_secs: u32,
}

#[derive(Debug, Serialize)]
pub struct ScraperProgress {
    pub step: u32,
    pub total_steps: u32,
    pub message: String,
    pub progress_percent: f64,
    pub records_found: u32,
    pub status: String,
}

pub async fn get_status(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
) -> Result<Json<Vec<ScraperInfo>>, StatusCode> {
    state
        .rate_limiter
        .check_rate_limit(&addr.ip().to_string(), "scrapers/status")?;

    let now = Utc::now();
    let mut rng = rand::thread_rng();

    let scrapers = vec![
        ("scraper-001", "E-Commerce Price Tracker", "running", 45_230, 99.2, "ecommerce", "Every 6h", 180),
        ("scraper-002", "Social Media Trends", "running", 128_400, 97.8, "social", "Every 1h", 45),
        ("scraper-003", "News Aggregator", "running", 67_890, 99.5, "news", "Every 30m", 30),
        ("scraper-004", "Crypto Market Data", "running", 312_000, 99.9, "crypto", "Every 5m", 8),
        ("scraper-005", "Weather Data Collector", "running", 89_100, 98.7, "weather", "Every 1h", 20),
        ("scraper-006", "Job Listings Monitor", "paused", 23_450, 96.3, "jobs", "Every 12h", 300),
        ("scraper-007", "Real Estate Tracker", "paused", 15_670, 94.1, "realestate", "Every 24h", 600),
        ("scraper-008", "Flight Price Monitor", "error", 8_900, 87.5, "travel", "Every 3h", 120),
    ];

    let infos: Vec<ScraperInfo> = scrapers
        .into_iter()
        .map(|(id, name, status, count, rate, cat, sched, dur)| {
            let hours_ago = rng.gen_range(0..12);
            let last_run = now - chrono::Duration::hours(hours_ago);

            ScraperInfo {
                id: id.to_string(),
                name: name.to_string(),
                status: status.to_string(),
                last_run: last_run.to_rfc3339(),
                data_count: (count as f64 * rng.gen_range(0.98..1.02)) as u64,
                success_rate: ((rate as f64 + rng.gen_range(-0.5_f64..0.5)) * 10.0).round() / 10.0,
                category: cat.to_string(),
                schedule: sched.to_string(),
                avg_duration_secs: dur,
            }
        })
        .collect();

    Ok(Json(infos))
}

pub async fn start_scraper(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, StatusCode> {
    state
        .rate_limiter
        .check_rate_limit(&addr.ip().to_string(), "scrapers/start")?;

    let (tx, rx) = tokio::sync::mpsc::channel::<Result<Event, Infallible>>(32);

    let scraper_name = match id.as_str() {
        "scraper-001" => "E-Commerce Price Tracker",
        "scraper-002" => "Social Media Trends",
        "scraper-003" => "News Aggregator",
        "scraper-004" => "Crypto Market Data",
        "scraper-005" => "Weather Data Collector",
        "scraper-006" => "Job Listings Monitor",
        "scraper-007" => "Real Estate Tracker",
        "scraper-008" => "Flight Price Monitor",
        _ => "Unknown Scraper",
    };

    let name = scraper_name.to_string();

    // Build the steps outside of the spawned task so that the non-Send
    // ThreadRng is not held across .await points.
    let total_records: u32 = {
        let mut rng = rand::thread_rng();
        rng.gen_range(150..400)
    };

    let steps: Vec<(String, u32)> = vec![
        (format!("Initializing {}...", name), 0),
        ("Connecting to data source...".to_string(), 0),
        ("Authenticating session...".to_string(), 0),
        ("Fetching page 1/5...".to_string(), total_records / 5),
        ("Fetching page 2/5...".to_string(), total_records * 2 / 5),
        ("Fetching page 3/5...".to_string(), total_records * 3 / 5),
        ("Fetching page 4/5...".to_string(), total_records * 4 / 5),
        ("Fetching page 5/5...".to_string(), total_records),
        (format!("Processing {} records...", total_records), total_records),
        (format!("Validating data integrity..."), total_records),
        (format!("Complete: {} new records stored", total_records), total_records),
    ];

    let total_steps = steps.len() as u32;

    tokio::spawn(async move {
        for (i, (message, records)) in steps.into_iter().enumerate() {
            let step_num = (i + 1) as u32;
            let progress = ScraperProgress {
                step: step_num,
                total_steps,
                message,
                progress_percent: (step_num as f64 / total_steps as f64 * 100.0).round(),
                records_found: records,
                status: if step_num == total_steps {
                    "complete".to_string()
                } else {
                    "running".to_string()
                },
            };

            let data = serde_json::to_string(&progress).unwrap();
            if tx.send(Ok(Event::default().data(data))).await.is_err() {
                break;
            }
            tokio::time::sleep(Duration::from_millis(500)).await;
        }
    });

    Ok(Sse::new(ReceiverStream::new(rx)).keep_alive(KeepAlive::default()))
}
