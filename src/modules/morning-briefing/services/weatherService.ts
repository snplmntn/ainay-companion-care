// ============================================
// Weather Service - WeatherAPI.com
// ============================================

import type { WeatherData } from '../types';
import {
  WEATHER_API_URL,
  DEFAULT_CITY,
  WEATHER_DESCRIPTIONS,
  WEATHER_ADVICE,
} from '../constants';

/**
 * Get WeatherAPI.com API key from environment
 */
function getApiKey(): string | null {
  // Try WeatherAPI.com key first, then fallback to OpenWeatherMap key
  const weatherApiKey = import.meta.env.VITE_WEATHERAPI_KEY;
  if (weatherApiKey) return weatherApiKey;
  
  // Legacy support for OpenWeatherMap key (won't work with new API but allows graceful fallback)
  const openWeatherKey = import.meta.env.VITE_OPENWEATHERMAP_API_KEY;
  if (openWeatherKey) {
    console.warn('⚠️ Found VITE_OPENWEATHERMAP_API_KEY but WeatherAPI.com needs VITE_WEATHERAPI_KEY');
    console.warn('💡 Get a free instant key at https://www.weatherapi.com/signup.aspx');
  }
  
  return null;
}

/**
 * Check if weather API is configured
 */
export function isWeatherApiConfigured(): boolean {
  return !!import.meta.env.VITE_WEATHERAPI_KEY;
}

/**
 * Get user's current location using browser geolocation
 */
export function getUserLocation(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      (error) => {
        reject(new Error(`Geolocation error: ${error.message}`));
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000, // Cache for 5 minutes
      }
    );
  });
}

/**
 * Parse WeatherAPI.com response to our WeatherData format
 */
function parseWeatherApiResponse(data: any): WeatherData {
  return {
    temperature: Math.round(data.current.temp_c),
    feelsLike: Math.round(data.current.feelslike_c),
    condition: data.current.condition.text,
    description: data.current.condition.text.toLowerCase(),
    icon: data.current.condition.icon,
    humidity: data.current.humidity,
    windSpeed: Math.round(data.current.wind_kph),
    city: data.location.name,
  };
}

/**
 * Generate fallback weather based on location
 */
function generateFallbackWeather(cityName: string = 'Manila'): WeatherData {
  const hour = new Date().getHours();
  const month = new Date().getMonth();
  
  const isWetSeason = month >= 5 && month <= 10;
  const isMorning = hour >= 5 && hour < 12;
  
  let baseTemp = isWetSeason ? 30 : 28;
  if (isMorning) baseTemp -= 2;
  if (hour >= 18) baseTemp -= 1;
  
  const temperature = baseTemp + Math.floor(Math.random() * 5) - 2;
  
  const conditions = isWetSeason
    ? [
        { condition: 'Partly cloudy', icon: '//cdn.weatherapi.com/weather/64x64/day/116.png' },
        { condition: 'Light rain', icon: '//cdn.weatherapi.com/weather/64x64/day/296.png' },
        { condition: 'Cloudy', icon: '//cdn.weatherapi.com/weather/64x64/day/119.png' },
      ]
    : [
        { condition: 'Sunny', icon: '//cdn.weatherapi.com/weather/64x64/day/113.png' },
        { condition: 'Partly cloudy', icon: '//cdn.weatherapi.com/weather/64x64/day/116.png' },
        { condition: 'Clear', icon: '//cdn.weatherapi.com/weather/64x64/night/113.png' },
      ];
  
  const selected = conditions[Math.floor(Math.random() * conditions.length)];
  
  return {
    temperature,
    feelsLike: temperature + 2,
    condition: selected.condition,
    description: selected.condition.toLowerCase(),
    icon: selected.icon,
    humidity: isWetSeason ? 80 : 65,
    windSpeed: 10 + Math.floor(Math.random() * 10),
    city: cityName,
  };
}

/**
 * Fetch weather by coordinates (latitude/longitude)
 */
