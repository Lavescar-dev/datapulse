use axum::extract::{ConnectInfo, Path, State};
use axum::http::StatusCode;
use axum::Json;
use std::net::SocketAddr;

use crate::mock_data::ecommerce;
use crate::state::AppState;

pub async fn get_products(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    state
        .rate_limiter
        .check_rate_limit(&addr.ip().to_string(), "ecommerce/products")?;

    let products = ecommerce::get_products();
    Ok(Json(serde_json::json!({
        "count": products.len(),
        "products": products,
    })))
}

pub async fn get_prices(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    Path(product_id): Path<String>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    state
        .rate_limiter
        .check_rate_limit(&addr.ip().to_string(), "ecommerce/prices")?;

    let history = ecommerce::get_price_trends(&product_id);
    Ok(Json(serde_json::json!({
        "product_id": product_id,
        "data_points": history.len(),
        "price_history": history,
    })))
}
