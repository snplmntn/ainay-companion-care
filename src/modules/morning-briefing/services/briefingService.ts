// ============================================
// Briefing Service - GPT-4o Script + OpenAI TTS
// ============================================

import type { WeatherData, MedicationSummary, BriefingScript } from '../types';
import type { Medication } from '@/types';
import { getFriendlyWeatherDescription, getWeatherAdvice } from './weatherService';
import { getDateContext, formatDateForBriefing } from './dateService';
import { getTodaysHoliday, formatHolidayForBriefing } from '../constants/holidays';
import { getBriefingSystemPrompt, TTS_VOICE, TTS_SPEED, RADIO_SHOW_NAME } from '../constants';
import { type SupportedLanguage, getLanguagePrompt, LANGUAGES } from '@/services/language';

// Use backend proxy instead of direct OpenAI calls (avoids CORS + keeps API key secure)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const OPENAI_CHAT_PROXY = `${API_BASE_URL}/api/openai/chat`;
const OPENAI_TTS_PROXY = `${API_BASE_URL}/api/openai/tts`;

/**
 * Helper to check if a medication is fully taken (considering doses)
 */
function isMedFullyTaken(med: Medication): boolean {
  if (med.doses && med.doses.length > 0) {
    return med.doses.every((d) => d.taken);
  }
  return med.taken;
}

/**
 * Get medication dose stats (total doses, taken doses)
 */
function getMedDoseStats(med: Medication): { total: number; taken: number } {
  if (med.doses && med.doses.length > 0) {
    return {
      total: med.doses.length,
      taken: med.doses.filter((d) => d.taken).length,
    };
  }
  return { total: 1, taken: med.taken ? 1 : 0 };
}

/**
 * Find the next pending dose (across all medications)
 */
function getNextPendingDose(medications: Medication[]): { name: string; dosage: string; time: string; label?: string; instructions?: string } | undefined {
  const pendingDoses: Array<{ name: string; dosage: string; time: string; label: string; instructions?: string; sortTime: string }> = [];
  
  for (const med of medications) {
    if (!med.isActive) continue;
    
    if (med.doses && med.doses.length > 0) {
      for (const dose of med.doses) {
        if (!dose.taken) {
          // Convert time for sorting
          const sortTime = dose.time.replace(/(\d+):(\d+)\s*(AM|PM)?/i, (_, h, m, p) => {
            let hour = parseInt(h);
            if (p?.toUpperCase() === 'PM' && hour !== 12) hour += 12;
            if (p?.toUpperCase() === 'AM' && hour === 12) hour = 0;
            return `${hour.toString().padStart(2, '0')}:${m}`;
          });
          pendingDoses.push({
            name: med.name,
            dosage: med.dosage,
            time: dose.time,
            label: dose.label,
            instructions: med.instructions,
            sortTime,
          });
        }
      }
    } else if (!med.taken) {
      const sortTime = med.time.replace(/(\d+):(\d+)\s*(AM|PM)?/i, (_, h, m, p) => {
        let hour = parseInt(h);
        if (p?.toUpperCase() === 'PM' && hour !== 12) hour += 12;
        if (p?.toUpperCase() === 'AM' && hour === 12) hour = 0;
        return `${hour.toString().padStart(2, '0')}:${m}`;
      });
      pendingDoses.push({
        name: med.name,
        dosage: med.dosage,
        time: med.time,
        label: 'Scheduled',
        instructions: med.instructions,
        sortTime,
      });
    }
  }
  
  // Sort by time
  pendingDoses.sort((a, b) => a.sortTime.localeCompare(b.sortTime));
  
  const next = pendingDoses[0];
  return next ? { name: next.name, dosage: next.dosage, time: next.time, label: next.label, instructions: next.instructions } : undefined;
}

/**
 * Convert medications to summary for briefing (DOSE-LEVEL accuracy)
 */
