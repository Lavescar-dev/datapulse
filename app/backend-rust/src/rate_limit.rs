use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

#[derive(Debug, Clone)]
pub struct RateLimitStore {
    max_sessions_per_ip: u32,
    window: Duration,
    entries: Arc<Mutex<HashMap<String, RateLimitEntry>>>,
}

#[derive(Debug, Clone)]
struct RateLimitEntry {
    count: u32,
    first_attempt_ms: u64,
}

impl RateLimitStore {
    pub fn new(max_sessions_per_ip: u32) -> Self {
        Self {
            max_sessions_per_ip,
            window: Duration::from_secs(24 * 60 * 60),
            entries: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn is_rate_limited(&self, ip: &str) -> bool {
        let now = now_ms();
        let mut entries = self.entries.lock().expect("rate limit store poisoned");
        Self::cleanup_expired(&mut entries, now, self.window);

        entries
            .get(ip)
            .map(|entry| entry.count >= self.max_sessions_per_ip)
            .unwrap_or(false)
    }

    pub fn record_attempt(&self, ip: &str) {
        let now = now_ms();
        let mut entries = self.entries.lock().expect("rate limit store poisoned");
        Self::cleanup_expired(&mut entries, now, self.window);

        match entries.get_mut(ip) {
            Some(entry) => {
                entry.count += 1;
            }
            None => {
                entries.insert(
                    ip.to_string(),
                    RateLimitEntry {
                        count: 1,
                        first_attempt_ms: now,
                    },
                );
            }
        }
    }

    pub fn remaining_sessions(&self, ip: &str) -> u32 {
        let now = now_ms();
        let mut entries = self.entries.lock().expect("rate limit store poisoned");
        Self::cleanup_expired(&mut entries, now, self.window);

        let used = entries.get(ip).map(|entry| entry.count).unwrap_or(0);
        self.max_sessions_per_ip.saturating_sub(used)
    }

    fn cleanup_expired(entries: &mut HashMap<String, RateLimitEntry>, now: u64, window: Duration) {
        let threshold = now.saturating_sub(window.as_millis() as u64);
        entries.retain(|_, entry| entry.first_attempt_ms >= threshold);
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system time before unix epoch")
        .as_millis() as u64
}
