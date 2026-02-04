use axum::extract::{ConnectInfo, Path, State};
use axum::http::StatusCode;
use axum::Json;
use std::net::SocketAddr;

use crate::mock_data::social;
use crate::state::AppState;

pub async fn get_trends(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    state
        .rate_limiter
        .check_rate_limit(&addr.ip().to_string(), "social/trends")?;

    let trends = social::get_trends();
    Ok(Json(serde_json::json!({
        "count": trends.len(),
        "trends": trends,
    })))
}

pub async fn get_sentiment(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Path(topic): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    state
        .rate_limiter
        .check_rate_limit(&addr.ip().to_string(), "social/sentiment")?;

    let sentiment = social::get_sentiment(&topic);
    Ok(Json(serde_json::json!(sentiment)))
}