export function getMedicationSummary(medications: Medication[]): MedicationSummary {
  const activeMeds = medications.filter((m) => m.isActive);
  
  // Calculate DOSE-level counts (not medication-level)
  const { totalDoses, takenDoses } = activeMeds.reduce((acc, med) => {
    const stats = getMedDoseStats(med);
    acc.totalDoses += stats.total;
    acc.takenDoses += stats.taken;
    return acc;
  }, { totalDoses: 0, takenDoses: 0 });
  
  const pendingDoses = totalDoses - takenDoses;

  // Find the NEXT PENDING DOSE (not just medication)
  const nextMedicine = getNextPendingDose(activeMeds);

  return {
    total: totalDoses,
    pending: pendingDoses,
    taken: takenDoses,
    nextMedicine: nextMedicine
      ? {
          name: nextMedicine.name,
          dosage: nextMedicine.dosage,
          time: nextMedicine.time,
          instructions: nextMedicine.instructions,
        }
      : undefined,
    todaysMedicines: activeMeds.map((m) => {
      // For multi-dose meds, check if ALL doses are taken
      const isTaken = isMedFullyTaken(m);
      return {
        name: m.name,
        dosage: m.dosage,
        time: m.time,
        taken: isTaken,
      };
    }),
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
  medications: MedicationSummary,
  language: SupportedLanguage = 'en'
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

  // Medication context - SEPARATE taken vs pending to avoid spamming
  const pendingMeds = medications.todaysMedicines.filter(m => !m.taken);
  const takenMeds = medications.todaysMedicines.filter(m => m.taken);
  
  const pendingMedList = pendingMeds
    .map((m) => `- ${m.name} (${m.dosage}) at ${m.time}`)
    .join('\n');
  
  const takenMedNames = takenMeds.map(m => m.name).join(', ');

  let medContext: string;
  if (medications.total === 0) {
    medContext = 'No medications scheduled for today.';
  } else if (pendingMeds.length === 0) {
    // ALL medicines taken - celebrate this!
    medContext = `
MEDICATION STATUS: ✅ ALL ${medications.taken} MEDICATIONS TAKEN TODAY!
(${takenMedNames})

🎉 Congratulate them warmly - they've completed all their medicines for today! No reminders needed.`;
  } else {
    medContext = `
MEDICATION STATUS (${medications.taken}/${medications.total} taken today):

⏳ PENDING - MENTION THESE:
${pendingMedList}
${medications.nextMedicine ? `Next up: ${medications.nextMedicine.name} at ${medications.nextMedicine.time}` : ''}

${takenMeds.length > 0 ? `✅ ALREADY TAKEN (DO NOT remind about these): ${takenMedNames}` : ''}`;
  }

  // Language instructions
  const languageConfig = LANGUAGES[language];
  const languageInstruction = language === 'en' 
    ? 'Deliver this briefing in English.'
    : `Deliver this briefing in ${languageConfig.name} (${languageConfig.nativeName}). ${getLanguagePrompt(language)}`;

  return `Create a RADIO-STYLE ${timeOfDay.toUpperCase()} briefing for ${userName}.

=== LANGUAGE ===
${languageInstruction}

=== CONTEXT DATA ===
${dateInfo}
${holidayContext ? '\n' + holidayContext : ''}

${weatherContext}

${medContext}

=== DELIVERY INSTRUCTIONS ===
1. Open with: "This is ${RADIO_SHOW_NAME}!" followed by a warm greeting that includes today's date/day
2. ${holiday ? `Acknowledge ${holiday.name} warmly - make it feel special!` : 'Include a friendly comment about the day of the week'}
3. Share the weather with caring, practical advice
4. For medications:
   - If ALL are taken: Congratulate them warmly! No reminders needed.
   - If some are pending: Mention ONLY the pending ones, NOT the ones already taken.
   - **CRITICAL: Do NOT remind about already-taken medications - that would be annoying!**
5. Close with a warm, memorable sign-off that feels like YOUR signature style

Remember: This is ${userName}'s personal radio show - make them feel special, NOT nagged! Only remind about medicines they still need to take.`;
}

/**
 * Generate briefing script using GPT-4o via backend proxy
 */
export async function generateBriefingScript(
  userName: string,
  weather: WeatherData | null,
  medications: MedicationSummary,
  language: SupportedLanguage = 'en'
): Promise<BriefingScript> {
  const timeOfDay = getTimeOfDay();
  const userPrompt = buildBriefingPrompt(userName, weather, medications, language);
  const systemPrompt = getBriefingSystemPrompt(timeOfDay);

  const dateContext = getDateContext();
  const holiday = getTodaysHoliday();
  const languageConfig = LANGUAGES[language];
  
  console.log(`📻 Generating ${RADIO_SHOW_NAME} ${timeOfDay} briefing for ${userName} in ${languageConfig.name}`);
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
      max_tokens: 400, // Increased to accommodate translations
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
  medications: Medication[],
  language: SupportedLanguage = 'en'
): Promise<{ script: BriefingScript; audioUrl: string }> {
  // Get medication summary
  const medSummary = getMedicationSummary(medications);

  // Generate script with GPT-4o in the specified language
  const script = await generateBriefingScript(userName, weather, medSummary, language);

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
  medications: Medication[],
  language: SupportedLanguage = 'en'
): string {
  const greeting = getTimeBasedGreeting(language);
  const medSummary = getMedicationSummary(medications);
  const dateContext = getDateContext();
  const holiday = getTodaysHoliday();

  // Radio-style intro with date - localized
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

  // Radio-style sign-off - localized
  briefing += ` ${getLocalizedSignOff(language)}`;

  return briefing;
}

/**
 * Get localized sign-off
 */
function getLocalizedSignOff(language: SupportedLanguage): string {
  const signOffs: Record<SupportedLanguage, string> = {
    en: "That's your update for now. Take care and stay wonderful!",
    tl: "Iyan ang update mo ngayon. Ingat ka at manatiling maganda!",
    ceb: "Mao na ang imong update karon. Pag-amping ug magpabilin ka nga nindot!",
    ilo: "Daytoy ti update-mo ita. Agaluadka ken agtalinaedka a nasayaat!",
    hil: "Amo na ang update mo subong. Mag-andam ka kag magpabilin ka nga maayo!",
    war: "Amo na an imo update yana. Pag-amping ngan magpabilin ka nga maupay!",
    pam: "Yan la ing update mu ngeni. Maganaka at manatili kang mayap!",
    bik: "Iyo na an update mo ngunyan. Mag-ingat ka asin magdanay kang maray!",
  };
  return signOffs[language] || signOffs.en;
}

/**
 * Get greeting based on time of day and language
 */
function getTimeBasedGreeting(language: SupportedLanguage = 'en'): string {
  const hour = new Date().getHours();
  
  // Localized greetings by time of day
  const greetings: Record<SupportedLanguage, { morning: string; afternoon: string; evening: string }> = {
    en: { morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening' },
    tl: { morning: 'Magandang umaga', afternoon: 'Magandang hapon', evening: 'Magandang gabi' },
    ceb: { morning: 'Maayong buntag', afternoon: 'Maayong hapon', evening: 'Maayong gabii' },
    ilo: { morning: 'Naimbag a bigat', afternoon: 'Naimbag a malem', evening: 'Naimbag a rabii' },
    hil: { morning: 'Maayong aga', afternoon: 'Maayong hapon', evening: 'Maayong gab-i' },
    war: { morning: 'Maupay nga aga', afternoon: 'Maupay nga kulop', evening: 'Maupay nga gab-i' },
    pam: { morning: 'Mayap a abak', afternoon: 'Mayap a gatpanapun', evening: 'Mayap a bengi' },
    bik: { morning: 'Marhay na aga', afternoon: 'Marhay na hapon', evening: 'Marhay na banggi' },
  };

  const langGreetings = greetings[language] || greetings.en;
  
  if (hour < 12) return langGreetings.morning;
  if (hour < 17) return langGreetings.afternoon;
  return langGreetings.evening;
}

