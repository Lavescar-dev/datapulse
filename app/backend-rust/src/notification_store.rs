use std::sync::{Arc, Mutex};

use chrono::Utc;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationMetadata {
    #[serde(rename = "productId", skip_serializing_if = "Option::is_none")]
    pub product_id: Option<String>,
    #[serde(rename = "productName", skip_serializing_if = "Option::is_none")]
    pub product_name: Option<String>,
    #[serde(rename = "previousPrice", skip_serializing_if = "Option::is_none")]
    pub previous_price: Option<f64>,
    #[serde(rename = "currentPrice", skip_serializing_if = "Option::is_none")]
    pub current_price: Option<f64>,
    #[serde(rename = "priceChange", skip_serializing_if = "Option::is_none")]
    pub price_change: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub marketplace: Option<String>,
    #[serde(rename = "endpointId", skip_serializing_if = "Option::is_none")]
    pub endpoint_id: Option<String>,
    #[serde(rename = "endpointName", skip_serializing_if = "Option::is_none")]
    pub endpoint_name: Option<String>,
    #[serde(rename = "endpointUrl", skip_serializing_if = "Option::is_none")]
    pub endpoint_url: Option<String>,
    #[serde(rename = "statusCode", skip_serializing_if = "Option::is_none")]
    pub status_code: Option<i32>,
    #[serde(rename = "responseTime", skip_serializing_if = "Option::is_none")]
    pub response_time: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub platform: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub keyword: Option<String>,
    #[serde(rename = "postUrl", skip_serializing_if = "Option::is_none")]
    pub post_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationItem {
    pub id: String,
    pub source: String,
    pub severity: String,
    pub status: String,
    pub title: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<NotificationMetadata>,
    #[serde(rename = "actionUrl", skip_serializing_if = "Option::is_none")]
    pub action_url: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "readAt", skip_serializing_if = "Option::is_none")]
    pub read_at: Option<String>,
    #[serde(rename = "archivedAt", skip_serializing_if = "Option::is_none")]
    pub archived_at: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct NotificationQuery {
    pub source: Option<String>,
    pub severity: Option<String>,
    pub status: Option<String>,
    pub limit: Option<usize>,
    pub offset: Option<usize>,
}

#[derive(Clone)]
pub struct NotificationStore {
    items: Arc<Mutex<Vec<NotificationItem>>>,
}

impl NotificationStore {
    pub fn new() -> Self {
        Self {
            items: Arc::new(Mutex::new(seed_notifications())),
        }
    }

    pub fn list(&self, query: &NotificationQuery) -> Vec<NotificationItem> {
        let mut items = self.items.lock().expect("notification store poisoned").clone();
        items.sort_by(|a, b| b.created_at.cmp(&a.created_at));

        if let Some(source) = &query.source {
            items.retain(|item| item.source == *source);
        }
        if let Some(severity) = &query.severity {
            items.retain(|item| item.severity == *severity);
        }
        if let Some(status) = &query.status {
            items.retain(|item| item.status == *status);
        }

        let offset = query.offset.unwrap_or(0);
        let limit = query.limit.unwrap_or(items.len());
        items.into_iter().skip(offset).take(limit).collect()
    }

    pub fn unread_count(&self) -> usize {
        self.items
            .lock()
            .expect("notification store poisoned")
            .iter()
            .filter(|item| item.status == "unread")
            .count()
    }

    pub fn mark_as_read(&self, id: &str) -> Option<NotificationItem> {
        let now = Utc::now().to_rfc3339();
        let mut items = self.items.lock().expect("notification store poisoned");
        let item = items.iter_mut().find(|item| item.id == id)?;
        item.status = "read".to_string();
        item.read_at = Some(now);
        Some(item.clone())
    }

    pub fn mark_all_as_read(&self) -> usize {
        let now = Utc::now().to_rfc3339();
        let mut count = 0;
        let mut items = self.items.lock().expect("notification store poisoned");
        for item in items.iter_mut() {
            if item.status == "unread" {
                item.status = "read".to_string();
                item.read_at = Some(now.clone());
                count += 1;
            }
        }
        count
    }

    pub fn archive(&self, id: &str) -> Option<NotificationItem> {
        let now = Utc::now().to_rfc3339();
        let mut items = self.items.lock().expect("notification store poisoned");
        let item = items.iter_mut().find(|item| item.id == id)?;
        item.status = "archived".to_string();
        item.archived_at = Some(now);
        Some(item.clone())
    }
}

