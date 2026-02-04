mod config;
mod mock_data;
mod rate_limiter;
mod routes;
mod state;

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use axum::http::{HeaderName, HeaderValue, Method};
use axum::middleware::{self, Next};
use axum::response::Response;
use axum::routing::{get, post};
use axum::Router;
use tower_http::cors::{Any, CorsLayer};

use config::RateLimitConfig;
use rate_limiter::RateLimiter;
use state::AppState;

/// Middleware that adds X-Demo-Mode: true header to all responses.
async fn demo_header_middleware(request: axum::extract::Request, next: Next) -> Response {
    let mut response = next.run(request).await;
    response.headers_mut().insert(
        HeaderName::from_static("x-demo-mode"),
        HeaderValue::from_static("true"),
    );
    response
}

#[tokio::main]
async fn main() {
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8081);

    let rate_limiter = Arc::new(RateLimiter::new(RateLimitConfig::default()));

    // Spawn background task to periodically clean up expired rate limit entries.
    let cleanup_limiter = Arc::clone(&rate_limiter);
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(300)).await;
            cleanup_limiter.cleanup();
        }
    });

    let state = AppState { rate_limiter };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers(Any);

    let app = Router::new()
        // Dashboard
        .route("/api/dashboard/stats", get(routes::dashboard::get_stats))
        // Scrapers
        .route("/api/scrapers/status", get(routes::scrapers::get_status))
        .route(
            "/api/scrapers/{id}/start",
            post(routes::scrapers::start_scraper),
        )
        // E-commerce
        .route(
            "/api/ecommerce/products",
            get(routes::ecommerce::get_products),
        )
        .route(
            "/api/ecommerce/prices/{product_id}",
            get(routes::ecommerce::get_prices),
        )
        // Social
        .route("/api/social/trends", get(routes::social::get_trends))
        .route(
            "/api/social/sentiment/{topic}",
            get(routes::social::get_sentiment),
        )
        // News
        .route("/api/news/feed", get(routes::news::get_feed))
        // Crypto
        .route("/api/crypto/prices", get(routes::crypto::get_prices))
        // Weather
        .route("/api/weather/{city}", get(routes::weather::get_weather))
        .layer(middleware::from_fn(demo_header_middleware))
        .layer(cors)
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    println!("DataPulse API running on http://0.0.0.0:{}", port);
    println!("Demo mode: all data is synthetic");

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
    .unwrap();
}
