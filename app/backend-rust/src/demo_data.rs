use chrono::Utc;
use serde_json::{json, Value};

use crate::cache::CacheStore;

pub fn build_monitor_endpoints_from_values(endpoints: &[Value]) -> Result<Value, String> {
    Ok(json!({
        "success": true,
        "count": endpoints.len(),
        "endpoints": endpoints,
    }))
}

pub fn build_monitor_endpoint_from_values(endpoints: &[Value], id: &str) -> Result<Option<Value>, String> {
    let endpoint = endpoints
        .iter()
        .find(|endpoint| endpoint.get("id").and_then(Value::as_str) == Some(id))
        .cloned();

    Ok(endpoint.map(|endpoint| {
        json!({
            "success": true,
            "endpoint": endpoint,
        })
    }))
}

pub fn build_monitor_summary_from_values(endpoints: &[Value]) -> Result<Value, String> {
    let total = endpoints.len();
    let up = endpoints
        .iter()
        .filter(|endpoint| endpoint.get("currentStatus").and_then(Value::as_str) == Some("up"))
        .count();
    let down = endpoints
        .iter()
        .filter(|endpoint| endpoint.get("currentStatus").and_then(Value::as_str) == Some("down"))
        .count();
    let unknown = endpoints
        .iter()
        .filter(|endpoint| endpoint.get("currentStatus").and_then(Value::as_str) == Some("unknown"))
        .count();
    let enabled = endpoints
        .iter()
        .filter(|endpoint| endpoint.get("enabled").and_then(Value::as_bool).unwrap_or(false))
        .count();
    let disabled = total.saturating_sub(enabled);

    Ok(json!({
        "success": true,
        "stats": {
            "total": total,
            "up": up,
            "down": down,
            "unknown": unknown,
            "enabled": enabled,
            "disabled": disabled,
        }
    }))
}

