use std::sync::Arc;

use crate::rate_limiter::RateLimiter;

/// Shared application state accessible from all route handlers.
#[derive(Clone)]
pub struct AppState {
    pub rate_limiter: Arc<RateLimiter>,
}
