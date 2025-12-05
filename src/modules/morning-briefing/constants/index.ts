// ============================================
// Morning Briefing Module Constants
// ============================================

// WeatherAPI.com Configuration (free tier, instant activation)
export const WEATHER_API_URL = 'https://api.weatherapi.com/v1/current.json';
export const DEFAULT_CITY = 'Manila';
export const DEFAULT_COUNTRY_CODE = 'PH';

// Legacy OpenWeatherMap (kept for reference)
export const OPENWEATHERMAP_API_URL = 'https://api.openweathermap.org/data/2.5/weather';
export const UNITS = 'metric'; // Celsius

// Weather condition mappings for friendly descriptions
export const WEATHER_DESCRIPTIONS: Record<string, string> = {
  // Clear
  'clear sky': 'clear and sunny',
  'clear': 'clear and sunny',
  
  // Clouds
  'few clouds': 'partly cloudy',
  'scattered clouds': 'partly cloudy',
  'broken clouds': 'cloudy',
  'overcast clouds': 'overcast',
  
  // Rain
  'light rain': 'lightly raining',
  'moderate rain': 'rainy',
  'heavy intensity rain': 'heavily raining',
  'very heavy rain': 'heavily raining',
  'extreme rain': 'stormy with heavy rain',
  'freezing rain': 'freezing rain',
  'light intensity shower rain': 'light showers',
  'shower rain': 'showering',
  'heavy intensity shower rain': 'heavy showers',
  'ragged shower rain': 'scattered showers',
  
  // Drizzle
  'light intensity drizzle': 'drizzling',
  'drizzle': 'drizzling',
  'heavy intensity drizzle': 'drizzling',
  
  // Thunderstorm
  'thunderstorm': 'stormy with thunder',
  'thunderstorm with light rain': 'stormy with thunder',
  'thunderstorm with rain': 'stormy with thunder and rain',
  'thunderstorm with heavy rain': 'stormy with heavy thunder',
  
  // Atmosphere
  'mist': 'misty',
  'smoke': 'smoky',
  'haze': 'hazy',
  'fog': 'foggy',
  
  // Default
  'default': 'nice',
};

// Weather advice for seniors
export const WEATHER_ADVICE: Record<string, string> = {
  rain: "Don't forget your umbrella or jacket if you go outside",
  hot: "Stay hydrated and avoid going out during peak sun hours",
  cold: "Wear warm layers if you're going out",
  storm: "Please stay indoors today for your safety",
  clear: "It's a great day to get some fresh air",
  cloudy: "A good day for light activities",
};

// TTS Configuration
export const TTS_VOICE = 'nova'; // Warm, friendly female voice
export const TTS_SPEED = 0.9; // Slightly slower for seniors

// Briefing Script Prompt (time-aware)
export function getBriefingSystemPrompt(timeOfDay: 'morning' | 'afternoon' | 'evening'): string {
  return `You are a warm, caring radio host creating a personalized ${timeOfDay} health briefing for an elderly Filipino listener. Your tone should be like a friendly neighbor or family member.

IMPORTANT GUIDELINES:
1. Keep the script to EXACTLY 3-4 sentences (about 30 seconds when read aloud)
2. Start with "Good ${timeOfDay}, [name]!" - use the CORRECT time of day greeting
3. Mention the weather naturally with practical advice based on the ACTUAL weather provided
4. Mention their medications for today in a caring way
5. End with an encouraging or caring message appropriate for ${timeOfDay}
6. Use simple, clear language appropriate for seniors
7. Be warm and supportive, like a caring family member

NEVER include:
- Medical disclaimers
- Complex medical terms
- More than 4 sentences
- Robotic or formal language
- Wrong time greetings (e.g., don't say "Good morning" if it's ${timeOfDay})`;
}

// Legacy export for backwards compatibility
export const BRIEFING_SYSTEM_PROMPT = getBriefingSystemPrompt('morning');

// Storage keys
export const BRIEFING_CACHE_KEY = 'ainay-morning-briefing-cache';
export const BRIEFING_CACHE_DURATION = 3600000; // 1 hour in milliseconds

