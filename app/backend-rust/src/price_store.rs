use std::sync::{Arc, Mutex};

use chrono::Utc;
use serde_json::{json, Value};

#[derive(Clone)]
pub struct PriceStore {
    products: Arc<Mutex<Vec<Value>>>,
}

impl PriceStore {
    pub fn new(seed_products: Vec<Value>) -> Self {
        Self {
            products: Arc::new(Mutex::new(seed_products)),
        }
    }

    pub fn list(&self) -> Vec<Value> {
        self.products.lock().expect("price store poisoned").clone()
    }

    pub fn add_from_url(&self, url: &str) -> Option<Value> {
        let marketplace = if url.contains("trendyol.com") {
            "trendyol"
        } else if url.contains("hepsiburada.com") {
            "hepsiburada"
        } else if url.contains("n11.com") {
            "n11"
        } else if url.contains("amazon.com.tr") {
            "amazon-tr"
        } else {
            return None;
        };

        let price = match marketplace {
            "trendyol" => 15499.0,
            "hepsiburada" => 21999.0,
            "n11" => 8999.0,
            _ => 12999.0,
        };

        let product = json!({
            "id": format!("product-rust-{}", Utc::now().timestamp_millis()),
            "url": url,
            "name": infer_name(url, marketplace),
            "currentPrice": price,
            "currency": "TRY",
            "available": true,
            "imageUrl": "",
            "marketplace": marketplace,
            "lastChecked": Utc::now().to_rfc3339(),
            "priceHistory": [
                {"price": price + 2500.0, "timestamp": "2026-03-20T09:00:00.000Z", "available": true},
                {"price": price + 1000.0, "timestamp": "2026-03-21T09:00:00.000Z", "available": true},
                {"price": price, "timestamp": Utc::now().to_rfc3339(), "available": true}
            ]
        });

        self.products
            .lock()
            .expect("price store poisoned")
            .push(product.clone());

        Some(product)
    }

    pub fn remove(&self, id: &str) -> bool {
        let mut products = self.products.lock().expect("price store poisoned");
        let original_len = products.len();
        products.retain(|product| product.get("id").and_then(Value::as_str) != Some(id));
        products.len() != original_len
    }
}

fn infer_name(url: &str, marketplace: &str) -> String {
    let slug = url
        .trim_end_matches('/')
        .split('/')
        .next_back()
        .unwrap_or("demo-product")
        .replace('-', " ");

    let prefix = match marketplace {
        "trendyol" => "Trendyol",
        "hepsiburada" => "Hepsiburada",
        "n11" => "N11",
        _ => "Amazon TR",
    };

    format!("{} {}", prefix, slug)
}
