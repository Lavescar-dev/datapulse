use std::sync::{Arc, Mutex};

use chrono::Utc;
use serde_json::{json, Value};

use crate::cache::CacheStore;

#[derive(Clone)]
pub struct MonitorStore {
    endpoints: Arc<Mutex<Vec<Value>>>,
}

impl MonitorStore {
    pub fn new(cache_store: &CacheStore) -> Self {
        let endpoints = cache_store
            .read_json("api-health.json")
            .ok()
            .and_then(|payload| payload.get("endpoints").and_then(Value::as_array).cloned())
            .unwrap_or_default();

        Self {
            endpoints: Arc::new(Mutex::new(endpoints)),
        }
    }

    pub fn list(&self) -> Vec<Value> {
        self.endpoints.lock().expect("monitor store poisoned").clone()
    }

    pub fn add(&self, name: String, url: String, method: String, check_interval: u64) -> Value {
        let now = Utc::now().to_rfc3339();
        let response_time = 180_i64;
        let endpoint = json!({
            "id": format!("endpoint-rust-{}", Utc::now().timestamp_millis()),
            "name": name,
            "url": url,
            "method": method,
            "enabled": true,
            "checkInterval": check_interval,
            "lastCheck": now,
            "currentStatus": "up",
            "lastResponseTime": response_time,
            "history": [
                {
                    "timestamp": Utc::now().to_rfc3339(),
                    "statusCode": 200,
                    "responseTime": response_time,
                    "isUp": true
                }
            ],
            "ssl": {
                "valid": true,
                "issuer": "Demo CA",
                "daysRemaining": 90
            },
            "uptimeStats": {
                "24h": {"period":"24h","uptimePercent":100.0,"totalChecks":1,"successfulChecks":1,"failedChecks":0,"averageResponseTime":response_time},
                "7d": {"period":"7d","uptimePercent":100.0,"totalChecks":1,"successfulChecks":1,"failedChecks":0,"averageResponseTime":response_time},
                "30d": {"period":"30d","uptimePercent":100.0,"totalChecks":1,"successfulChecks":1,"failedChecks":0,"averageResponseTime":response_time}
            },
            "createdAt": now,
            "updatedAt": now
        });

        self.endpoints
            .lock()
            .expect("monitor store poisoned")
            .push(endpoint.clone());

        endpoint
    }

    pub fn remove(&self, id: &str) -> bool {
        let mut endpoints = self.endpoints.lock().expect("monitor store poisoned");
        let original_len = endpoints.len();
        endpoints.retain(|endpoint| endpoint.get("id").and_then(Value::as_str) != Some(id));
        endpoints.len() != original_len
    }

    pub fn check(&self, id: &str) -> Option<Value> {
        let mut endpoints = self.endpoints.lock().expect("monitor store poisoned");
        let endpoint = endpoints
            .iter_mut()
            .find(|endpoint| endpoint.get("id").and_then(Value::as_str) == Some(id))?;

        let last_response_time = endpoint
            .get("lastResponseTime")
            .and_then(Value::as_i64)
            .unwrap_or(180);
        let next_response_time = (last_response_time + 17).clamp(80, 950);

        endpoint["lastCheck"] = json!(Utc::now().to_rfc3339());
        endpoint["updatedAt"] = json!(Utc::now().to_rfc3339());
        endpoint["currentStatus"] = json!("up");
        endpoint["lastResponseTime"] = json!(next_response_time);

        if let Some(history) = endpoint.get_mut("history").and_then(Value::as_array_mut) {
            history.insert(
                0,
                json!({
                    "timestamp": Utc::now().to_rfc3339(),
                    "statusCode": 200,
                    "responseTime": next_response_time,
                    "isUp": true
                }),
            );
            history.truncate(10);
        }

        for period in ["24h", "7d", "30d"] {
            endpoint["uptimeStats"][period]["totalChecks"] =
                json!(endpoint["uptimeStats"][period]["totalChecks"].as_u64().unwrap_or(0) + 1);
            endpoint["uptimeStats"][period]["successfulChecks"] =
                json!(endpoint["uptimeStats"][period]["successfulChecks"].as_u64().unwrap_or(0) + 1);
            endpoint["uptimeStats"][period]["averageResponseTime"] = json!(next_response_time);
        }

        Some(endpoint.clone())
    }
}
