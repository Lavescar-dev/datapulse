mod cache;
mod config;
mod demo_data;
mod job_store;
mod monitor_store;
mod models;
mod notification_store;
mod price_store;
mod rate_limit;
mod session;

use std::net::SocketAddr;

use axum::{
    extract::{Extension, Path, Query, Request, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    middleware::{from_fn_with_state, Next},
    response::{IntoResponse, Response},
    routing::{get, post, put},
    Json, Router,
};
use serde_json::Value;
use tower_http::cors::{Any, CorsLayer};

use crate::{
    config::Config,
    demo_data::{
        build_dashboard_from_template, build_monitor_endpoint_from_values,
        build_monitor_endpoints_from_values, build_monitor_summary_from_values,
        build_price_export_csv, build_price_product_payload, build_price_products_payload,
        build_price_stats_payload, build_template_payload, build_templates_payload,
        build_widget_payload, seed_price_products,
    },
    models::{
        AdminCredentials, AdminLoginResponse, ErrorResponse, HealthResponse, SessionStartResponse,
    },
    job_store::DemoJobStore,
    monitor_store::MonitorStore,
    notification_store::{NotificationQuery, NotificationStore},
    price_store::PriceStore,
    cache::CacheStore,
    rate_limit::RateLimitStore,
    session::SessionManager,
};

#[derive(Clone)]
struct AppState {
    config: Config,
    rate_limit: RateLimitStore,
    session_manager: SessionManager,
    cache_store: CacheStore,
    notification_store: NotificationStore,
    job_store: DemoJobStore,
    monitor_store: MonitorStore,
    price_store: PriceStore,
}

const DISABLED_REMAINING_SESSIONS: u32 = 999;

#[tokio::main]
async fn main() {
    let config = Config::from_env();

    if config.admin_password == "change_me_in_production" {
        eprintln!("WARNING: using default admin password; set ADMIN_PASSWORD before production.");
    }

    if config.jwt_secret == "default_secret_change_in_production" {
        eprintln!("WARNING: using default JWT secret; set JWT_SECRET before production.");
    }

    let cache_store = CacheStore::new();
    let state = AppState {
        rate_limit: RateLimitStore::new(config.demo_sessions_per_ip),
        session_manager: SessionManager::new(&config),
        monitor_store: MonitorStore::new(&cache_store),
        price_store: PriceStore::new(seed_price_products(&cache_store)),
        cache_store,
        notification_store: NotificationStore::new(),
        job_store: DemoJobStore::new(),
        config,
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .route("/health", get(health))
        .route("/api/session/start", post(start_session))
        .route("/api/session/status", get(session_status))
        .route("/api/admin/login", post(admin_login))
        .route("/api/news", get(news_feed))
        .route("/api/social", get(social_feed))
        .route("/api/crypto/coins", get(crypto_feed))
        .route("/api/price/products", get(price_products).post(price_products_add))
        .route("/api/price/products/{id}", get(price_product).delete(price_product_delete))
        .route("/api/price/products/{id}/stats", get(price_product_stats))
        .route("/api/price/export/{id}", get(price_export))
        .route("/api/monitor/endpoints", get(monitor_endpoints).post(monitor_endpoint_add))
        .route(
            "/api/monitor/endpoints/{id}",
            get(monitor_endpoint).delete(monitor_endpoint_delete),
        )
        .route("/api/monitor/endpoints/{id}/check", post(monitor_endpoint_check))
        .route("/api/monitor/summary", get(monitor_summary))
        .route("/api/notifications", get(notifications))
        .route("/api/notifications/count", get(notification_count))
        .route("/api/notifications/read-all", put(notification_read_all))
        .route("/api/notifications/{id}/read", put(notification_mark_read))
        .route("/api/notifications/{id}/archive", put(notification_archive))
        .route("/api/scraper/submit", post(scraper_submit))
        .route("/api/scraper/status/{job_id}", get(scraper_status))
        .route("/api/scraper/result/{job_id}", get(scraper_result))
        .route("/api/scraper/examples", get(scraper_examples))
        .route("/api/scraper/examples/{example_id}", get(scraper_example))
        .route("/api/seo/analyze", post(seo_analyze))
        .route("/api/seo/status/{job_id}", get(seo_status))
        .route("/api/seo/result/{job_id}", get(seo_result))
        .route("/api/builder/templates", get(builder_templates))
        .route("/api/builder/templates/{id}", get(builder_template))
        .route(
            "/api/builder/dashboards/from-template/{template_id}",
            post(builder_dashboard_from_template),
        )
        .route("/api/builder/widgets/data", post(builder_widgets_data))
        .layer(from_fn_with_state(state.clone(), attach_client_ip))
        .layer(cors)
        .with_state(state.clone());

    let addr = SocketAddr::from((
        state
            .config
            .host
            .parse::<std::net::IpAddr>()
            .unwrap_or_else(|_| "127.0.0.1".parse().expect("loopback ip")),
        state.config.port,
    ));

    println!("DataPulse Rust backend bootstrap listening on http://{}", addr);
    println!(
        "Demo session rate limit: {}",
        if state.config.demo_rate_limit_enabled {
            format!("enabled ({} per IP / 24h)", state.config.demo_sessions_per_ip)
        } else {
            "disabled".to_string()
        }
    );

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .expect("failed to bind listener");

    axum::serve(listener, app)
        .await
        .expect("server crashed");
}

async fn attach_client_ip(
    State(_state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Response {
    let client_ip = extract_client_ip(request.headers());
    request.extensions_mut().insert(client_ip);
    next.run(request).await
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        service: "datapulse-backend-rust-bootstrap",
        version: env!("CARGO_PKG_VERSION"),
    })
}

async fn start_session(
    State(state): State<AppState>,
    Extension(client_ip): Extension<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    if state.config.demo_rate_limit_enabled && state.rate_limit.is_rate_limited(&client_ip) {
        return Err((
            StatusCode::TOO_MANY_REQUESTS,
            Json(ErrorResponse {
                error: "Rate limit exceeded",
                message: format!(
                    "Maximum {} demo sessions per day.",
                    state.config.demo_sessions_per_ip
                ),
            }),
        ));
    }

    let token = state
        .session_manager
        .create_demo_session(Some(client_ip.clone()))
        .map_err(internal_error)?;

    if state.config.demo_rate_limit_enabled {
        state.rate_limit.record_attempt(&client_ip);
    }

    let claims = state
        .session_manager
        .verify(&token)
        .ok_or_else(|| internal_error_message("Failed to verify fresh session token"))?;

    let status = state.session_manager.status(&claims);
    let remaining_sessions_today = if state.config.demo_rate_limit_enabled {
        state.rate_limit.remaining_sessions(&client_ip)
    } else {
        DISABLED_REMAINING_SESSIONS
    };

    let cookie = build_cookie("datapulse_session", &token, 30 * 60);

    Ok((
        [(header::SET_COOKIE, cookie)],
        Json(SessionStartResponse {
            success: true,
            session: status,
            remaining_sessions_today,
        }),
    ))
}

async fn session_status(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let token = extract_cookie_token(&headers, "datapulse_session").ok_or_else(|| {
        (
            StatusCode::UNAUTHORIZED,
            Json(ErrorResponse {
                error: "Unauthorized",
                message: "No active session cookie found.".to_string(),
            }),
        )
    })?;

    let claims = state.session_manager.verify(&token).ok_or_else(|| {
        (
            StatusCode::UNAUTHORIZED,
            Json(ErrorResponse {
                error: "Unauthorized",
                message: "Session is invalid or expired.".to_string(),
            }),
        )
    })?;

    Ok(Json(state.session_manager.status(&claims)))
}

async fn admin_login(
    State(state): State<AppState>,
    Extension(client_ip): Extension<String>,
    Json(payload): Json<AdminCredentials>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    if payload.username != state.config.admin_username || payload.password != state.config.admin_password {
        return Err((
            StatusCode::UNAUTHORIZED,
            Json(ErrorResponse {
                error: "Invalid credentials",
                message: "Admin username or password is incorrect.".to_string(),
            }),
        ));
    }

    let token = state
        .session_manager
        .create_admin_session(Some(client_ip))
        .map_err(internal_error)?;

    let cookie = build_cookie("datapulse_session", &token, 24 * 60 * 60);

    Ok((
        [(header::SET_COOKIE, cookie)],
        Json(AdminLoginResponse {
            success: true,
            message: "Admin login successful",
            username: state.config.admin_username.clone(),
        }),
    ))
}

async fn news_feed(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    require_session(&state, &headers)?;
    let payload = state
        .cache_store
        .read_json("news.json")
        .map_err(|message| internal_error_message(&message))?;

    Ok(Json(payload))
}

async fn social_feed(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    require_session(&state, &headers)?;
    let payload = state
        .cache_store
        .read_json("social.json")
        .map_err(|message| internal_error_message(&message))?;

    Ok(Json(payload))
}

async fn crypto_feed(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    require_session(&state, &headers)?;
    let payload = state
        .cache_store
        .read_json("crypto.json")
        .map_err(|message| internal_error_message(&message))?;

    Ok(Json(payload))
}

async fn price_products(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    require_session(&state, &headers)?;
    let payload = build_price_products_payload(&state.price_store.list())
        .map_err(|message| internal_error_message(&message))?;
    Ok(Json(payload))
}

async fn price_products_add(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<Value>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let claims = require_claims(&state, &headers)?;
    if !claims.is_admin {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "Forbidden",
                message: "Admin access required.".to_string(),
            }),
        ));
    }

    let url = payload.get("url").and_then(Value::as_str).ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Bad request",
                message: "URL is required.".to_string(),
            }),
        )
    })?;

    let product = state.price_store.add_from_url(url).ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Bad request",
                message: "Unsupported marketplace URL.".to_string(),
            }),
        )
    })?;

    Ok((StatusCode::CREATED, Json(serde_json::json!({
        "success": true,
        "message": "Product added successfully",
        "product": product,
    }))))
}