pub fn dashboard_templates() -> Vec<Value> {
    vec![
        json!({
            "id": "crypto-overview",
            "name": "Crypto Overview",
            "description": "Comprehensive cryptocurrency dashboard with market data, prices, news, and social sentiment",
            "category": "crypto",
            "widgets": [
                {
                    "id": "crypto-fear-greed",
                    "type": "stat",
                    "source": "crypto",
                    "title": "Fear & Greed Index",
                    "description": "Current market sentiment indicator",
                    "x": 0, "y": 0, "w": 4, "h": 2,
                    "dataKey": "fearGreedIndex",
                    "color": "#f59e0b",
                    "showHeader": true
                },
                {
                    "id": "crypto-market-cap",
                    "type": "stat",
                    "source": "crypto",
                    "title": "Total Market Cap",
                    "description": "Global cryptocurrency market capitalization",
                    "x": 4, "y": 0, "w": 4, "h": 2,
                    "dataKey": "marketStats",
                    "color": "#3b82f6",
                    "showHeader": true
                },
                {
                    "id": "crypto-top-coins-chart",
                    "type": "chart",
                    "source": "crypto",
                    "title": "Top Cryptocurrencies",
                    "description": "Market cap comparison",
                    "x": 8, "y": 0, "w": 4, "h": 2,
                    "chartType": "bar",
                    "limit": 10,
                    "color": "#8b5cf6",
                    "showHeader": true
                },
                {
                    "id": "crypto-price-table",
                    "type": "table",
                    "source": "crypto",
                    "title": "Live Crypto Prices",
                    "description": "Real-time cryptocurrency prices and 24h changes",
                    "x": 0, "y": 2, "w": 12, "h": 4,
                    "limit": 15,
                    "showHeader": true
                },
                {
                    "id": "crypto-news-feed",
                    "type": "list",
                    "source": "news",
                    "title": "Crypto News",
                    "description": "Latest cryptocurrency news",
                    "x": 0, "y": 6, "w": 6, "h": 3,
                    "limit": 8,
                    "filters": { "category": "Crypto" },
                    "showHeader": true
                },
                {
                    "id": "crypto-social-feed",
                    "type": "list",
                    "source": "social",
                    "title": "Trending on Reddit",
                    "description": "Hot crypto discussions",
                    "x": 6, "y": 6, "w": 6, "h": 3,
                    "limit": 8,
                    "filters": { "platform": "Reddit" },
                    "showHeader": true
                }
            ]
        }),
        json!({
            "id": "tech-news-hub",
            "name": "Tech News Hub",
            "description": "Stay updated with technology news, social media trends, and developer community activity",
            "category": "tech",
            "widgets": [
                {
                    "id": "news-tech-articles",
                    "type": "list",
                    "source": "news",
                    "title": "Technology News",
                    "description": "Latest tech industry updates",
                    "x": 0, "y": 0, "w": 6, "h": 4,
                    "limit": 12,
                    "filters": { "category": "Tech" },
                    "showHeader": true
                },
                {
                    "id": "news-finance-articles",
                    "type": "list",
                    "source": "news",
                    "title": "Financial News",
                    "description": "Markets and business updates",
                    "x": 6, "y": 0, "w": 6, "h": 4,
                    "limit": 12,
                    "filters": { "category": "Finance" },
                    "showHeader": true
                },
                {
                    "id": "social-hackernews",
                    "type": "list",
                    "source": "social",
                    "title": "Hacker News Top Stories",
                    "description": "Trending on Hacker News",
                    "x": 0, "y": 4, "w": 4, "h": 3,
                    "limit": 10,
                    "filters": { "platform": "HackerNews" },
                    "showHeader": true
                },
                {
                    "id": "social-reddit-programming",
                    "type": "list",
                    "source": "social",
                    "title": "r/programming",
                    "description": "Hot programming discussions",
                    "x": 4, "y": 4, "w": 4, "h": 3,
                    "limit": 10,
                    "filters": { "platform": "Reddit" },
                    "showHeader": true
                },
                {
                    "id": "social-github-trending",
                    "type": "list",
                    "source": "social",
                    "title": "GitHub Trending",
                    "description": "Popular repositories today",
                    "x": 8, "y": 4, "w": 4, "h": 3,
                    "limit": 10,
                    "filters": { "platform": "GitHub" },
                    "showHeader": true
                },
                {
                    "id": "news-sentiment-chart",
                    "type": "chart",
                    "source": "news",
                    "title": "News Sentiment",
                    "description": "Sentiment analysis of recent articles",
                    "x": 0, "y": 7, "w": 6, "h": 2,
                    "chartType": "pie",
                    "dataKey": "sentiment",
                    "showHeader": true
                },
                {
                    "id": "crypto-top-performers",
                    "type": "list",
                    "source": "crypto",
                    "title": "Top Crypto Performers",
                    "description": "24h gainers",
                    "x": 6, "y": 7, "w": 6, "h": 2,
                    "limit": 8,
                    "showHeader": true
                }
            ]
        }),
        json!({
            "id": "ecommerce-monitoring",
            "name": "E-commerce & Monitoring",
            "description": "Track product prices, monitor API health, and get alerts on deals and system status",
            "category": "ecommerce",
            "widgets": [
                {
                    "id": "price-tracked-products",
                    "type": "table",
                    "source": "price",
                    "title": "Price Tracker",
                    "description": "Monitored product prices across marketplaces",
                    "x": 0, "y": 0, "w": 8, "h": 4,
                    "limit": 10,
                    "showHeader": true
                },
                {
                    "id": "price-best-deals",
                    "type": "list",
                    "source": "price",
                    "title": "Best Deals",
                    "description": "Products with biggest price drops",
                    "x": 8, "y": 0, "w": 4, "h": 4,
                    "limit": 8,
                    "showHeader": true
                },
                {
                    "id": "monitor-api-status",
                    "type": "table",
                    "source": "monitor",
                    "title": "API Health Monitor",
                    "description": "Real-time API endpoint status",
                    "x": 0, "y": 4, "w": 8, "h": 3,
                    "limit": 8,
                    "showHeader": true
                },
                {
                    "id": "monitor-uptime-stat",
                    "type": "stat",
                    "source": "monitor",
                    "title": "System Uptime",
                    "description": "24h average uptime across all endpoints",
                    "x": 8, "y": 4, "w": 4, "h": 1.5,
                    "dataKey": "uptime",
                    "color": "#10b981",
                    "showHeader": true
                },
                {
                    "id": "monitor-response-time",
                    "type": "stat",
                    "source": "monitor",
                    "title": "Avg Response Time",
                    "description": "Average API response time",
                    "x": 8, "y": 5.5, "w": 4, "h": 1.5,
                    "dataKey": "responseTime",
                    "color": "#3b82f6",
                    "showHeader": true
                },
                {
                    "id": "price-marketplace-chart",
                    "type": "chart",
                    "source": "price",
                    "title": "Products by Marketplace",
                    "description": "Distribution across e-commerce platforms",
                    "x": 0, "y": 7, "w": 6, "h": 2,
                    "chartType": "pie",
                    "showHeader": true
                },
                {
                    "id": "monitor-status-chart",
                    "type": "chart",
                    "source": "monitor",
                    "title": "API Status Distribution",
                    "description": "Endpoint health overview",
                    "x": 6, "y": 7, "w": 6, "h": 2,
                    "chartType": "pie",
                    "showHeader": true
                }
            ]
        }),
    ]
}

