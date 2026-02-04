use chrono::Utc;
use rand::Rng;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct WeatherData {
    pub city: String,
    pub country: String,
    pub current: CurrentWeather,
    pub forecast: Vec<ForecastDay>,
    pub last_updated: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct CurrentWeather {
    pub temperature_c: f64,
    pub feels_like_c: f64,
    pub humidity: u32,
    pub wind_speed_kmh: f64,
    pub wind_direction: String,
    pub condition: String,
    pub uv_index: u32,
    pub visibility_km: f64,
    pub pressure_hpa: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct ForecastDay {
    pub date: String,
    pub high_c: f64,
    pub low_c: f64,
    pub condition: String,
    pub precipitation_chance: u32,
    pub humidity: u32,
    pub wind_speed_kmh: f64,
}

/// Return weather data for the given city (defaults to Istanbul).
pub fn get_weather(city: &str) -> WeatherData {
    let mut rng = rand::thread_rng();
    let now = Utc::now();

    let (city_name, country, base_temp, base_humidity, condition) = match city.to_lowercase().as_str()
    {
        "london" => ("London", "United Kingdom", 8.0, 75u32, "Overcast"),
        "new york" | "newyork" => ("New York", "United States", 2.0, 55, "Partly Cloudy"),
        "tokyo" => ("Tokyo", "Japan", 10.0, 50, "Clear"),
        "paris" => ("Paris", "France", 7.0, 70, "Light Rain"),
        "berlin" => ("Berlin", "Germany", 3.0, 65, "Cloudy"),
        "sydney" => ("Sydney", "Australia", 26.0, 60, "Sunny"),
        "dubai" => ("Dubai", "UAE", 24.0, 40, "Sunny"),
        "moscow" => ("Moscow", "Russia", -5.0, 80, "Snow"),
        "mumbai" => ("Mumbai", "India", 30.0, 65, "Haze"),
        "ankara" => ("Ankara", "Turkey", 2.0, 60, "Partly Cloudy"),
        _ => ("Istanbul", "Turkey", 9.0, 68, "Partly Cloudy"),
    };

    let temp_var: f64 = rng.gen_range(-2.0..2.0);
    let temperature = (base_temp + temp_var).round();
    let feels_like = (temperature - rng.gen_range(1.0..4.0)).round();
    let wind_speed: f64 = (rng.gen_range(5.0_f64..30.0) * 10.0).round() / 10.0;

    let wind_directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    let wind_dir = wind_directions[rng.gen_range(0..8)];

    let conditions = ["Sunny", "Partly Cloudy", "Cloudy", "Overcast", "Light Rain", "Rain", "Clear"];

    let forecast: Vec<ForecastDay> = (1..=5)
        .map(|i| {
            let date = now + chrono::Duration::days(i);
            let day_var: f64 = rng.gen_range(-3.0..3.0);
            let high = (base_temp + day_var + rng.gen_range(2.0..6.0)).round();
            let low = (base_temp + day_var - rng.gen_range(2.0..5.0)).round();

            ForecastDay {
                date: date.format("%Y-%m-%d").to_string(),
                high_c: high,
                low_c: low,
                condition: conditions[rng.gen_range(0..conditions.len())].to_string(),
                precipitation_chance: rng.gen_range(0..80),
                humidity: (base_humidity as i32 + rng.gen_range(-15..15)).clamp(20, 95) as u32,
                wind_speed_kmh: (rng.gen_range(3.0_f64..35.0) * 10.0).round() / 10.0,
            }
        })
        .collect();

    WeatherData {
        city: city_name.to_string(),
        country: country.to_string(),
        current: CurrentWeather {
            temperature_c: temperature,
            feels_like_c: feels_like,
            humidity: (base_humidity as i32 + rng.gen_range(-10..10)).clamp(20, 95) as u32,
            wind_speed_kmh: wind_speed,
            wind_direction: wind_dir.to_string(),
            condition: condition.to_string(),
            uv_index: rng.gen_range(1..10),
            visibility_km: (rng.gen_range(5.0_f64..20.0) * 10.0).round() / 10.0,
            pressure_hpa: rng.gen_range(1005..1025),
        },
        forecast,
        last_updated: now.to_rfc3339(),
    }
}
