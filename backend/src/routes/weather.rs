use axum::extract::{ConnectInfo, Path, State};
use axum::http::StatusCode;
use axum::Json;
use std::net::SocketAddr;

use crate::mock_data::weather;
use crate::state::AppState;

pub async fn get_weather(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Path(city): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    state
        .rate_limiter
        .check_rate_limit(&addr.ip().to_string(), "weather")?;

    let data = weather::get_weather(&city);
    Ok(Json(serde_json::json!(data)))
}
