// Text-to-Speech Service
// Supports multiple TTS engines: Browser (instant), OpenAI (high quality)

import { SupportedLanguage, getTTSLanguageCode, LANGUAGES } from "./language";

const OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech";

export type TTSVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
export type TTSEngine = "browser" | "openai";

export interface TTSOptions {
  voice?: TTSVoice;
  speed?: number; // 0.25 to 4.0
  engine?: TTSEngine;
  onStart?: () => void; // Called when audio starts playing (after loading)
}

// Voice recommendations by language/context
// shimmer = warmest, most expressive female voice (recommended for care apps)
export const VOICE_RECOMMENDATIONS: Record<string, TTSVoice> = {
  default: "shimmer",   // Warmest, most expressive female voice - BEST for care
  warm: "shimmer",      // Warm, caring female voice
  friendly: "nova",     // Friendly female voice  
  male: "onyx",         // Deep male voice
  neutral: "alloy",     // Neutral voice
  calm: "echo",         // Calm, soothing
};

// Storage key for TTS preference
const TTS_ENGINE_KEY = "ainay-tts-engine";

/**
 * Save TTS engine preference
 */
export function saveTTSEnginePreference(engine: TTSEngine): void {
  try {
    localStorage.setItem(TTS_ENGINE_KEY, engine);
  } catch {
    // Ignore
  }
}

/**
 * Load TTS engine preference
 */
export function loadTTSEnginePreference(): TTSEngine {
  try {
    const saved = localStorage.getItem(TTS_ENGINE_KEY);
    if (saved === "browser" || saved === "openai") {
      return saved;
    }
  } catch {
    // Ignore
  }
  return "openai"; // Default to OpenAI for warm, high-quality voice
}

/**
 * Get OpenAI API key
 */
function getApiKey(): string {
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OpenAI API key for TTS");
  }
  return apiKey;
}

/**
 * Current audio playback state
 */
let currentAudio: HTMLAudioElement | null = null;
let currentAudioUrl: string | null = null;

/**
 * Stop any currently playing audio
 */
export function stopSpeaking(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
    currentAudioUrl = null;
  }
}

/**
 * Check if audio is currently playing
 */
export function isSpeaking(): boolean {
  return currentAudio !== null && !currentAudio.paused;
}

/**
 * Convert text to speech using OpenAI TTS API
 * Returns audio element only when it's fully loaded and ready to play
 */
export async function textToSpeech(
  text: string,
  language: SupportedLanguage = "en",
  options: TTSOptions = {}
): Promise<HTMLAudioElement> {
  const apiKey = getApiKey();
  const { voice = "shimmer", speed = 0.95 } = options; // shimmer = warmest female voice

  // Clean up text for TTS (remove markdown, emojis for cleaner speech)
  const cleanText = cleanTextForTTS(text);

  if (!cleanText.trim()) {
    throw new Error("No text to speak");
  }

  // Stop any currently playing audio
  stopSpeaking();

  const response = await fetch(OPENAI_TTS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "tts-1",
      input: cleanText,
      voice,
      speed,
      response_format: "mp3",
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      `TTS request failed: ${errorData?.error?.message ?? response.statusText}`
    );
  }

  // Convert response to audio blob
  const audioBlob = await response.blob();
  const audioUrl = URL.createObjectURL(audioBlob);
  currentAudioUrl = audioUrl;

  // Create audio element
  const audio = new Audio(audioUrl);
  currentAudio = audio;

  // Wait for audio to be ready to play (fully loaded)
  await new Promise<void>((resolve, reject) => {
    const onCanPlay = () => {
      audio.removeEventListener("canplaythrough", onCanPlay);
      audio.removeEventListener("error", onError);
      resolve();
    };
    const onError = () => {
      audio.removeEventListener("canplaythrough", onCanPlay);
      audio.removeEventListener("error", onError);
      reject(new Error("Failed to load audio"));
    };
    audio.addEventListener("canplaythrough", onCanPlay);
    audio.addEventListener("error", onError);
    // Trigger loading
    audio.load();
  });

  // Clean up when audio ends
  audio.addEventListener("ended", () => {
    stopSpeaking();
  });

  audio.addEventListener("error", () => {
    stopSpeaking();
  });

  return audio;
}

