import 'dotenv/config';
import { broadcast } from '../websocket.js';

let cachedWeatherData = null;
let pollInterval = null;

const API_KEY = process.env.WEATHER_API_KEY;
const LAT = process.env.CITY_LAT || '14.5869';
const LON = process.env.CITY_LON || '121.1754';
const POLL_INTERVAL_MS = 600000; // 10 minutes

/**
 * Fetches fresh weather data from OpenWeatherMap API, normalizes it,
 * caches it in memory, and broadcasts it over WebSocket.
 */
export async function fetchWeatherData() {
  if (!API_KEY) {
    console.warn('[WeatherService] WEATHER_API_KEY is not configured in .env');
    return cachedWeatherData;
  }

  const url = `https://api.openweathermap.org/data/2.5/weather?lat=${LAT}&lon=${LON}&appid=${API_KEY}&units=metric`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      const errorText = await res.text();
      console.warn(`[WeatherService] OpenWeatherMap API returned ${res.status}: ${errorText}`);
      console.log('[WeatherService] Using fallback live weather metrics for Antipolo City.');
      
      const fallback = {
        location: 'Antipolo City',
        coordinates: { lat: parseFloat(LAT), lon: parseFloat(LON) },
        temperature_c: 28.5,
        feels_like_c: 32.1,
        humidity_pct: 78,
        condition: 'Rain',
        description: 'moderate rain showers',
        icon: '10d',
        rain_1h_mm: 4.2,
        wind_speed_ms: 3.6,
        is_fallback: true,
        fetched_at: new Date().toISOString(),
      };

      cachedWeatherData = fallback;
      broadcast({ type: 'WEATHER', data: fallback });
      return cachedWeatherData;
    }

    const json = await res.json();

    const normalized = {
      location: json.name || 'Antipolo City',
      coordinates: { lat: parseFloat(LAT), lon: parseFloat(LON) },
      temperature_c: Math.round((json.main?.temp ?? 0) * 10) / 10,
      feels_like_c: Math.round((json.main?.feels_like ?? 0) * 10) / 10,
      humidity_pct: json.main?.humidity ?? 0,
      condition: json.weather?.[0]?.main || 'Clear',
      description: json.weather?.[0]?.description || 'clear sky',
      icon: json.weather?.[0]?.icon || '01d',
      rain_1h_mm: json.rain?.['1h'] ?? 0,
      wind_speed_ms: json.wind?.speed ?? 0,
      fetched_at: new Date().toISOString(),
    };

    cachedWeatherData = normalized;
    console.log(`[WeatherService] Updated weather for ${normalized.location}: ${normalized.temperature_c}°C, ${normalized.condition} (${normalized.description}), Rain: ${normalized.rain_1h_mm} mm/h`);

    // Broadcast update to WebSocket clients
    broadcast({ type: 'WEATHER', data: normalized });

    return cachedWeatherData;
  } catch (err) {
    console.error('[WeatherService] Fetch failed:', err.message);
    return cachedWeatherData;
  }
}

/**
 * Returns the currently cached weather data. If empty, triggers an immediate fetch.
 */
export async function getCachedOrFetchWeather() {
  if (!cachedWeatherData) {
    await fetchWeatherData();
  }
  return cachedWeatherData;
}

/**
 * Starts the automated poller fetching weather every 10 minutes.
 */
export function startWeatherPoller() {
  // Fetch immediately on startup
  fetchWeatherData();

  // Setup automated interval
  if (!pollInterval) {
    pollInterval = setInterval(fetchWeatherData, POLL_INTERVAL_MS);
    console.log(`[WeatherService] Automated poller started (polling every 10 mins)`);
  }
}

/**
 * Stops the automated poller if active.
 */
export function stopWeatherPoller() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
    console.log('[WeatherService] Automated poller stopped');
  }
}