async fn price_product(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    require_session(&state, &headers)?;
    let payload = build_price_product_payload(&state.price_store.list(), &id).ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "Not found",
                message: format!("Product {} not found.", id),
            }),
        )
    })?;
    Ok(Json(payload))
}

async fn price_product_delete(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let claims = require_claims(&state, &headers)?;
    if !claims.is_admin {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "Forbidden",
                message: "Admin access required.".to_string(),
            }),
        ));
    }

    if !state.price_store.remove(&id) {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "Not found",
                message: format!("Product {} not found.", id),
            }),
        ));
    }

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Product removed successfully",
    })))
}

async fn price_product_stats(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    require_session(&state, &headers)?;
    let payload = build_price_stats_payload(&state.price_store.list(), &id).ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "Not found",
                message: format!("Stats for product {} not found.", id),
            }),
        )
    })?;
    Ok(Json(payload))
}

async fn price_export(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let claims = require_claims(&state, &headers)?;
    if !claims.is_admin {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "Forbidden",
                message: "Admin access required.".to_string(),
            }),
        ));
    }
    let csv = build_price_export_csv(&state.price_store.list(), &id).ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "Not found",
                message: format!("Export data for product {} not found.", id),
            }),
        )
    })?;

    Ok((
        [
            (header::CONTENT_TYPE, HeaderValue::from_static("text/csv; charset=utf-8")),
            (
                header::CONTENT_DISPOSITION,
                HeaderValue::from_str(&format!("attachment; filename=\"price_history_{}.csv\"", id))
                    .unwrap_or_else(|_| HeaderValue::from_static("attachment")),
            ),
        ],
        csv,
    ))
}