/**
 * Speak text aloud
 */
export async function speak(
  text: string,
  language: SupportedLanguage = "en",
  options: TTSOptions = {}
): Promise<void> {
  const audio = await textToSpeech(text, language, options);
  
  return new Promise((resolve, reject) => {
    audio.addEventListener("ended", () => resolve());
    audio.addEventListener("error", (e) => reject(e));
    audio.play()
      .then(() => {
        // Audio started playing - call onStart callback
        options.onStart?.();
      })
      .catch(reject);
  });
}

/**
 * Clean text for TTS (remove markdown, excessive formatting)
 */
function cleanTextForTTS(text: string): string {
  return text
    // Pronunciation fixes
    .replace(/AInay/gi, "Inay") // Read "AInay" as "Inay" (Filipino for mother)
    // Remove markdown bold/italic
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    // Remove markdown headers
    .replace(/^#{1,6}\s+/gm, "")
    // Remove markdown links, keep text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove markdown images
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "")
    // Remove markdown code blocks
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    // Remove bullet points but keep text
    .replace(/^[-*+]\s+/gm, "")
    // Remove numbered lists but keep text
    .replace(/^\d+\.\s+/gm, "")
    // Convert multiple newlines to single
    .replace(/\n{3,}/g, "\n\n")
    // Remove emojis (optional - keep some for natural pauses)
    .replace(/[\u{1F600}-\u{1F64F}]/gu, "")
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, "")
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, "")
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, "")
    .replace(/[\u{2600}-\u{26FF}]/gu, "")
    .replace(/[\u{2700}-\u{27BF}]/gu, "")
    // Clean up whitespace
    .replace(/\s+/g, " ")
    .trim();
}

// Track current Web Speech utterance
let currentUtterance: SpeechSynthesisUtterance | null = null;

/**
 * Stop Web Speech synthesis
 */
export function stopWebSpeech(): void {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  currentUtterance = null;
}

/**
 * Check if Web Speech is currently speaking
 */
export function isWebSpeechSpeaking(): boolean {
  return "speechSynthesis" in window && window.speechSynthesis.speaking;
}

/**
 * Get available browser voices for a language
 */
export function getBrowserVoices(language: SupportedLanguage): SpeechSynthesisVoice[] {
  if (!("speechSynthesis" in window)) return [];
  
  const voices = window.speechSynthesis.getVoices();
  const langCode = getTTSLanguageCode(language);
  const langPrefix = langCode.split("-")[0];
  
  // For Philippine languages, also check for Filipino voices
  const checkPrefixes = language === "en" ? ["en"] : [langPrefix, "fil", "tl"];
  
  return voices.filter((v) => 
    checkPrefixes.some((prefix) => v.lang.toLowerCase().startsWith(prefix))
  );
}

/**
 * Get the best warm female voice for a language
 */
export function getBestWarmVoice(language: SupportedLanguage): SpeechSynthesisVoice | null {
  const voices = getBrowserVoices(language);
  if (voices.length === 0) return null;

  // Preferred warm female voices (sorted by quality)
  const warmFemaleVoices = [
    // Windows 11 natural voices (best quality)
    "Microsoft Jenny Online",
    "Microsoft Aria Online", 
    "Microsoft Zira",
    // macOS high-quality voices
    "Samantha",
    "Karen",
    "Moira",
    "Tessa",
    // Google voices
    "Google US English Female",
    "Google UK English Female",
    // Edge voices
    "Microsoft Jenny",
    "Microsoft Aria",
    // Generic female
    "Female",
  ];

  // Find best matching warm voice
  for (const preferred of warmFemaleVoices) {
    const match = voices.find((v) => 
      v.name.toLowerCase().includes(preferred.toLowerCase())
    );
    if (match) return match;
  }

  // Fallback: any female voice
  const femaleVoice = voices.find((v) => 
    v.name.toLowerCase().includes("female") ||
    v.name.includes("Zira") ||
    v.name.includes("Samantha") ||
    v.name.includes("Jenny") ||
    v.name.includes("Aria")
  );
  if (femaleVoice) return femaleVoice;

  // Last resort: first available voice
  return voices[0];
}

