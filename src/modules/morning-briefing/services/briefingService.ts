// ============================================
// Briefing Service - GPT-4o Script + OpenAI TTS
// ============================================

import type { WeatherData, MedicationSummary, BriefingScript } from '../types';
import type { Medication } from '@/types';
import { getFriendlyWeatherDescription, getWeatherAdvice } from './weatherService';
import { getDateContext, formatDateForBriefing } from './dateService';
import { getTodaysHoliday, formatHolidayForBriefing } from '../constants/holidays';
import { getBriefingSystemPrompt, TTS_VOICE, TTS_SPEED, RADIO_SHOW_NAME } from '../constants';

// Use backend proxy instead of direct OpenAI calls (avoids CORS + keeps API key secure)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const OPENAI_CHAT_PROXY = `${API_BASE_URL}/api/openai/chat`;
const OPENAI_TTS_PROXY = `${API_BASE_URL}/api/openai/tts`;

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
 * Build the prompt context for GPT-4o (radio-style)
 */
function buildBriefingPrompt(
  userName: string,
  weather: WeatherData | null,
  medications: MedicationSummary
): string {
  const timeOfDay = getTimeOfDay();
  const dateContext = getDateContext();
  const holiday = getTodaysHoliday();
  
  // Date & Day context
  const dateInfo = `TODAY'S DATE: ${dateContext.fullDate}
DAY CONTEXT: ${dateContext.weekContext}${dateContext.isWeekend ? ' (Weekend!)' : ''}`;

  // Holiday context
  const holidayContext = holiday
    ? `🎉 SPECIAL DAY: Today is ${holiday.name}! ${holiday.message}`
    : '';

  // Weather context
  const weatherContext = weather
    ? `CURRENT WEATHER in ${weather.city}: ${weather.temperature}°C, ${getFriendlyWeatherDescription(weather)}. Suggested advice: ${getWeatherAdvice(weather)}.`
    : 'Weather data not available - skip weather mention.';

  // Medication context
  const medList = medications.todaysMedicines
    .map((m) => `- ${m.name} (${m.dosage}) at ${m.time}${m.taken ? ' (already taken)' : ''}`)
    .join('\n');

  const medContext =
    medications.total > 0
      ? `
MEDICATIONS for today (${medications.total} total, ${medications.pending} still to take):
${medList}
${medications.nextMedicine ? `Next medicine to take: ${medications.nextMedicine.name} at ${medications.nextMedicine.time}` : 'All medicines taken for today!'}`
      : 'No medications scheduled for today.';

  return `Create a RADIO-STYLE ${timeOfDay.toUpperCase()} briefing for ${userName}.

=== CONTEXT DATA ===
${dateInfo}
${holidayContext ? '\n' + holidayContext : ''}

${weatherContext}

${medContext}

=== DELIVERY INSTRUCTIONS ===
1. Open with: "This is ${RADIO_SHOW_NAME}!" followed by a warm greeting that includes today's date/day
2. ${holiday ? `Acknowledge ${holiday.name} warmly - make it feel special!` : 'Include a friendly comment about the day of the week'}
3. Share the weather with caring, practical advice
4. Mention their medications encouragingly
5. Close with a warm, memorable sign-off that feels like YOUR signature style

Remember: This is ${userName}'s personal radio show - make them feel special and cared for! Use the ACTUAL data provided above.`;
}

/**
 * Generate briefing script using GPT-4o via backend proxy
 */
export async function generateBriefingScript(
  userName: string,
  weather: WeatherData | null,
  medications: MedicationSummary
): Promise<BriefingScript> {
  const timeOfDay = getTimeOfDay();
  const userPrompt = buildBriefingPrompt(userName, weather, medications);
  const systemPrompt = getBriefingSystemPrompt(timeOfDay);

  const dateContext = getDateContext();
  const holiday = getTodaysHoliday();
  
  console.log(`📻 Generating ${RADIO_SHOW_NAME} ${timeOfDay} briefing for ${userName}`);
  console.log(`📅 Date: ${dateContext.fullDate}`);
  if (holiday) console.log(`🎉 Special day: ${holiday.name}`);
  console.log(`🌤️ Weather:`, weather ? `${weather.temperature}°C, ${weather.condition} in ${weather.city}` : 'No weather data');

  const response = await fetch(OPENAI_CHAT_PROXY, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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
    throw new Error(data?.error ?? `Failed to generate script: ${response.statusText}`);
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
 * Generate TTS audio from script via backend proxy
 * Returns a blob URL that can be played directly
 */
export async function generateBriefingAudio(script: string): Promise<string> {
  const response = await fetch(OPENAI_TTS_PROXY, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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
      errorData?.error ?? `Failed to generate audio: ${response.statusText}`
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
 * Generate a fallback briefing when APIs fail (radio-style)
 */
export function generateFallbackBriefing(
  userName: string,
  weather: WeatherData | null,
  medications: Medication[]
): string {
  const greeting = getTimeBasedGreeting();
  const medSummary = getMedicationSummary(medications);
  const dateContext = getDateContext();
  const holiday = getTodaysHoliday();

  // Radio-style intro with date
  let briefing = `This is ${RADIO_SHOW_NAME}! ${greeting}, ${userName}! Today is ${dateContext.dayName}, ${dateContext.monthName} ${dateContext.dayOfMonth}.`;

  // Add holiday mention if applicable
  if (holiday) {
    briefing += ` ${holiday.message}`;
  } else {
    briefing += ` ${dateContext.weekContext}`;
  }

  // Add weather if available
  if (weather) {
    briefing += ` It's ${weather.temperature}°C and ${getFriendlyWeatherDescription(weather)} in ${weather.city}.`;
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

  // Radio-style sign-off
  briefing += " That's your update for now. Take care and stay wonderful!";

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