async fn monitor_endpoints(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    require_session(&state, &headers)?;
    let payload = build_monitor_endpoints_from_values(&state.monitor_store.list())
        .map_err(|message| internal_error_message(&message))?;
    Ok(Json(payload))
}

async fn monitor_endpoint_add(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<Value>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let claims = require_claims(&state, &headers)?;
    if !claims.is_admin {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "Forbidden",
                message: "Admin access required.".to_string(),
            }),
        ));
    }

    let url = payload.get("url").and_then(Value::as_str).ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Bad request",
                message: "URL is required.".to_string(),
            }),
        )
    })?;

    let endpoint = state.monitor_store.add(
        payload.get("name").and_then(Value::as_str).unwrap_or("New Endpoint").to_string(),
        url.to_string(),
        payload.get("method").and_then(Value::as_str).unwrap_or("GET").to_string(),
        payload.get("checkInterval").and_then(Value::as_u64).unwrap_or(5),
    );

    Ok((StatusCode::CREATED, Json(serde_json::json!({
        "success": true,
        "message": "Endpoint added successfully",
        "endpoint": endpoint,
    }))))
}

async fn monitor_endpoint(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    require_session(&state, &headers)?;
    let payload = build_monitor_endpoint_from_values(&state.monitor_store.list(), &id)
        .map_err(|message| internal_error_message(&message))?
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: "Not found",
                    message: format!("Endpoint {} not found.", id),
                }),
            )
        })?;

    Ok(Json(payload))
}

