use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
    time::Duration,
};

use chrono::Utc;
use serde::Serialize;
use serde_json::{json, Value};

#[derive(Clone)]
pub struct DemoJobStore {
    jobs: Arc<Mutex<HashMap<String, DemoJob>>>,
    scraper_examples: Arc<Vec<Value>>,
}

#[derive(Clone, Serialize)]
struct DemoJob {
    id: String,
    kind: String,
    status: String,
    progress: u32,
    result: Option<Value>,
    error: Option<String>,
}

impl DemoJobStore {
    pub fn new() -> Self {
        Self {
            jobs: Arc::new(Mutex::new(HashMap::new())),
            scraper_examples: Arc::new(seed_scraper_examples()),
        }
    }

    pub fn submit_scrape_job(&self, url: String, selector: Option<String>, auto_detect: bool) -> String {
        let job_id = format!("scrape-{}", Utc::now().timestamp_millis());
        self.jobs.lock().expect("job store poisoned").insert(
            job_id.clone(),
            DemoJob {
                id: job_id.clone(),
                kind: "scrape".to_string(),
                status: "active".to_string(),
                progress: 15,
                result: None,
                error: None,
            },
        );

        let jobs = self.jobs.clone();
        let job_id_clone = job_id.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(900)).await;
            let result = sample_scrape_result(&url, selector.as_deref(), auto_detect);
            if let Some(job) = jobs.lock().expect("job store poisoned").get_mut(&job_id_clone) {
                job.status = "completed".to_string();
                job.progress = 100;
                job.result = Some(result);
            }
        });

        job_id
    }

    pub fn submit_seo_job(&self, url: String) -> String {
        let job_id = format!("seo-{}", Utc::now().timestamp_millis());
        self.jobs.lock().expect("job store poisoned").insert(
            job_id.clone(),
            DemoJob {
                id: job_id.clone(),
                kind: "seo".to_string(),
                status: "active".to_string(),
                progress: 20,
                result: None,
                error: None,
            },
        );

        let jobs = self.jobs.clone();
        let job_id_clone = job_id.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(1100)).await;
            let result = sample_seo_result(&url);
            if let Some(job) = jobs.lock().expect("job store poisoned").get_mut(&job_id_clone) {
                job.status = "completed".to_string();
                job.progress = 100;
                job.result = Some(result);
            }
        });

        job_id
    }

    pub fn status(&self, id: &str) -> Option<Value> {
        let job = self.jobs.lock().expect("job store poisoned").get(id)?.clone();
        Some(json!({
            "success": true,
            "jobId": job.id,
            "status": job.status,
            "progress": job.progress,
            "error": job.error,
        }))
    }

    pub fn result(&self, id: &str) -> Option<Value> {
        self.jobs
            .lock()
            .expect("job store poisoned")
            .get(id)
            .and_then(|job| job.result.clone())
    }

    pub fn scraper_examples(&self) -> Value {
        json!({
            "success": true,
            "examples": self.scraper_examples.as_ref(),
        })
    }

    pub fn scraper_example(&self, id: &str) -> Option<Value> {
        self.scraper_examples
            .iter()
            .find(|example| example.get("id").and_then(Value::as_str) == Some(id))
            .cloned()
            .map(|example| {
                let result = example.get("result").cloned().unwrap_or_else(|| json!({}));
                json!({
                    "success": true,
                    "url": example.get("url").and_then(Value::as_str).unwrap_or_default(),
                    "scrapedAt": result.get("scrapedAt").and_then(Value::as_i64).unwrap_or_else(|| Utc::now().timestamp_millis()),
                    "itemCount": result.get("itemCount").and_then(Value::as_u64).unwrap_or_default(),
                    "pattern": result.get("pattern").and_then(Value::as_str).unwrap_or("list-items"),
                    "engine": result.get("engine").and_then(Value::as_str).unwrap_or("cheerio"),
                    "data": result.get("data").cloned().unwrap_or_else(|| json!([])),
                })
            })
    }
}

fn sample_scrape_result(url: &str, selector: Option<&str>, auto_detect: bool) -> Value {
    json!({
        "success": true,
        "url": url,
        "scrapedAt": Utc::now().timestamp_millis(),
        "itemCount": 4,
        "pattern": selector.unwrap_or(if auto_detect { "products" } else { "list-items" }),
        "engine": if auto_detect { "puppeteer" } else { "cheerio" },
        "data": [
            {
                "title": "Apple iPhone 15 Pro Max 256GB",
                "price": "61.999 TL",
                "availability": "In stock",
                "url": format!("{}/iphone-15-pro-max", url.trim_end_matches('/')),
            },
            {
                "title": "Samsung Galaxy S24 Ultra 512GB",
                "price": "69.999 TL",
                "availability": "In stock",
                "url": format!("{}/galaxy-s24-ultra", url.trim_end_matches('/')),
            },
            {
                "title": "Sony PlayStation 5 Slim",
                "price": "28.499 TL",
                "availability": "Out of stock",
                "url": format!("{}/ps5-slim", url.trim_end_matches('/')),
            },
            {
                "title": "MacBook Pro M3 Pro 18GB",
                "price": "89.999 TL",
                "availability": "In stock",
                "url": format!("{}/macbook-pro-m3-pro", url.trim_end_matches('/')),
            }
        ]
    })
}