/**
 * Browser-based TTS (instant, free) - Uses warm female voice
 */
export function speakWithBrowser(
  text: string,
  language: SupportedLanguage = "en",
  options: { rate?: number; pitch?: number; onStart?: () => void } = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!("speechSynthesis" in window)) {
      reject(new Error("Web Speech API not supported"));
      return;
    }

    // Cancel any ongoing speech
    stopWebSpeech();
    stopSpeaking(); // Also stop OpenAI audio

    const cleanText = cleanTextForTTS(text);
    if (!cleanText.trim()) {
      resolve();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    currentUtterance = utterance;
    
    // Set language
    const langCode = getTTSLanguageCode(language);
    utterance.lang = langCode;
    
    // Senior-friendly: slightly slower, warm pitch
    utterance.rate = options.rate ?? 0.9;
    utterance.pitch = options.pitch ?? 1.05; // Slightly higher pitch = warmer
    utterance.volume = 1.0;

    // Find best warm female voice
    const bestVoice = getBestWarmVoice(language);
    if (bestVoice) {
      utterance.voice = bestVoice;
    }

    // Call onStart when speech begins
    utterance.onstart = () => {
      options.onStart?.();
    };

    utterance.onend = () => {
      currentUtterance = null;
      resolve();
    };
    
    utterance.onerror = (e) => {
      currentUtterance = null;
      // Don't reject on 'interrupted' - that's expected when stopping
      if (e.error === "interrupted" || e.error === "canceled") {
        resolve();
      } else {
        reject(e);
      }
    };

    // Chrome bug workaround: voices may not be loaded yet
    if (window.speechSynthesis.getVoices().length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        const warmVoice = getBestWarmVoice(language);
        if (warmVoice) {
          utterance.voice = warmVoice;
        }
        window.speechSynthesis.speak(utterance);
      };
    } else {
      window.speechSynthesis.speak(utterance);
    }
  });
}

/**
 * Speak with the preferred engine (browser or OpenAI)
 */
export async function speakWithPreferredEngine(
  text: string,
  language: SupportedLanguage = "en",
  options: TTSOptions = {}
): Promise<void> {
  const engine = options.engine ?? loadTTSEnginePreference();
  
  if (engine === "browser") {
    await speakWithBrowser(text, language, { rate: options.speed, onStart: options.onStart });
  } else {
    await speak(text, language, options);
  }
}

/**
 * Speak with automatic fallback (try preferred, fall back to other)
 */
export async function speakWithFallback(
  text: string,
  language: SupportedLanguage = "en",
  options: TTSOptions = {}
): Promise<void> {
  const engine = options.engine ?? loadTTSEnginePreference();
  
  try {
    if (engine === "browser") {
      await speakWithBrowser(text, language, { rate: options.speed, onStart: options.onStart });
    } else {
      await speak(text, language, options);
    }
  } catch (error) {
    console.warn(`${engine} TTS failed, trying fallback:`, error);
    // Fall back to the other engine
    if (engine === "openai") {
      await speakWithBrowser(text, language, { rate: options.speed, onStart: options.onStart });
    } else {
      await speak(text, language, options);
    }
  }
}

/**
 * Stop all speech (both OpenAI and Browser)
 */
export function stopAllSpeech(): void {
  stopSpeaking();
  stopWebSpeech();
}