pub fn build_templates_payload() -> Value {
    let templates = dashboard_templates();
    json!({
        "templates": templates,
        "count": templates.len(),
    })
}

pub fn build_template_payload(id: &str) -> Option<Value> {
    dashboard_templates()
        .into_iter()
        .find(|template| template.get("id").and_then(Value::as_str) == Some(id))
}

pub fn build_dashboard_from_template(id: &str, created_by: &str) -> Option<Value> {
    let template = build_template_payload(id)?;
    let now = Utc::now().to_rfc3339();

    Some(json!({
        "id": format!("dashboard-rust-{}-{}", id, Utc::now().timestamp_millis()),
        "name": template.get("name").and_then(Value::as_str).unwrap_or("Dashboard"),
        "description": template.get("description").and_then(Value::as_str),
        "widgets": template.get("widgets").cloned().unwrap_or_else(|| json!([])),
        "createdAt": now,
        "updatedAt": now,
        "createdBy": created_by,
    }))
}

pub fn build_widget_payload(cache_store: &CacheStore, widgets: &[Value]) -> Result<Value, String> {
    let news = cache_store.read_json("news.json").ok();
    let social = cache_store.read_json("social.json").ok();
    let crypto = cache_store.read_json("crypto.json").ok();
    let monitor = cache_store.read_json("api-health.json").ok();
    let price = cache_store.read_json("price-history.json").ok();

    let mut results = Vec::with_capacity(widgets.len());

    for widget in widgets {
        let widget_id = widget
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or("unknown-widget")
            .to_string();
        let source = widget
            .get("source")
            .and_then(Value::as_str)
            .unwrap_or("unknown");
        let widget_type = widget.get("type").and_then(Value::as_str).unwrap_or("list");
        let limit = widget.get("limit").and_then(Value::as_u64).unwrap_or(10) as usize;
        let data_key = widget.get("dataKey").and_then(Value::as_str);
        let filters = widget.get("filters");

        let data = match source {
            "crypto" => build_crypto_widget_data(crypto.as_ref(), widget_type, limit, data_key),
            "news" => build_news_widget_data(news.as_ref(), limit, filters),
            "social" => build_social_widget_data(social.as_ref(), limit, filters),
            "monitor" => build_monitor_widget_data(monitor.as_ref(), limit, filters),
            "price" => build_price_widget_data(price.as_ref(), limit, filters),
            "scraper" => json!({ "recentJobs": [], "totalJobs": 0, "successRate": 0 }),
            "seo" => json!({ "recentAnalyses": [], "totalAnalyses": 0 }),
            _ => json!({ "error": format!("Unsupported widget source: {}", source) }),
        };

        results.push(json!({
            "widgetId": widget_id,
            "timestamp": Utc::now().to_rfc3339(),
            "data": data,
        }));
    }

    Ok(json!({ "widgets": results }))
}

