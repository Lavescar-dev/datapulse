use axum::extract::{ConnectInfo, State};
use axum::http::StatusCode;
use axum::Json;
use std::net::SocketAddr;

use crate::mock_data::crypto;
use crate::state::AppState;

pub async fn get_prices(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    state
        .rate_limiter
        .check_rate_limit(&addr.ip().to_string(), "crypto/prices")?;

    let prices = crypto::get_prices();
    Ok(Json(serde_json::json!({
        "count": prices.len(),
        "prices": prices,
        "currency": "USD",
    })))
}
