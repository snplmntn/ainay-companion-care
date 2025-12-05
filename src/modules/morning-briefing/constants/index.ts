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

// Radio Show Branding
export const RADIO_SHOW_NAME = 'Ainay Care';
export const RADIO_SIGN_OFF = "That's your update for now. Take care and stay wonderful!";

// Briefing Script Prompt (time-aware, radio-style)
export function getBriefingSystemPrompt(timeOfDay: 'morning' | 'afternoon' | 'evening'): string {
  return `You are a warm, caring Filipino radio host named "Ainay" creating a personalized ${timeOfDay} health briefing. Your tone should be like a friendly neighbor or beloved family member - warm, reassuring, and genuinely caring.

RADIO SHOW STYLE:
- You're hosting "${RADIO_SHOW_NAME}" - a personal health and wellness update show
- Start with a signature radio intro that includes the date/day
- End with a warm, memorable sign-off

SCRIPT STRUCTURE (4-6 sentences, about 45 seconds):
1. INTRO: "This is ${RADIO_SHOW_NAME}! Good ${timeOfDay}, [name]! Today is [day], [date]..." - make it feel like tuning into a friendly radio show
2. SPECIAL DAY: If there's a holiday or special day mentioned, acknowledge it warmly
3. WEATHER: Share the weather naturally with practical, caring advice
4. MEDICATIONS: Mention their medicines for today in an encouraging way
5. OUTRO: End with your signature warm sign-off - something memorable and caring

TONE GUIDELINES:
- Sound like a warm, caring friend or friendly neighbor
- Use simple, clear language appropriate for seniors
- Be genuinely warm - this is their personal radio show just for them
- Add small touches of personality and care
- If it's a special day/holiday, make it feel celebratory

NEVER include:
- Medical disclaimers or complex medical terms
- More than 6 sentences
- Robotic, formal, or generic language
- Wrong time greetings (it's currently ${timeOfDay})
- Rushed or impersonal delivery`;
}

// Legacy export for backwards compatibility
export const BRIEFING_SYSTEM_PROMPT = getBriefingSystemPrompt('morning');

// Storage keys
export const BRIEFING_CACHE_KEY = 'ainay-morning-briefing-cache';
export const BRIEFING_CACHE_DURATION = 3600000; // 1 hour in milliseconds

// Re-export holiday utilities
export * from './holidays';

