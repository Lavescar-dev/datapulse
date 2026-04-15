use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SessionClaims {
    pub is_admin: bool,
    pub requests_remaining: i32,
    pub expires_at: i64,
    pub created_at: i64,
    pub ip: Option<String>,
    pub scrapes_remaining: Option<i32>,
    pub seo_analyses_remaining: Option<i32>,
    pub exp: usize,
}

#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status: &'static str,
    pub service: &'static str,
    pub version: &'static str,
}

#[derive(Debug, Serialize)]
pub struct SessionStatus {
    pub active: bool,
    #[serde(rename = "isAdmin")]
    pub is_admin: bool,
    pub requests_remaining: i32,
    pub time_remaining: i64,
    pub expires_at: i64,
    pub scrapes_remaining: i32,
    pub seo_analyses_remaining: i32,
}

#[derive(Debug, Serialize)]
pub struct SessionStartResponse {
    pub success: bool,
    pub session: SessionStatus,
    pub remaining_sessions_today: u32,
}

#[derive(Debug, Serialize)]
pub struct AdminLoginResponse {
    pub success: bool,
    pub message: &'static str,
    pub username: String,
}

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: &'static str,
    pub message: String,
}

#[derive(Debug, Deserialize)]
pub struct AdminCredentials {
    pub username: String,
    pub password: String,
}
