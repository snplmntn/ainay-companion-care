// ============================================
// Morning Briefing Module
// ============================================

// Types
export * from './types';

// Constants
export * from './constants';

// Services
export { 
  fetchWeather, 
  fetchWeatherByCity,
  fetchWeatherByCoords,
  getUserLocation,
  getFriendlyWeatherDescription, 
  getWeatherAdvice, 
  getWeatherIconUrl, 
  isWeatherApiConfigured 
} from './services/weatherService';
export {
  getMedicationSummary,
  generateBriefingScript,
  generateBriefingAudio,
  generateMorningBriefing,
  generateFallbackBriefing,
} from './services/briefingService';

// Hooks
export { useMorningBriefing } from './hooks/useMorningBriefing';

// Components
export { MorningBriefingPlayer } from './components/MorningBriefingPlayer';