async fn monitor_endpoint_delete(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let claims = require_claims(&state, &headers)?;
    if !claims.is_admin {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "Forbidden",
                message: "Admin access required.".to_string(),
            }),
        ));
    }

    if !state.monitor_store.remove(&id) {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "Not found",
                message: format!("Endpoint {} not found.", id),
            }),
        ));
    }

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Endpoint removed successfully",
    })))
}

async fn monitor_endpoint_check(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let claims = require_claims(&state, &headers)?;
    if !claims.is_admin {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "Forbidden",
                message: "Admin access required.".to_string(),
            }),
        ));
    }

    let endpoint = state.monitor_store.check(&id).ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "Not found",
                message: format!("Endpoint {} not found.", id),
            }),
        )
    })?;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Health check completed",
        "endpoint": endpoint,
    })))
}

async fn monitor_summary(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    require_session(&state, &headers)?;
    let payload = build_monitor_summary_from_values(&state.monitor_store.list())
        .map_err(|message| internal_error_message(&message))?;
    Ok(Json(payload))
}

async fn builder_templates(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    require_session(&state, &headers)?;
    Ok(Json(build_templates_payload()))
}

async fn builder_template(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    require_session(&state, &headers)?;
    let payload = build_template_payload(&id).ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "Not found",
                message: format!("Template {} not found.", id),
            }),
        )
    })?;

    Ok(Json(payload))
}

async fn builder_dashboard_from_template(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(template_id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let claims = require_claims(&state, &headers)?;
    let created_by = if claims.is_admin { "admin" } else { "demo" };

    let payload = build_dashboard_from_template(&template_id, created_by).ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "Not found",
                message: format!("Template {} not found.", template_id),
            }),
        )
    })?;

    Ok((StatusCode::CREATED, Json(payload)))
}

async fn builder_widgets_data(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(widgets): Json<Vec<Value>>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    require_session(&state, &headers)?;
    let payload = build_widget_payload(&state.cache_store, &widgets)
        .map_err(|message| internal_error_message(&message))?;
    Ok(Json(payload))
}

async fn notifications(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(query): Query<NotificationQuery>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    require_session(&state, &headers)?;
    let notifications = state.notification_store.list(&query);
    Ok(Json(serde_json::json!({
        "success": true,
        "count": notifications.len(),
        "notifications": notifications,
    })))
}

async fn notification_count(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    require_session(&state, &headers)?;
    Ok(Json(serde_json::json!({
        "success": true,
        "unreadCount": state.notification_store.unread_count(),
    })))
}

async fn notification_mark_read(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    require_session(&state, &headers)?;
    let notification = state.notification_store.mark_as_read(&id).ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "Not found",
                message: format!("Notification {} not found.", id),
            }),
        )
    })?;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Notification marked as read",
        "notification": notification,
    })))
}

async fn notification_read_all(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    require_session(&state, &headers)?;
    let count = state.notification_store.mark_all_as_read();
    Ok(Json(serde_json::json!({
        "success": true,
        "message": format!("{} notifications marked as read", count),
        "count": count,
    })))
}

async fn notification_archive(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    require_session(&state, &headers)?;
    let notification = state.notification_store.archive(&id).ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "Not found",
                message: format!("Notification {} not found.", id),
            }),
        )
    })?;

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Notification archived",
        "notification": notification,
    })))
}

async fn scraper_submit(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<Value>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    require_session(&state, &headers)?;
    let url = payload
        .get("url")
        .and_then(Value::as_str)
        .ok_or_else(|| {
            (
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: "Bad request",
                    message: "URL is required.".to_string(),
                }),
            )
        })?;

    let selector = payload.get("selector").and_then(Value::as_str).map(str::to_string);
    let auto_detect = payload
        .get("autoDetect")
        .and_then(Value::as_bool)
        .unwrap_or(true);

    let job_id = state
        .job_store
        .submit_scrape_job(url.to_string(), selector, auto_detect);

    Ok(Json(serde_json::json!({
        "success": true,
        "jobId": job_id,
        "message": "Scrape job queued successfully",
    })))
}

