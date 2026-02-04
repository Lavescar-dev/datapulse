/// Rate limiting configuration for the DataPulse demo API.
pub struct RateLimitConfig {
    /// Maximum requests per day globally per IP.
    pub global_daily_limit: usize,
    /// Maximum requests per day per endpoint per IP.
    pub endpoint_daily_limit: usize,
    /// Maximum requests per minute per endpoint per IP.
    pub endpoint_minute_limit: usize,
}

impl Default for RateLimitConfig {
    fn default() -> Self {
        Self {
            global_daily_limit: 50,
            endpoint_daily_limit: 20,
            endpoint_minute_limit: 5,
        }
    }
}
