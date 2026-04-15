import { Hono } from 'hono';

const weatherRoutes = new Hono();

interface WeatherData {
  city: string;
  country: string;
  current: {
    temperature_c: number;
    feels_like_c: number;
    humidity: number;
    wind_speed_kmh: number;
    wind_direction: string;
    pressure_hpa: number;
    visibility_km: number;
    uv_index: number;
    condition: string;
  };
  forecast: Array<{
    date: string;
    high_c: number;
    low_c: number;
    condition: string;
    precipitation_chance: number;
    humidity: number;
    wind_speed_kmh: number;
  }>;
  last_updated: string;
}

const cityData: Record<string, { country: string; baseTemp: number }> = {
  istanbul: { country: 'Turkey', baseTemp: 10 },
  london: { country: 'United Kingdom', baseTemp: 8 },
  newyork: { country: 'United States', baseTemp: 5 },
  tokyo: { country: 'Japan', baseTemp: 12 },
  paris: { country: 'France', baseTemp: 9 },
  dubai: { country: 'United Arab Emirates', baseTemp: 25 },
  sydney: { country: 'Australia', baseTemp: 22 },
};

const conditions = ['Sunny', 'Partly Cloudy', 'Cloudy', 'Rainy', 'Clear'];
const windDirections = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function getWeatherData(city: string): WeatherData {
  const cityKey = city.toLowerCase();
  const cityInfo = cityData[cityKey] ?? cityData.istanbul ?? { country: 'Turkey', baseTemp: 10 };

  const tempVariation = Math.random() * 4 - 2;
  const currentTemp = Math.round((cityInfo.baseTemp + tempVariation) * 10) / 10;
  const feelsLike = Math.round((currentTemp + Math.random() * 4 - 2) * 10) / 10;

  const forecast = Array.from({ length: 5 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);

    const dayTemp = cityInfo.baseTemp + Math.random() * 6 - 3;

    return {
      date: date.toISOString().split('T')[0] ?? date.toISOString(),
      high_c: Math.round((dayTemp + Math.random() * 4 + 2) * 10) / 10,
      low_c: Math.round((dayTemp - Math.random() * 4 - 1) * 10) / 10,
      condition: conditions[Math.floor(Math.random() * conditions.length)] ?? 'Clear',
      precipitation_chance: Math.floor(Math.random() * 100),
      humidity: Math.floor(Math.random() * 30 + 50),
      wind_speed_kmh: Math.floor(Math.random() * 20 + 5),
    };
  });

  return {
    city: city.charAt(0).toUpperCase() + city.slice(1),
    country: cityInfo.country,
    current: {
      temperature_c: currentTemp,
      feels_like_c: feelsLike,
      humidity: Math.floor(Math.random() * 30 + 50),
      wind_speed_kmh: Math.floor(Math.random() * 20 + 5),
      wind_direction: windDirections[Math.floor(Math.random() * windDirections.length)] ?? 'N',
      pressure_hpa: Math.floor(Math.random() * 30 + 1000),
      visibility_km: Math.floor(Math.random() * 5 + 8),
      uv_index: Math.floor(Math.random() * 8 + 1),
      condition: conditions[Math.floor(Math.random() * conditions.length)] ?? 'Clear',
    },
    forecast,
    last_updated: new Date().toISOString(),
  };
}

weatherRoutes.get('/:city', (c) => {
  const city = c.req.param('city');
  const data = getWeatherData(city);
  return c.json(data);
});

export { weatherRoutes };
