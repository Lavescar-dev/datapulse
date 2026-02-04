use chrono::Utc;
use rand::seq::SliceRandom;
use rand::Rng;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct NewsArticle {
    pub id: String,
    pub title: String,
    pub source: String,
    pub published_at: String,
    pub category: String,
    pub summary: String,
    pub url: String,
    pub author: String,
    pub read_time_minutes: u32,
    pub image_url: String,
}

/// Return 25 mock news articles with realistic timestamps.
pub fn get_feed() -> Vec<NewsArticle> {
    let mut rng = rand::thread_rng();
    let now = Utc::now();

    let articles = vec![
        (
            "Global AI Summit Concludes with Landmark Safety Agreement",
            "Reuters",
            "Technology",
            "World leaders reached consensus on AI safety protocols at the Geneva summit, establishing binding guidelines for frontier model development.",
            "Dr. Sarah Mitchell",
        ),
        (
            "European Central Bank Holds Rates Steady Amid Inflation Concerns",
            "Financial Times",
            "Finance",
            "The ECB maintained its benchmark rate at 3.25%, citing persistent core inflation despite softening energy prices across the eurozone.",
            "James Crawford",
        ),
        (
            "SpaceX Successfully Launches First Commercial Mars Cargo Mission",
            "Space.com",
            "Science",
            "The Starship Heavy lifted off from Boca Chica carrying 50 tonnes of pre-positioned supplies for the planned 2028 crewed Mars mission.",
            "Emily Zhang",
        ),
        (
            "Breakthrough Battery Technology Promises 1000-Mile EV Range",
            "Ars Technica",
            "Technology",
            "Researchers at Stanford unveiled a solid-state lithium-sulfur battery achieving 950 Wh/kg energy density, potentially revolutionizing electric vehicle range.",
            "Marcus Rivera",
        ),
        (
            "Champions League Quarter-Final Draw Produces Dream Matchups",
            "ESPN",
            "Sports",
            "The UEFA Champions League draw paired Real Madrid against Manchester City and Bayern Munich against Barcelona in highly anticipated quarter-final ties.",
            "David O'Brien",
        ),
        (
            "Major Cybersecurity Vulnerability Found in IoT Devices Worldwide",
            "Wired",
            "Technology",
            "Security researchers disclosed a critical flaw affecting an estimated 2 billion connected devices, prompting emergency patches from major manufacturers.",
            "Alex Kowalski",
        ),
        (
            "UN Climate Report Warns of Accelerating Arctic Ice Loss",
            "BBC News",
            "Environment",
            "New satellite data reveals Arctic sea ice is declining 15% faster than previous models predicted, with potential ice-free summers by 2035.",
            "Dr. Rachel Green",
        ),
        (
            "Tokyo Stock Exchange Reaches All-Time High",
            "Bloomberg",
            "Finance",
            "The Nikkei 225 surged past 45,000 for the first time, driven by strong semiconductor earnings and a weakening yen boosting export competitiveness.",
            "Kenji Tanaka",
        ),
        (
            "WHO Declares New Pandemic Preparedness Framework",
            "The Guardian",
            "Health",
            "The World Health Organization launched a comprehensive early-warning system integrating genomic surveillance across 180 member nations.",
            "Lisa Andersen",
        ),
        (
            "Quantum Computing Milestone: First Error-Corrected Calculation",
            "Nature",
            "Science",
            "Google DeepMind achieved the first fully error-corrected quantum computation using 1,000 physical qubits, marking a pivotal step toward practical quantum advantage.",
            "Prof. Michael Chen",
        ),
        (
            "Global Shipping Disruptions Ease as Red Sea Tensions Subside",
            "CNBC",
            "Business",
            "Container shipping rates dropped 30% as major carriers resumed Red Sea transit routes following diplomatic breakthroughs in the region.",
            "Hannah Brooks",
        ),
        (
            "India Surpasses China as World's Most Populous Nation by UN Metrics",
            "Al Jazeera",
            "World",
            "Updated census data confirms India's population at 1.44 billion, with demographic shifts expected to reshape global economic dynamics over the coming decades.",
            "Priya Sharma",
        ),
        (
            "New CRISPR Therapy Shows Promise for Sickle Cell Disease",
            "STAT News",
            "Health",
            "Phase III clinical trial results demonstrated 94% efficacy in eliminating pain crises for sickle cell patients using a single-dose gene editing treatment.",
            "Dr. Thomas Wright",
        ),
        (
            "Renewable Energy Surpasses Fossil Fuels in EU Power Generation",
            "Euronews",
            "Environment",
            "For the first time, wind and solar generated more electricity than coal and gas combined across the European Union in a full calendar year.",
            "Marie Dubois",
        ),
        (
            "Hollywood Actors Ratify New AI Likeness Protection Agreement",
            "Variety",
            "Entertainment",
            "SAG-AFTRA members overwhelmingly approved a contract establishing strict consent and compensation frameworks for AI-generated performances.",
            "Jordan Hayes",
        ),
        (
            "Central African Mining Deal Sparks International Resource Debate",
            "The Economist",
            "Business",
            "A $12 billion rare-earth mining agreement between the DRC and a consortium of Asian firms reignited discussions about resource sovereignty.",
            "Robert Okafor",
        ),
        (
            "Self-Driving Taxi Services Expand to 15 New US Cities",
            "TechCrunch",
            "Technology",
            "Waymo and Cruise announced simultaneous expansions, bringing autonomous ride-hailing to medium-sized cities following updated federal safety frameworks.",
            "Sophia Martinez",
        ),
        (
            "Global Wheat Prices Surge After Australian Drought Worsens",
            "AgriPulse",
            "Finance",
            "Commodity markets reacted sharply as Australia's Bureau of Meteorology downgraded harvest projections by 40%, threatening global food supply chains.",
            "Peter Hennessy",
        ),
        (
            "Ancient Roman City Discovered Beneath Istanbul Construction Site",
            "National Geographic",
            "Culture",
            "Archaeologists uncovered a remarkably preserved Roman settlement dating to the 3rd century AD during metro expansion excavations near the Golden Horn.",
            "Dr. Elif Yilmaz",
        ),
        (
            "World's Largest Offshore Wind Farm Begins Operations in North Sea",
            "Energy Monitor",
            "Environment",
            "The 4.1 GW Dogger Bank wind farm achieved full operational capacity, capable of powering 6 million UK homes with clean energy.",
            "Oliver Walsh",
        ),
        (
            "Federal Reserve Signals Potential Rate Cuts in Q2 2026",
            "Wall Street Journal",
            "Finance",
            "Fed Chair's testimony indicated growing confidence in inflation trends, with markets now pricing in three 25-basis-point cuts beginning in April.",
            "Catherine Blake",
        ),
        (
            "Major Social Media Platforms Implement Age Verification Systems",
            "The Verge",
            "Technology",
            "Meta, TikTok, and X rolled out mandatory identity verification for users under 18, complying with new EU and US digital safety regulations.",
            "Tyler Kim",
        ),
        (
            "Olympic Committee Announces Esports Exhibition Events for 2028 LA Games",
            "Polygon",
            "Sports",
            "Five competitive gaming titles will be featured as exhibition events at the 2028 Los Angeles Olympics, marking a historic step for competitive gaming.",
            "Ryan Patel",
        ),
        (
            "Global Microchip Shortage Finally Easing, Industry Reports Show",
            "Semiconductor Weekly",
            "Technology",
            "Leading foundries reported utilization rates returning to normal levels as new fabrication facilities in the US, Japan, and EU reach production capacity.",
            "Dr. Hiro Nakamura",
        ),
        (
            "Record-Breaking Coral Reef Recovery Observed in Great Barrier Reef",
            "ABC Australia",
            "Environment",
            "Marine biologists documented unprecedented coral growth across 60% of surveyed sites, attributed to coordinated conservation efforts and cooler-than-expected water temperatures.",
            "Dr. Claire Bennett",
        ),
    ];

    articles
        .into_iter()
        .enumerate()
        .map(|(i, (title, source, category, summary, author))| {
            let hours_ago = rng.gen_range(1..72);
            let published = now - chrono::Duration::hours(hours_ago);

            NewsArticle {
                id: format!("news-{:03}", i + 1),
                title: title.to_string(),
                source: source.to_string(),
                published_at: published.to_rfc3339(),
                category: category.to_string(),
                summary: summary.to_string(),
                url: format!(
                    "https://{}.com/articles/{}",
                    source.to_lowercase().replace(' ', ""),
                    slug(title)
                ),
                author: author.to_string(),
                read_time_minutes: *[3u32, 4, 5, 6, 7, 8].choose(&mut rng).unwrap(),
                image_url: format!("https://picsum.photos/seed/{}/800/400", i + 100),
            }
        })
        .collect()
}

fn slug(s: &str) -> String {
    s.to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|p| !p.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}