pub fn build_price_products_payload(products: &[Value]) -> Result<Value, String> {
    Ok(json!({
        "success": true,
        "count": products.len(),
        "products": products,
    }))
}

pub fn build_price_product_payload(products: &[Value], id: &str) -> Option<Value> {
    let product = products
        .iter()
        .find(|product| product.get("id").and_then(Value::as_str) == Some(id))?;

    Some(json!({
        "success": true,
        "product": product,
    }))
}

pub fn build_price_stats_payload(products: &[Value], id: &str) -> Option<Value> {
    let product = products
        .iter()
        .find(|product| product.get("id").and_then(Value::as_str) == Some(id))?;
    let history = product.get("priceHistory")?.as_array()?;

    let prices: Vec<f64> = history
        .iter()
        .filter_map(|point| point.get("price").and_then(Value::as_f64))
        .collect();

    if prices.is_empty() {
        return None;
    }

    let lowest_price = prices.iter().fold(f64::INFINITY, |min, price| min.min(*price));
    let highest_price = prices.iter().fold(f64::NEG_INFINITY, |max, price| max.max(*price));
    let average_price = prices.iter().sum::<f64>() / prices.len() as f64;
    let last_price = *prices.last()?;
    let first_price = *prices.first()?;
    let price_change = last_price - first_price;
    let price_change_percent = if first_price == 0.0 {
        0.0
    } else {
        (price_change / first_price) * 100.0
    };

    Some(json!({
        "success": true,
        "stats": {
            "lowestPrice": lowest_price,
            "highestPrice": highest_price,
            "averagePrice": average_price,
            "lastPrice": last_price,
            "priceChange": price_change,
            "priceChangePercent": price_change_percent,
        }
    }))
}

pub fn build_price_export_csv(products: &[Value], id: &str) -> Option<String> {
    let product = products
        .iter()
        .find(|product| product.get("id").and_then(Value::as_str) == Some(id))?;

    let name = product.get("name").and_then(Value::as_str).unwrap_or("Product");
    let history = product.get("priceHistory")?.as_array()?;

    let mut csv = String::from("product,timestamp,price,available\n");
    for point in history {
        let timestamp = point.get("timestamp").and_then(Value::as_str).unwrap_or_default();
        let price = point.get("price").and_then(Value::as_f64).unwrap_or_default();
        let available = point.get("available").and_then(Value::as_bool).unwrap_or(false);
        csv.push_str(&format!("\"{}\",{},{},{}\n", name.replace('"', "'"), timestamp, price, available));
    }

    Some(csv)
}

fn build_crypto_widget_data(
    crypto: Option<&Value>,
    widget_type: &str,
    limit: usize,
    data_key: Option<&str>,
) -> Value {
    let Some(crypto) = crypto else {
        return json!({ "coins": [], "fearGreedIndex": null, "marketStats": null });
    };

    let coins = crypto
        .get("coins")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    let mapped_coins: Vec<Value> = coins
        .into_iter()
        .take(limit)
        .map(|coin| {
            json!({
                "name": coin.get("name").and_then(Value::as_str).unwrap_or("Unknown"),
                "symbol": coin.get("symbol").and_then(Value::as_str).unwrap_or("-"),
                "price": coin.get("current_price").and_then(Value::as_f64).unwrap_or_default(),
                "change24h": coin.get("price_change_percentage_24h").and_then(Value::as_f64).unwrap_or_default(),
                "marketCap": coin.get("market_cap").and_then(Value::as_f64).unwrap_or_default(),
            })
        })
        .collect();

    if widget_type == "stat" {
        return match data_key.unwrap_or("fearGreedIndex") {
            "marketStats" => json!({
                "marketStats": {
                    "totalMarketCap": crypto.get("marketStats").and_then(|v| v.get("total_market_cap")).and_then(Value::as_f64).unwrap_or_default(),
                    "totalVolume": crypto.get("marketStats").and_then(|v| v.get("total_volume")).and_then(Value::as_f64).unwrap_or_default(),
                    "btcDominance": crypto.get("marketStats").and_then(|v| v.get("btc_dominance")).and_then(Value::as_f64).unwrap_or_default(),
                }
            }),
            _ => json!({
                "fearGreedIndex": {
                    "value": crypto.get("fearGreedIndex").and_then(|v| v.get("value")).and_then(Value::as_i64).unwrap_or_default(),
                    "classification": crypto.get("fearGreedIndex").and_then(|v| v.get("value_classification")).and_then(Value::as_str).unwrap_or("Unknown"),
                }
            }),
        };
    }

    json!({ "coins": mapped_coins })
}