fn seed_notifications() -> Vec<NotificationItem> {
    vec![
        NotificationItem {
            id: "notif-price-iphone".to_string(),
            source: "price".to_string(),
            severity: "success".to_string(),
            status: "unread".to_string(),
            title: "Fiyat Düşüşü: iPhone 15 Pro Max".to_string(),
            message: "iPhone 15 Pro Max fiyatı 61.999 TL seviyesine düştü. Hedef alarm tetiklendi.".to_string(),
            metadata: Some(NotificationMetadata {
                product_id: Some("product-iphone-15-pro-max".to_string()),
                product_name: Some("Apple iPhone 15 Pro Max 256GB".to_string()),
                previous_price: Some(65999.0),
                current_price: Some(61999.0),
                price_change: Some(-4000.0),
                currency: Some("TRY".to_string()),
                marketplace: Some("trendyol".to_string()),
                ..Default::default()
            }),
            action_url: Some("/price-tracker".to_string()),
            created_at: "2026-03-22T12:45:00.000Z".to_string(),
            read_at: None,
            archived_at: None,
        },
        NotificationItem {
            id: "notif-monitor-coingecko".to_string(),
            source: "monitor".to_string(),
            severity: "warning".to_string(),
            status: "unread".to_string(),
            title: "Yavaş API: CoinGecko API".to_string(),
            message: "CoinGecko API yanıt süresi eşik değerin üstünde gözlemlendi.".to_string(),
            metadata: Some(NotificationMetadata {
                endpoint_id: Some("endpoint-dv63q4wan6ht".to_string()),
                endpoint_name: Some("CoinGecko API".to_string()),
                endpoint_url: Some("https://api.coingecko.com/api/v3/ping".to_string()),
                response_time: Some(192),
                ..Default::default()
            }),
            action_url: Some("/api-monitor".to_string()),
            created_at: "2026-03-22T12:40:00.000Z".to_string(),
            read_at: None,
            archived_at: None,
        },
        NotificationItem {
            id: "notif-social-bitcoin".to_string(),
            source: "social".to_string(),
            severity: "info".to_string(),
            status: "read".to_string(),
            title: "Trend: Bitcoin momentum".to_string(),
            message: "Bitcoin, Reddit ve Hacker News üzerinde hızlı şekilde yükselen konu oldu.".to_string(),
            metadata: Some(NotificationMetadata {
                platform: Some("Reddit".to_string()),
                keyword: Some("Bitcoin".to_string()),
                post_url: Some("https://reddit.com/r/cryptocurrency/comments/abc123".to_string()),
                ..Default::default()
            }),
            action_url: Some("/social".to_string()),
            created_at: "2026-03-22T11:55:00.000Z".to_string(),
            read_at: Some("2026-03-22T12:10:00.000Z".to_string()),
            archived_at: None,
        },
        NotificationItem {
            id: "notif-news-ai".to_string(),
            source: "news".to_string(),
            severity: "info".to_string(),
            status: "unread".to_string(),
            title: "Haber Eşleşmesi: AI".to_string(),
            message: "AI anahtar kelimesi yeni teknoloji haberlerinde tekrar öne çıktı.".to_string(),
            metadata: Some(NotificationMetadata {
                platform: Some("TechCrunch".to_string()),
                keyword: Some("AI".to_string()),
                post_url: Some("https://techcrunch.com/2026/03/22/ai-roundup".to_string()),
                ..Default::default()
            }),
            action_url: Some("/news".to_string()),
            created_at: "2026-03-22T11:30:00.000Z".to_string(),
            read_at: None,
            archived_at: None,
        },
        NotificationItem {
            id: "notif-system-demo".to_string(),
            source: "system".to_string(),
            severity: "info".to_string(),
            status: "read".to_string(),
            title: "DataPulse demo aktif".to_string(),
            message: "Demo oturumun hazır. Price, monitor, news ve dashboard modüllerini gezebilirsin.".to_string(),
            metadata: None,
            action_url: None,
            created_at: "2026-03-22T10:50:00.000Z".to_string(),
            read_at: Some("2026-03-22T10:55:00.000Z".to_string()),
            archived_at: None,
        },
    ]
}

impl Default for NotificationMetadata {
    fn default() -> Self {
        Self {
            product_id: None,
            product_name: None,
            previous_price: None,
            current_price: None,
            price_change: None,
            currency: None,
            marketplace: None,
            endpoint_id: None,
            endpoint_name: None,
            endpoint_url: None,
            status_code: None,
            response_time: None,
            platform: None,
            keyword: None,
            post_url: None,
        }
    }
}
