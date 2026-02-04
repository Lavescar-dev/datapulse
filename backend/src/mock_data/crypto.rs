use rand::Rng;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct CryptoPrice {
    pub id: String,
    pub symbol: String,
    pub name: String,
    pub current_price: f64,
    pub currency: String,
    pub change_24h: f64,
    pub change_24h_percent: f64,
    pub change_7d_percent: f64,
    pub market_cap: u64,
    pub volume_24h: u64,
    pub sparkline: Vec<f64>,
    pub rank: u32,
}

/// Return 10 mock crypto prices with slight random variation.
pub fn get_prices() -> Vec<CryptoPrice> {
    let mut rng = rand::thread_rng();

    let coins = vec![
        ("bitcoin", "BTC", "Bitcoin", 97_450.0, 1, 1_910_000_000_000u64, 42_300_000_000u64),
        ("ethereum", "ETH", "Ethereum", 3_280.0, 2, 394_000_000_000, 18_700_000_000),
        ("solana", "SOL", "Solana", 198.50, 3, 91_200_000_000, 5_400_000_000),
        ("bnb", "BNB", "BNB", 625.0, 4, 93_800_000_000, 2_100_000_000),
        ("xrp", "XRP", "XRP", 2.48, 5, 135_000_000_000, 8_900_000_000),
        ("cardano", "ADA", "Cardano", 0.92, 6, 32_600_000_000, 1_200_000_000),
        ("avalanche", "AVAX", "Avalanche", 38.75, 7, 15_800_000_000, 890_000_000),
        ("polkadot", "DOT", "Polkadot", 7.82, 8, 10_900_000_000, 420_000_000),
        ("chainlink", "LINK", "Chainlink", 19.45, 9, 12_300_000_000, 780_000_000),
        ("polygon", "MATIC", "Polygon", 0.87, 10, 8_100_000_000, 560_000_000),
    ];

    coins
        .into_iter()
        .map(|(id, symbol, name, base_price, rank, mcap, vol)| {
            let price_var: f64 = rng.gen_range(-0.005..0.005);
            let current_price: f64 =
                (base_price * (1.0 + price_var) * 100.0).round() / 100.0;

            let raw_change: f64 = rng.gen_range(-5.0..5.0);
            let change_24h_percent: f64 = (raw_change * 100.0).round() / 100.0;
            let change_24h: f64 = (current_price * change_24h_percent / 100.0 * 100.0).round() / 100.0;
            let change_7d_percent: f64 = (rng.gen_range(-12.0_f64..12.0) * 100.0).round() / 100.0;

            let sparkline: Vec<f64> = (0..24)
                .map(|_| {
                    let v: f64 = rng.gen_range(-0.03..0.03);
                    (base_price * (1.0 + v) * 100.0).round() / 100.0
                })
                .collect();

            let mcap_var = rng.gen_range(0.95..1.05);
            let vol_var = rng.gen_range(0.8..1.2);

            CryptoPrice {
                id: id.to_string(),
                symbol: symbol.to_string(),
                name: name.to_string(),
                current_price,
                currency: "USD".to_string(),
                change_24h,
                change_24h_percent,
                change_7d_percent,
                market_cap: (mcap as f64 * mcap_var) as u64,
                volume_24h: (vol as f64 * vol_var) as u64,
                sparkline,
                rank,
            }
        })
        .collect()
}
