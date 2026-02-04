use std::time::{Duration, Instant};

use axum::http::StatusCode;
use dashmap::DashMap;

use crate::config::RateLimitConfig;

/// A simple in-memory rate limiter backed by DashMap.
/// Keys are formatted as "ip" for global or "ip:endpoint" for per-endpoint limits.
pub struct RateLimiter {
    entries: DashMap<String, Vec<Instant>>,
    config: RateLimitConfig,
}

impl RateLimiter {
    pub fn new(config: RateLimitConfig) -> Self {
        Self {
            entries: DashMap::new(),
            config,
        }
    }

    /// Check whether a request from `ip` to `endpoint` is within rate limits.
    /// Returns Ok(()) if allowed, Err(429) if rate limited.
    pub fn check_rate_limit(&self, ip: &str, endpoint: &str) -> Result<(), StatusCode> {
        let now = Instant::now();
        let one_day = Duration::from_secs(86400);
        let one_minute = Duration::from_secs(60);

        // --- Global daily limit per IP ---
        let global_key = ip.to_string();
        {
            let mut entry = self.entries.entry(global_key).or_default();
            entry.retain(|t| now.duration_since(*t) < one_day);
            if entry.len() >= self.config.global_daily_limit {
                return Err(StatusCode::TOO_MANY_REQUESTS);
            }
            entry.push(now);
        }

        // --- Per-endpoint daily limit ---
        let endpoint_day_key = format!("{ip}:{endpoint}:day");
        {
            let mut entry = self.entries.entry(endpoint_day_key).or_default();
            entry.retain(|t| now.duration_since(*t) < one_day);
            if entry.len() >= self.config.endpoint_daily_limit {
                return Err(StatusCode::TOO_MANY_REQUESTS);
            }
            entry.push(now);
        }

        // --- Per-endpoint minute limit ---
        let endpoint_min_key = format!("{ip}:{endpoint}:min");
        {
            let mut entry = self.entries.entry(endpoint_min_key).or_default();
            entry.retain(|t| now.duration_since(*t) < one_minute);
            if entry.len() >= self.config.endpoint_minute_limit {
                return Err(StatusCode::TOO_MANY_REQUESTS);
            }
            entry.push(now);
        }

        Ok(())
    }

    /// Remove entries older than 24 hours to free memory.
    pub fn cleanup(&self) {
        let now = Instant::now();
        let one_day = Duration::from_secs(86400);

        self.entries.retain(|_, timestamps| {
            timestamps.retain(|t| now.duration_since(*t) < one_day);
            !timestamps.is_empty()
        });
    }
}