fn build_news_widget_data(news: Option<&Value>, limit: usize, filters: Option<&Value>) -> Value {
    let Some(news) = news else {
        return json!({ "articles": [], "totalCount": 0 });
    };

    let category_filter = filters
        .and_then(|value| value.get("category"))
        .and_then(Value::as_str);
    let sentiment_filter = filters
        .and_then(|value| value.get("sentiment"))
        .and_then(Value::as_str);

    let mut articles = news
        .get("articles")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    articles.retain(|article| {
        let category_ok = category_filter
            .map(|category| article.get("category").and_then(Value::as_str) == Some(category))
            .unwrap_or(true);
        let sentiment_ok = sentiment_filter
            .map(|sentiment| article.get("sentiment").and_then(Value::as_str) == Some(sentiment))
            .unwrap_or(true);
        category_ok && sentiment_ok
    });

    let total_count = articles.len();

    json!({
        "articles": articles.into_iter().take(limit).map(|article| json!({
            "id": article.get("id").and_then(Value::as_str).unwrap_or_default(),
            "title": article.get("title").and_then(Value::as_str).unwrap_or("Untitled"),
            "source": article.get("sourceName").and_then(Value::as_str).unwrap_or("Unknown"),
            "category": article.get("category").and_then(Value::as_str).unwrap_or("General"),
            "sentiment": article.get("sentiment").and_then(Value::as_str).unwrap_or("neutral"),
            "pubDate": article.get("pubDate").and_then(Value::as_str).unwrap_or_default(),
            "link": article.get("link").and_then(Value::as_str).unwrap_or("#"),
        })).collect::<Vec<_>>(),
        "totalCount": total_count,
    })
}

fn build_social_widget_data(social: Option<&Value>, limit: usize, filters: Option<&Value>) -> Value {
    let Some(social) = social else {
        return json!({ "posts": [], "totalCount": 0 });
    };

    let platform_filter = filters
        .and_then(|value| value.get("platform"))
        .and_then(Value::as_str);

    let mut posts = social
        .get("posts")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    posts.retain(|post| {
        platform_filter
            .map(|platform| post.get("platform").and_then(Value::as_str) == Some(platform))
            .unwrap_or(true)
    });

    let total_count = posts.len();

    json!({
        "posts": posts.into_iter().take(limit).map(|post| json!({
            "id": post.get("id").and_then(Value::as_str).unwrap_or_default(),
            "platform": post.get("platform").and_then(Value::as_str).unwrap_or("Unknown"),
            "title": post.get("title").and_then(Value::as_str).unwrap_or("Untitled"),
            "score": post.get("score").and_then(Value::as_i64).unwrap_or_default(),
            "metadata": post.get("metadata").and_then(Value::as_str).unwrap_or_default(),
            "url": post.get("url").and_then(Value::as_str).unwrap_or("#"),
            "timestamp": post.get("timestamp").and_then(Value::as_i64).unwrap_or_default(),
        })).collect::<Vec<_>>(),
        "totalCount": total_count,
    })
}

