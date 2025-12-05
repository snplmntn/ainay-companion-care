// ============================================
// Briefing Service - GPT-4o Script + OpenAI TTS
// ============================================

import type { WeatherData, MedicationSummary, BriefingScript } from '../types';
import type { Medication } from '@/types';
import { getFriendlyWeatherDescription, getWeatherAdvice } from './weatherService';
import { getBriefingSystemPrompt, TTS_VOICE, TTS_SPEED } from '../constants';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech';

/**
 * Get OpenAI API key from environment
 */
function getApiKey(): string {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Missing OpenAI API key. Set VITE_OPENAI_API_KEY in your .env file.');
  }
  return apiKey;
}

/**
 * Convert medications to summary for briefing
 */
export function getMedicationSummary(medications: Medication[]): MedicationSummary {
  const activeMeds = medications.filter((m) => m.isActive);
  const takenCount = activeMeds.filter((m) => m.taken).length;
  const pendingCount = activeMeds.length - takenCount;

  // Find the next pending medicine
  const pendingMeds = activeMeds.filter((m) => !m.taken);
  const nextMedicine = pendingMeds.length > 0 ? pendingMeds[0] : undefined;

  return {
    total: activeMeds.length,
    pending: pendingCount,
    taken: takenCount,
    nextMedicine: nextMedicine
      ? {
          name: nextMedicine.name,
          dosage: nextMedicine.dosage,
          time: nextMedicine.time,
          instructions: nextMedicine.instructions,
        }
      : undefined,
    todaysMedicines: activeMeds.map((m) => ({
      name: m.name,
      dosage: m.dosage,
      time: m.time,
      taken: m.taken,
    })),
  };
}

/**
 * Get time of day for greeting
 */
function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/**
 * Build the prompt context for GPT-4o
 */
function buildBriefingPrompt(
  userName: string,
  weather: WeatherData | null,
  medications: MedicationSummary
): string {
  const timeOfDay = getTimeOfDay();
  
  const weatherContext = weather
    ? `CURRENT WEATHER in ${weather.city}: ${weather.temperature}°C, ${getFriendlyWeatherDescription(weather)}. Suggested advice: ${getWeatherAdvice(weather)}.`
    : 'Weather data not available - skip weather mention.';

  const medList = medications.todaysMedicines
    .map((m) => `- ${m.name} (${m.dosage}) at ${m.time}${m.taken ? ' (already taken)' : ''}`)
    .join('\n');

  const medContext =
    medications.total > 0
      ? `
Medications for today (${medications.total} total, ${medications.pending} still to take):
${medList}
${medications.nextMedicine ? `Next medicine to take: ${medications.nextMedicine.name} at ${medications.nextMedicine.time}` : 'All medicines taken for today!'}`
      : 'No medications scheduled for today.';

  return `Create a ${timeOfDay.toUpperCase()} briefing for ${userName}.

IMPORTANT: It is currently ${timeOfDay}. Start with "Good ${timeOfDay}, ${userName}!"

${weatherContext}

${medContext}

Remember: Keep it to 3-4 sentences, warm and caring tone, like a friendly family member. Use the ACTUAL weather data provided above.`;
}

/**
 * Generate briefing script using GPT-4o
 */
export async function generateBriefingScript(
  userName: string,
  weather: WeatherData | null,
  medications: MedicationSummary
): Promise<BriefingScript> {
  const apiKey = getApiKey();
  const timeOfDay = getTimeOfDay();
  const userPrompt = buildBriefingPrompt(userName, weather, medications);
  const systemPrompt = getBriefingSystemPrompt(timeOfDay);

  console.log(`🎙️ Generating ${timeOfDay} briefing for ${userName}`);
  console.log(`🌤️ Weather context:`, weather ? `${weather.temperature}°C, ${weather.condition} in ${weather.city}` : 'No weather data');

  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 300,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message ?? `Failed to generate script: ${response.statusText}`);
  }

  const scriptText = data?.choices?.[0]?.message?.content?.trim();
  if (!scriptText) {
    throw new Error('OpenAI did not return a script.');
  }

  return {
    text: scriptText,
    generatedAt: new Date(),
  };
}

/**
 * Generate TTS audio from script using OpenAI TTS API
 * Returns a blob URL that can be played directly
 */
export async function generateBriefingAudio(script: string): Promise<string> {
  const apiKey = getApiKey();

  const response = await fetch(OPENAI_TTS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'tts-1',
      input: script,
      voice: TTS_VOICE,
      speed: TTS_SPEED,
      response_format: 'mp3',
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData?.error?.message ?? `Failed to generate audio: ${response.statusText}`
    );
  }

  // Convert response to audio blob URL
  const audioBlob = await response.blob();
  const audioUrl = URL.createObjectURL(audioBlob);

  return audioUrl;
}

/**
 * Generate complete morning briefing (script + audio)
 */
export async function generateMorningBriefing(
  userName: string,
  weather: WeatherData | null,
  medications: Medication[]
): Promise<{ script: BriefingScript; audioUrl: string }> {
  // Get medication summary
  const medSummary = getMedicationSummary(medications);

  // Generate script with GPT-4o
  const script = await generateBriefingScript(userName, weather, medSummary);

  // Generate audio with TTS
  const audioUrl = await generateBriefingAudio(script.text);

  return { script, audioUrl };
}

/**
 * Generate a fallback briefing when APIs fail
 */
export function generateFallbackBriefing(
  userName: string,
  weather: WeatherData | null,
  medications: Medication[]
): string {
  const greeting = getTimeBasedGreeting();
  const medSummary = getMedicationSummary(medications);

  let briefing = `${greeting}, ${userName}!`;

  // Add weather if available
  if (weather) {
    briefing += ` It's ${weather.temperature}°C and ${getFriendlyWeatherDescription(weather)} in ${weather.city} today.`;
  }

  // Add medication info
  if (medSummary.total > 0) {
    briefing += ` You have ${medSummary.total} medicine${medSummary.total > 1 ? 's' : ''} to take today.`;
    if (medSummary.nextMedicine) {
      briefing += ` Your next one is ${medSummary.nextMedicine.name} at ${medSummary.nextMedicine.time}.`;
    }
  } else {
    briefing += ' No medicines scheduled for today.';
  }

  briefing += ' Take care and have a wonderful day!';

  return briefing;
}

/**
 * Get greeting based on time of day
 */
function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