async fn scraper_status(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(job_id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    require_session(&state, &headers)?;
    let status = state.job_store.status(&job_id).ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "Not found",
                message: format!("Scrape job {} not found.", job_id),
            }),
        )
    })?;
    Ok(Json(status))
}

async fn scraper_result(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(job_id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    require_session(&state, &headers)?;
    let result = state.job_store.result(&job_id).ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "Not found",
                message: format!("Scrape result {} not found.", job_id),
            }),
        )
    })?;
    Ok(Json(result))
}

async fn scraper_examples(
    State(state): State<AppState>,
) -> Json<Value> {
    Json(state.job_store.scraper_examples())
}

async fn scraper_example(
    State(state): State<AppState>,
    Path(example_id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    let example = state.job_store.scraper_example(&example_id).ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "Not found",
                message: format!("Scraper example {} not found.", example_id),
            }),
        )
    })?;
    Ok(Json(example))
}

async fn seo_analyze(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<Value>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    require_session(&state, &headers)?;
    let url = payload
        .get("url")
        .and_then(Value::as_str)
        .ok_or_else(|| {
            (
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: "Bad request",
                    message: "URL is required.".to_string(),
                }),
            )
        })?;

    let job_id = state.job_store.submit_seo_job(url.to_string());

    Ok(Json(serde_json::json!({
        "success": true,
        "jobId": job_id,
        "message": "SEO analysis job queued successfully",
    })))
}

async fn seo_status(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(job_id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    require_session(&state, &headers)?;
    let status = state.job_store.status(&job_id).ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "Not found",
                message: format!("SEO job {} not found.", job_id),
            }),
        )
    })?;
    Ok(Json(status))
}

async fn seo_result(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(job_id): Path<String>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {
    require_session(&state, &headers)?;
    let result = state.job_store.result(&job_id).ok_or_else(|| {
        (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "Not found",
                message: format!("SEO result {} not found.", job_id),
            }),
        )
    })?;
    Ok(Json(result))
}

fn extract_client_ip(headers: &HeaderMap) -> String {
    headers
        .get("x-forwarded-for")
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.split(',').next())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .or_else(|| headers.get("x-real-ip").and_then(|value| value.to_str().ok()))
        .or_else(|| headers.get("cf-connecting-ip").and_then(|value| value.to_str().ok()))
        .unwrap_or("unknown")
        .to_string()
}

fn extract_cookie_token(headers: &HeaderMap, name: &str) -> Option<String> {
    let raw = headers.get(header::COOKIE)?.to_str().ok()?;

    raw.split(';').find_map(|pair| {
        let mut parts = pair.trim().splitn(2, '=');
        let key = parts.next()?;
        let value = parts.next()?;

        if key == name {
            Some(value.to_string())
        } else {
            None
        }
    })
}

fn require_session(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<(), (StatusCode, Json<ErrorResponse>)> {
    require_claims(state, headers).map(|_| ())
}

fn require_claims(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<crate::models::SessionClaims, (StatusCode, Json<ErrorResponse>)> {
    let token = extract_cookie_token(headers, "datapulse_session").ok_or_else(|| {
        (
            StatusCode::UNAUTHORIZED,
            Json(ErrorResponse {
                error: "Unauthorized",
                message: "No active session cookie found.".to_string(),
            }),
        )
    })?;

    state.session_manager.verify(&token).ok_or_else(|| {
        (
            StatusCode::UNAUTHORIZED,
            Json(ErrorResponse {
                error: "Unauthorized",
                message: "Session is invalid or expired.".to_string(),
            }),
        )
    })
}

fn build_cookie(name: &str, value: &str, max_age: i64) -> String {
    format!(
        "{name}={value}; HttpOnly; Path=/; SameSite=Lax; Max-Age={max_age}",
        name = name,
        value = value,
        max_age = max_age
    )
}

fn internal_error(error: jsonwebtoken::errors::Error) -> (StatusCode, Json<ErrorResponse>) {
    internal_error_message(&format!("Internal error: {}", error))
}

fn internal_error_message(message: &str) -> (StatusCode, Json<ErrorResponse>) {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(ErrorResponse {
            error: "Internal server error",
            message: message.to_string(),
        }),
    )
}