fn sample_seo_result(url: &str) -> Value {
    let domain = url
        .replace("https://", "")
        .replace("http://", "")
        .trim_end_matches('/')
        .to_string();

    json!({
        "success": true,
        "url": url,
        "analyzedAt": Utc::now().timestamp_millis(),
        "report": {
            "url": url,
            "whois": {
                "domain": domain,
                "registrar": "Demo Registrar Ltd.",
                "createdDate": "2021-01-12T00:00:00.000Z",
                "expiryDate": "2027-01-12T00:00:00.000Z",
                "updatedDate": "2026-02-01T00:00:00.000Z",
                "nameServers": ["ns1.demo.net", "ns2.demo.net"],
                "status": ["clientTransferProhibited"],
                "registrant": { "organization": "Demo Company", "country": "TR" }
            },
            "dns": {
                "A": ["104.26.10.24", "104.26.11.24"],
                "MX": [{ "priority": 10, "exchange": "mail.demo.net" }],
                "TXT": ["v=spf1 include:_spf.google.com ~all"],
                "NS": ["ns1.demo.net", "ns2.demo.net"]
            },
            "ssl": {
                "valid": true,
                "issuer": "Let's Encrypt",
                "subject": domain,
                "validFrom": "2026-02-20T00:00:00.000Z",
                "validTo": "2026-05-21T00:00:00.000Z",
                "daysUntilExpiry": 60,
                "protocol": "TLSv1.3",
                "cipher": "TLS_AES_256_GCM_SHA384"
            },
            "headers": {
                "server": "cloudflare",
                "poweredBy": "Demo Edge Runtime",
                "contentType": "text/html; charset=utf-8",
                "securityHeaders": {
                    "strictTransportSecurity": "max-age=31536000; includeSubDomains",
                    "contentSecurityPolicy": "default-src 'self'",
                    "xFrameOptions": "DENY",
                    "xContentTypeOptions": "nosniff",
                    "referrerPolicy": "strict-origin-when-cross-origin"
                },
                "caching": {
                    "cacheControl": "public, max-age=300",
                    "etag": "demo-etag"
                },
                "compression": "br"
            },
            "meta": {
                "title": "Demo SEO Page",
                "description": "A demo page used for Rust-backed SEO analysis flows.",
                "keywords": "seo, demo, rust, datapulse",
                "ogTitle": "Demo SEO Page",
                "ogDescription": "SEO analysis demo result",
                "ogType": "website",
                "twitterCard": "summary_large_image",
                "canonical": url,
                "robots": "index,follow"
            },
            "techStack": [
                {"name": "Cloudflare", "category": "CDN", "confidence": 97},
                {"name": "SvelteKit", "category": "Framework", "confidence": 88},
                {"name": "Tailwind CSS", "category": "CSS", "confidence": 83}
            ],
            "robots": {
                "exists": true,
                "content": "User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml",
                "userAgents": [{ "agent": "*", "rules": ["Allow: /"] }],
                "sitemaps": [format!("{}/sitemap.xml", url.trim_end_matches('/'))]
            },
            "sitemap": {
                "exists": true,
                "urls": [
                    format!("{}/", url.trim_end_matches('/')),
                    format!("{}/about", url.trim_end_matches('/')),
                    format!("{}/contact", url.trim_end_matches('/'))
                ],
                "urlCount": 3,
                "lastModified": "2026-03-20T00:00:00.000Z"
            },
            "performanceScore": {
                "overall": 84,
                "ssl": 95,
                "securityHeaders": 78,
                "metaCompleteness": 80,
                "loadTime": 642,
                "breakdown": {
                    "ssl": { "score": 95, "reason": "Valid TLS 1.3 certificate with healthy expiry window." },
                    "securityHeaders": {
                        "score": 78,
                        "present": ["HSTS", "CSP", "X-Frame-Options", "X-Content-Type-Options", "Referrer-Policy"],
                        "missing": ["Permissions-Policy"]
                    },
                    "meta": {
                        "score": 80,
                        "present": ["title", "description", "og:title", "twitter:card", "canonical"],
                        "missing": ["og:image", "twitter:image"]
                    }
                }
            }
        }
    })
}

fn seed_scraper_examples() -> Vec<Value> {
    vec![
        json!({
            "id": "ecommerce-products",
            "url": "https://demo-store.local/products",
            "title": "E-commerce Product Grid",
            "description": "Product cards with title, price, stock state, and detail links.",
            "pattern": "products",
            "itemCount": 4,
            "result": sample_scrape_result("https://demo-store.local/products", Some(".product-card"), true)
        }),
        json!({
            "id": "news-articles",
            "url": "https://demo-news.local/latest",
            "title": "News Article Listing",
            "description": "Headline-heavy layout ideal for article extraction and feed normalization.",
            "pattern": "articles",
            "itemCount": 4,
            "result": {
                "success": true,
                "url": "https://demo-news.local/latest",
                "scrapedAt": Utc::now().timestamp_millis(),
                "itemCount": 4,
                "pattern": "articles",
                "engine": "cheerio",
                "data": [
                    {"headline": "AI infrastructure spending rises again", "source": "TechCrunch", "link": "https://demo-news.local/article/1"},
                    {"headline": "Crypto markets stabilize after volatile week", "source": "The Block", "link": "https://demo-news.local/article/2"},
                    {"headline": "Cloud monitoring tools consolidate", "source": "InfoQ", "link": "https://demo-news.local/article/3"},
                    {"headline": "Edge runtimes close the latency gap", "source": "Hacker News", "link": "https://demo-news.local/article/4"}
                ]
            }
        }),
    ]
}
