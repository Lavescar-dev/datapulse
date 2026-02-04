use chrono::Utc;
use rand::Rng;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct TrendingTopic {
    pub id: String,
    pub name: String,
    pub mention_count: u64,
    pub sentiment: SentimentBreakdown,
    pub platform: String,
    pub hashtag: String,
    pub peak_hour: String,
    pub trending_since: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct SentimentBreakdown {
    pub positive: f64,
    pub negative: f64,
    pub neutral: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct SentimentOverTime {
    pub topic: String,
    pub data_points: Vec<SentimentDataPoint>,
    pub overall: SentimentBreakdown,
    pub total_mentions: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct SentimentDataPoint {
    pub timestamp: String,
    pub positive: f64,
    pub negative: f64,
    pub neutral: f64,
    pub mention_count: u64,
}

/// Return 15 mock trending topics.
pub fn get_trends() -> Vec<TrendingTopic> {
    let mut rng = rand::thread_rng();
    let now = Utc::now();

    let topics = vec![
        ("tech-ai", "AI Regulation", 124500, 42.0, 28.0, 30.0, "Twitter", "#AIRegulation"),
        ("tech-quantum", "Quantum Computing", 89200, 61.0, 12.0, 27.0, "Twitter", "#QuantumComputing"),
        ("sports-ucl", "Champions League", 312000, 55.0, 20.0, 25.0, "Twitter", "#UCL"),
        ("gaming-gta", "GTA VI Trailer", 567000, 72.0, 8.0, 20.0, "Reddit", "#GTAVI"),
        ("music-grammy", "Grammy Awards 2026", 234000, 48.0, 32.0, 20.0, "Instagram", "#Grammys"),
        ("finance-btc", "Bitcoin Rally", 178000, 65.0, 18.0, 17.0, "Twitter", "#Bitcoin"),
        ("health-mental", "Mental Health Awareness", 91200, 58.0, 15.0, 27.0, "Instagram", "#MentalHealth"),
        ("climate-cop", "COP31 Summit", 67800, 35.0, 40.0, 25.0, "Twitter", "#COP31"),
        ("food-vegan", "Veganuary Results", 45600, 52.0, 22.0, 26.0, "Instagram", "#Veganuary"),
        ("space-mars", "Mars Mission Update", 156000, 78.0, 5.0, 17.0, "Reddit", "#MarsUpdate"),
        ("fashion-week", "Paris Fashion Week", 203000, 62.0, 14.0, 24.0, "Instagram", "#PFW"),
        ("politics-election", "EU Policy Reform", 134000, 30.0, 45.0, 25.0, "Twitter", "#EUReform"),
        ("education-remote", "Remote Learning Stats", 56700, 40.0, 35.0, 25.0, "Reddit", "#RemoteLearning"),
        ("auto-ev", "EV Battery Breakthrough", 98400, 70.0, 10.0, 20.0, "Twitter", "#EVBattery"),
        ("social-threads", "Threads vs Twitter", 189000, 38.0, 34.0, 28.0, "Reddit", "#ThreadsVsTwitter"),
    ];

    topics
        .into_iter()
        .enumerate()
        .map(|(i, (id, name, mentions, pos, neg, neu, platform, hashtag))| {
            let variation = rng.gen_range(0.9..1.1);
            let trending_since = now - chrono::Duration::hours(rng.gen_range(2..48));

            TrendingTopic {
                id: id.to_string(),
                name: name.to_string(),
                mention_count: (mentions as f64 * variation) as u64,
                sentiment: SentimentBreakdown {
                    positive: (pos as f64 + rng.gen_range(-3.0_f64..3.0)).clamp(0.0, 100.0),
                    negative: (neg as f64 + rng.gen_range(-3.0_f64..3.0)).clamp(0.0, 100.0),
                    neutral: (neu as f64 + rng.gen_range(-3.0_f64..3.0)).clamp(0.0, 100.0),
                },
                platform: platform.to_string(),
                hashtag: hashtag.to_string(),
                peak_hour: format!("{:02}:00 UTC", (10 + i * 2) % 24),
                trending_since: trending_since.to_rfc3339(),
            }
        })
        .collect()
}

/// Return detailed sentiment-over-time for a given topic.
pub fn get_sentiment(topic: &str) -> SentimentOverTime {
    let mut rng = rand::thread_rng();
    let now = Utc::now();

    let base_positive: f64 = rng.gen_range(35.0..65.0);
    let base_negative: f64 = rng.gen_range(10.0..35.0);
    let base_neutral: f64 = 100.0 - base_positive - base_negative;

    let data_points: Vec<SentimentDataPoint> = (0..24)
        .map(|i| {
            let timestamp = now - chrono::Duration::hours(23 - i);
            SentimentDataPoint {
                timestamp: timestamp.to_rfc3339(),
                positive: (base_positive + rng.gen_range(-8.0_f64..8.0)).clamp(0.0, 100.0),
                negative: (base_negative + rng.gen_range(-5.0_f64..5.0)).clamp(0.0, 100.0),
                neutral: (base_neutral + rng.gen_range(-5.0_f64..5.0)).clamp(0.0, 100.0),
                mention_count: rng.gen_range(500..5000),
            }
        })
        .collect();

    let total_mentions: u64 = data_points.iter().map(|d| d.mention_count).sum();

    SentimentOverTime {
        topic: topic.to_string(),
        data_points,
        overall: SentimentBreakdown {
            positive: (base_positive * 10.0).round() / 10.0,
            negative: (base_negative * 10.0).round() / 10.0,
            neutral: (base_neutral * 10.0).round() / 10.0,
        },
        total_mentions,
    }
}