export async function fetchWeatherByCoords(lat: number, lon: number): Promise<WeatherData> {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    console.warn('⚠️ No WeatherAPI.com key, using fallback weather');
    return generateFallbackWeather('Your Location');
  }

  try {
    const url = `${WEATHER_API_URL}?key=${apiKey}&q=${lat},${lon}&aqi=no`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || data.error) {
      const errorMsg = data.error?.message || `HTTP ${response.status}`;
      console.warn(`⚠️ Weather API error: ${errorMsg}`);
      return generateFallbackWeather('Your Location');
    }

    const weather = parseWeatherApiResponse(data);
    console.log(`☀️ Real weather for ${weather.city}: ${weather.temperature}°C, ${weather.condition}`);
    return weather;
  } catch (error) {
    console.warn('⚠️ Weather fetch failed:', error);
    return generateFallbackWeather('Your Location');
  }
}

/**
 * Fetch weather by city name
 */
export async function fetchWeatherByCity(city: string, countryCode?: string): Promise<WeatherData> {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    console.warn('⚠️ No WeatherAPI.com key, using fallback weather');
    return generateFallbackWeather(city);
  }

  try {
    const location = countryCode ? `${city},${countryCode}` : city;
    const url = `${WEATHER_API_URL}?key=${apiKey}&q=${encodeURIComponent(location)}&aqi=no`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok || data.error) {
      const errorMsg = data.error?.message || `HTTP ${response.status}`;
      console.warn(`⚠️ Weather API error: ${errorMsg}`);
      return generateFallbackWeather(city);
    }

    const weather = parseWeatherApiResponse(data);
    console.log(`☀️ Real weather for ${weather.city}: ${weather.temperature}°C, ${weather.condition}`);
    return weather;
  } catch (error) {
    console.warn('⚠️ Weather fetch failed:', error);
    return generateFallbackWeather(city);
  }
}

/**
 * Fetch current weather - tries user's location first, then falls back to city
 */
export async function fetchWeather(
  city: string = DEFAULT_CITY
): Promise<WeatherData> {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    console.warn('⚠️ No WeatherAPI.com key configured');
    console.warn('💡 Get a FREE instant key at https://www.weatherapi.com/signup.aspx');
    console.warn('   Then add VITE_WEATHERAPI_KEY=your_key to .env.local');
    return generateFallbackWeather(city);
  }

  // Try to get user's location first for more accurate weather
  try {
    console.log('🌍 Getting user location for weather...');
    const { lat, lon } = await getUserLocation();
    console.log(`📍 Location found: ${lat.toFixed(2)}, ${lon.toFixed(2)}`);
    return await fetchWeatherByCoords(lat, lon);
  } catch (locationError) {
    console.warn('📍 Could not get user location:', (locationError as Error).message);
  }

  // Fall back to city-based weather
  return await fetchWeatherByCity(city);
}

/**
 * Get a friendly weather description for TTS
 */
export function getFriendlyWeatherDescription(weather: WeatherData): string {
  const desc = weather.description.toLowerCase();
  return WEATHER_DESCRIPTIONS[desc] ?? weather.condition.toLowerCase();
}

/**
 * Get weather advice based on conditions
 */
export function getWeatherAdvice(weather: WeatherData): string {
  const condition = weather.condition.toLowerCase();
  const temp = weather.temperature;

  if (condition.includes('rain') || condition.includes('drizzle') || condition.includes('shower')) {
    return WEATHER_ADVICE.rain;
  }
  if (condition.includes('thunder') || condition.includes('storm')) {
    return WEATHER_ADVICE.storm;
  }
  if (temp >= 32) {
    return WEATHER_ADVICE.hot;
  }
  if (temp <= 20) {
    return WEATHER_ADVICE.cold;
  }
  if (condition.includes('clear') || condition.includes('sunny')) {
    return WEATHER_ADVICE.clear;
  }

  return WEATHER_ADVICE.cloudy;
}

/**
 * Format weather for display
 */
export function formatWeatherDisplay(weather: WeatherData): string {
  return `${weather.temperature}°C, ${weather.condition}`;
}

/**
 * Get weather icon URL
 */
export function getWeatherIconUrl(iconCode: string): string {
  // WeatherAPI.com icons are already full URLs
  if (iconCode.startsWith('//') || iconCode.startsWith('http')) {
    return iconCode.startsWith('//') ? `https:${iconCode}` : iconCode;
  }
  // Fallback for old OpenWeatherMap format
  return `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
}