fn build_monitor_widget_data(monitor: Option<&Value>, limit: usize, filters: Option<&Value>) -> Value {
    let Some(monitor) = monitor else {
        return json!({
            "endpoints": [],
            "summary": { "total": 0, "up": 0, "down": 0, "unknown": 0 }
        });
    };

    let status_filter = filters
        .and_then(|value| value.get("status"))
        .and_then(Value::as_str);
    let enabled_filter = filters
        .and_then(|value| value.get("enabled"))
        .and_then(Value::as_bool);

    let mut endpoints = monitor
        .get("endpoints")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    endpoints.retain(|endpoint| {
        let status_ok = status_filter
            .map(|status| endpoint.get("currentStatus").and_then(Value::as_str) == Some(status))
            .unwrap_or(true);
        let enabled_ok = enabled_filter
            .map(|enabled| endpoint.get("enabled").and_then(Value::as_bool) == Some(enabled))
            .unwrap_or(true);
        status_ok && enabled_ok
    });

    let total = endpoints.len();
    let up = endpoints
        .iter()
        .filter(|endpoint| endpoint.get("currentStatus").and_then(Value::as_str) == Some("up"))
        .count();
    let down = endpoints
        .iter()
        .filter(|endpoint| endpoint.get("currentStatus").and_then(Value::as_str) == Some("down"))
        .count();
    let unknown = endpoints
        .iter()
        .filter(|endpoint| endpoint.get("currentStatus").and_then(Value::as_str) == Some("unknown"))
        .count();

    json!({
        "endpoints": endpoints.into_iter().take(limit).map(|endpoint| json!({
            "id": endpoint.get("id").and_then(Value::as_str).unwrap_or_default(),
            "name": endpoint.get("name").and_then(Value::as_str).unwrap_or("Endpoint"),
            "url": endpoint.get("url").and_then(Value::as_str).unwrap_or("#"),
            "status": endpoint.get("currentStatus").and_then(Value::as_str).unwrap_or("unknown"),
            "uptime24h": endpoint.get("uptimeStats").and_then(|value| value.get("24h")).and_then(|value| value.get("uptimePercent")).and_then(Value::as_f64).unwrap_or_default(),
            "responseTime": endpoint.get("lastResponseTime").and_then(Value::as_i64).unwrap_or_default(),
            "lastCheck": endpoint.get("lastCheck").and_then(Value::as_str).unwrap_or_default(),
        })).collect::<Vec<_>>(),
        "summary": {
            "total": total,
            "up": up,
            "down": down,
            "unknown": unknown,
        }
    })
}

fn build_price_widget_data(price: Option<&Value>, limit: usize, filters: Option<&Value>) -> Value {
    let marketplace_filter = filters
        .and_then(|value| value.get("marketplace"))
        .and_then(Value::as_str);
    let available_filter = filters
        .and_then(|value| value.get("available"))
        .and_then(Value::as_bool);

    let mut products = price
        .and_then(|value| value.get("products").and_then(Value::as_array).cloned())
        .filter(|products| !products.is_empty())
        .unwrap_or_else(|| seed_price_products(&CacheStore::new()));

    products.retain(|product| {
        let marketplace_ok = marketplace_filter
            .map(|marketplace| product.get("marketplace").and_then(Value::as_str) == Some(marketplace))
            .unwrap_or(true);
        let available_ok = available_filter
            .map(|available| product.get("available").and_then(Value::as_bool) == Some(available))
            .unwrap_or(true);
        marketplace_ok && available_ok
    });

    let total_count = products.len();

    json!({
        "products": products.into_iter().take(limit).map(|product| json!({
            "id": product.get("id").and_then(Value::as_str).unwrap_or_default(),
            "name": product.get("name").and_then(Value::as_str).unwrap_or("Product"),
            "marketplace": product.get("marketplace").and_then(Value::as_str).unwrap_or("Unknown"),
            "currentPrice": product.get("currentPrice").and_then(Value::as_f64).unwrap_or_default(),
            "currency": product.get("currency").and_then(Value::as_str).unwrap_or("USD"),
            "priceChange": 0,
            "priceChangePercent": 0,
            "available": product.get("available").and_then(Value::as_bool).unwrap_or(false),
        })).collect::<Vec<_>>(),
        "totalCount": total_count,
    })
}

