use chrono::Utc;
use rand::Rng;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct Product {
    pub id: String,
    pub name: String,
    pub category: String,
    pub price: f64,
    pub currency: String,
    pub price_history: Vec<PricePoint>,
    pub source: String,
    pub rating: f64,
    pub review_count: u32,
    pub in_stock: bool,
    pub url: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PricePoint {
    pub date: String,
    pub price: f64,
}

/// Return 20 mock products with slight random variation on each call.
pub fn get_products() -> Vec<Product> {
    let mut rng = rand::thread_rng();

    let base_products = vec![
        ("elec-001", "Samsung Galaxy S24 Ultra", "Electronics", 42999.0, "Trendyol", 4.8, 3421),
        ("elec-002", "Apple MacBook Air M3", "Electronics", 54999.0, "Hepsiburada", 4.9, 1876),
        ("elec-003", "Sony WH-1000XM5 Headphones", "Electronics", 11499.0, "Trendyol", 4.7, 2103),
        ("elec-004", "iPad Pro 12.9\" M2", "Electronics", 38999.0, "Hepsiburada", 4.8, 945),
        ("elec-005", "LG C3 65\" OLED TV", "Electronics", 64999.0, "Trendyol", 4.9, 567),
        ("elec-006", "Dyson V15 Detect Vacuum", "Electronics", 24999.0, "Hepsiburada", 4.6, 832),
        ("elec-007", "Logitech MX Master 3S", "Electronics", 3299.0, "Trendyol", 4.7, 4521),
        ("elec-008", "PlayStation 5 Slim", "Electronics", 18499.0, "Hepsiburada", 4.8, 6712),
        ("elec-009", "Anker 737 Power Bank", "Electronics", 2799.0, "Trendyol", 4.5, 1543),
        ("elec-010", "Bose QuietComfort Ultra", "Electronics", 13999.0, "Hepsiburada", 4.6, 987),
        ("cloth-001", "Nike Air Max 270", "Clothing", 4299.0, "Trendyol", 4.5, 8934),
        ("cloth-002", "Adidas Ultraboost 23", "Clothing", 5199.0, "Hepsiburada", 4.6, 3210),
        ("cloth-003", "Levi's 501 Original Jeans", "Clothing", 2499.0, "Trendyol", 4.4, 5678),
        ("cloth-004", "The North Face Thermoball Jacket", "Clothing", 7999.0, "Hepsiburada", 4.7, 1234),
        ("cloth-005", "Zara Wool Blend Overcoat", "Clothing", 3999.0, "Trendyol", 4.3, 2456),
        ("cloth-006", "H&M Regular Fit Oxford Shirt", "Clothing", 799.0, "Hepsiburada", 4.2, 7890),
        ("cloth-007", "Puma RS-X Sneakers", "Clothing", 3599.0, "Trendyol", 4.4, 1567),
        ("cloth-008", "Columbia Hiking Boots", "Clothing", 4799.0, "Hepsiburada", 4.6, 2890),
        ("cloth-009", "Mango Knit Sweater", "Clothing", 1299.0, "Trendyol", 4.1, 3456),
        ("cloth-010", "Tommy Hilfiger Polo Shirt", "Clothing", 1899.0, "Hepsiburada", 4.5, 4123),
    ];

    base_products
        .into_iter()
        .map(|(id, name, category, base_price, source, rating, reviews)| {
            let variation: f64 = rng.gen_range(-0.02..0.02);
            let price = (base_price * (1.0 + variation) * 100.0).round() / 100.0;

            let price_history = generate_price_history(base_price, 30, &mut rng);

            Product {
                id: id.to_string(),
                name: name.to_string(),
                category: category.to_string(),
                price,
                currency: "TRY".to_string(),
                price_history,
                source: source.to_string(),
                rating: ((rating as f64 + rng.gen_range(-0.1_f64..0.1)) * 10.0).round() / 10.0,
                review_count: (reviews as f64 * (1.0 + rng.gen_range(-0.05..0.05))) as u32,
                in_stock: rng.gen_bool(0.85),
                url: format!("https://{}.com/p/{}", source.to_lowercase(), id),
            }
        })
        .collect()
}

/// Return 30-day price history for a given product.
pub fn get_price_trends(product_id: &str) -> Vec<PricePoint> {
    let mut rng = rand::thread_rng();

    let base_price = match product_id {
        "elec-001" => 42999.0,
        "elec-002" => 54999.0,
        "elec-003" => 11499.0,
        "elec-004" => 38999.0,
        "elec-005" => 64999.0,
        "elec-006" => 24999.0,
        "elec-007" => 3299.0,
        "elec-008" => 18499.0,
        "elec-009" => 2799.0,
        "elec-010" => 13999.0,
        "cloth-001" => 4299.0,
        "cloth-002" => 5199.0,
        "cloth-003" => 2499.0,
        "cloth-004" => 7999.0,
        "cloth-005" => 3999.0,
        "cloth-006" => 799.0,
        "cloth-007" => 3599.0,
        "cloth-008" => 4799.0,
        "cloth-009" => 1299.0,
        "cloth-010" => 1899.0,
        _ => 1000.0,
    };

    generate_price_history(base_price, 30, &mut rng)
}

fn generate_price_history(base_price: f64, days: usize, rng: &mut impl Rng) -> Vec<PricePoint> {
    let now = Utc::now();
    (0..days)
        .map(|i| {
            let date = now - chrono::Duration::days((days - 1 - i) as i64);
            let variation: f64 = rng.gen_range(-0.05..0.05);
            let price = (base_price * (1.0 + variation) * 100.0).round() / 100.0;
            PricePoint {
                date: date.format("%Y-%m-%d").to_string(),
                price,
            }
        })
        .collect()
}
