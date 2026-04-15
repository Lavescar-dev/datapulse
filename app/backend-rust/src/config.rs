use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub host: String,
    pub port: u16,
    pub admin_username: String,
    pub admin_password: String,
    pub jwt_secret: String,
    pub demo_rate_limit_enabled: bool,
    pub demo_sessions_per_ip: u32,
    pub demo_session_duration_minutes: i64,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            host: env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string()),
            port: env::var("PORT")
                .ok()
                .and_then(|value| value.parse().ok())
                .unwrap_or(8031),
            admin_username: env::var("ADMIN_USERNAME").unwrap_or_else(|_| "admin".to_string()),
            admin_password: env::var("ADMIN_PASSWORD")
                .unwrap_or_else(|_| "change_me_in_production".to_string()),
            jwt_secret: env::var("JWT_SECRET")
                .unwrap_or_else(|_| "default_secret_change_in_production".to_string()),
            demo_rate_limit_enabled: env_bool("DEMO_RATE_LIMIT_ENABLED", false),
            demo_sessions_per_ip: env::var("DEMO_SESSIONS_PER_IP")
                .ok()
                .and_then(|value| value.parse().ok())
                .unwrap_or(3),
            demo_session_duration_minutes: env::var("DEMO_SESSION_DURATION_MINUTES")
                .ok()
                .and_then(|value| value.parse().ok())
                .unwrap_or(30),
        }
    }
}

fn env_bool(key: &str, default: bool) -> bool {
    env::var(key)
        .ok()
        .map(|value| {
            matches!(
                value.trim().to_ascii_lowercase().as_str(),
                "1" | "true" | "yes" | "on"
            )
        })
        .unwrap_or(default)
}
