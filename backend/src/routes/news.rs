use axum::extract::{ConnectInfo, State};
use axum::http::StatusCode;
use axum::Json;
use std::net::SocketAddr;

use crate::mock_data::news;
use crate::state::AppState;

pub async fn get_feed(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    state
        .rate_limiter
        .check_rate_limit(&addr.ip().to_string(), "news/feed")?;

    let articles = news::get_feed();
    Ok(Json(serde_json::json!({
        "count": articles.len(),
        "articles": articles,
    })))
}