pub fn seed_price_products(cache_store: &CacheStore) -> Vec<Value> {
    let from_cache = cache_store
        .read_json("price-history.json")
        .ok()
        .and_then(|price| price.get("products").and_then(Value::as_array).cloned())
        .unwrap_or_default();

    if !from_cache.is_empty() {
        return from_cache;
    }

    vec![
        json!({
            "id": "product-iphone-15-pro-max",
            "url": "https://www.trendyol.com/apple/iphone-15-pro-max-256gb-p-123",
            "name": "Apple iPhone 15 Pro Max 256GB",
            "currentPrice": 61999.0,
            "currency": "TRY",
            "available": true,
            "imageUrl": "https://images.unsplash.com/photo-1695048133142-1a20484d2569?auto=format&fit=crop&w=400&q=80",
            "marketplace": "trendyol",
            "lastChecked": "2026-03-22T12:45:00.000Z",
            "priceHistory": [
                {"price": 65999.0, "timestamp": "2026-03-18T09:00:00.000Z", "available": true},
                {"price": 64999.0, "timestamp": "2026-03-19T09:00:00.000Z", "available": true},
                {"price": 63999.0, "timestamp": "2026-03-20T09:00:00.000Z", "available": true},
                {"price": 62999.0, "timestamp": "2026-03-21T09:00:00.000Z", "available": true},
                {"price": 61999.0, "timestamp": "2026-03-22T12:45:00.000Z", "available": true}
            ]
        }),
        json!({
            "id": "product-galaxy-s24-ultra",
            "url": "https://www.hepsiburada.com/samsung-galaxy-s24-ultra-p-456",
            "name": "Samsung Galaxy S24 Ultra 512GB",
            "currentPrice": 69999.0,
            "currency": "TRY",
            "available": true,
            "imageUrl": "https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?auto=format&fit=crop&w=400&q=80",
            "marketplace": "hepsiburada",
            "lastChecked": "2026-03-22T12:40:00.000Z",
            "priceHistory": [
                {"price": 74999.0, "timestamp": "2026-03-18T09:00:00.000Z", "available": true},
                {"price": 73999.0, "timestamp": "2026-03-19T09:00:00.000Z", "available": true},
                {"price": 72999.0, "timestamp": "2026-03-20T09:00:00.000Z", "available": true},
                {"price": 71999.0, "timestamp": "2026-03-21T09:00:00.000Z", "available": true},
                {"price": 69999.0, "timestamp": "2026-03-22T12:40:00.000Z", "available": true}
            ]
        }),
        json!({
            "id": "product-ps5-slim",
            "url": "https://www.n11.com/sony-playstation-5-slim-p-789",
            "name": "Sony PlayStation 5 Slim",
            "currentPrice": 28499.0,
            "currency": "TRY",
            "available": false,
            "imageUrl": "https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?auto=format&fit=crop&w=400&q=80",
            "marketplace": "n11",
            "lastChecked": "2026-03-22T12:30:00.000Z",
            "priceHistory": [
                {"price": 27999.0, "timestamp": "2026-03-18T09:00:00.000Z", "available": true},
                {"price": 28249.0, "timestamp": "2026-03-19T09:00:00.000Z", "available": true},
                {"price": 28699.0, "timestamp": "2026-03-20T09:00:00.000Z", "available": true},
                {"price": 28499.0, "timestamp": "2026-03-21T09:00:00.000Z", "available": false},
                {"price": 28499.0, "timestamp": "2026-03-22T12:30:00.000Z", "available": false}
            ]
        }),
    ]
}
