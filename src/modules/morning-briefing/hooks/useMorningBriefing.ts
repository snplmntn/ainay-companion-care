// ============================================
// useMorningBriefing Hook
// ============================================

import { useState, useCallback, useRef, useEffect } from "react";
import type { WeatherData, BriefingScript, BriefingStatus } from "../types";
import type { Medication } from "@/types";
import { fetchWeather } from "../services/weatherService";
import {
  generateMorningBriefing,
  generateFallbackBriefing,
} from "../services/briefingService";
import { BRIEFING_CACHE_KEY, BRIEFING_CACHE_DURATION } from "../constants";
import {
  type SupportedLanguage,
  loadLanguagePreference,
} from "@/services/language";
import {
  speakWithFallback,
  stopAllSpeech,
  loadTTSEnginePreference,
  type TTSEngine,
} from "@/services/textToSpeech";

interface CachedBriefing {
  script: BriefingScript;
  audioUrl: string;
  weather: WeatherData | null;
  timestamp: number;
  userName: string;
  medicationCount: number;
  timeOfDay: "morning" | "afternoon" | "evening";
  language: SupportedLanguage;
}

/**
 * Get current time of day
 */
function getTimeOfDay(): "morning" | "afternoon" | "evening" {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

interface UseMorningBriefingResult {
  // State
  weather: WeatherData | null;
  script: BriefingScript | null;
  status: BriefingStatus;
  progress: number;
  duration: number;
  error: string | null;
  usingSpeechSynthesis: boolean;

  // Actions
  generateBriefing: () => Promise<void>;
  play: () => void;
  pause: () => void;
  stop: () => void;
  replay: () => void;
}

export function useMorningBriefing(
  userName: string,
  medications: Medication[],
  languageOverride?: SupportedLanguage
): UseMorningBriefingResult {
  // Get language from override or user preference
  const language = languageOverride || loadLanguagePreference();

  // State
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [script, setScript] = useState<BriefingScript | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<BriefingStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [usingSpeechSynthesis, setUsingSpeechSynthesis] = useState(false);

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const speechSynthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const hasTriedGenerating = useRef(false);
  const isPlayingRef = useRef(false); // Prevent double-play
  const hasCompletedRef = useRef(false); // Prevent looping - track if played to completion
  const hasFallenBackRef = useRef(false); // Prevent multiple fallbacks causing double audio

  /**
   * Check if cached briefing is still valid
   */
  const getCachedBriefing = useCallback((): CachedBriefing | null => {
    try {
      const cached = localStorage.getItem(BRIEFING_CACHE_KEY);
      if (!cached) return null;

      const data: CachedBriefing = JSON.parse(cached);
      const currentTimeOfDay = getTimeOfDay();

      // Check if cache is expired
      if (Date.now() - data.timestamp > BRIEFING_CACHE_DURATION) {
        console.log("🗑️ Cache expired, clearing...");
        localStorage.removeItem(BRIEFING_CACHE_KEY);
        return null;
      }

      // Check if time of day changed (e.g., morning -> afternoon)
      if (data.timeOfDay !== currentTimeOfDay) {
        console.log(
          `🗑️ Time changed from ${data.timeOfDay} to ${currentTimeOfDay}, clearing cache...`
        );
        localStorage.removeItem(BRIEFING_CACHE_KEY);
        return null;
      }

      // Check if user or medication count changed
      if (
        data.userName !== userName ||
        data.medicationCount !== medications.length
      ) {
        console.log("🗑️ User/medication changed, clearing cache...");
        localStorage.removeItem(BRIEFING_CACHE_KEY);
        return null;
      }

      // Check if language changed
      if (data.language !== language) {
        console.log(
          `🗑️ Language changed from ${data.language} to ${language}, clearing cache...`
        );
        localStorage.removeItem(BRIEFING_CACHE_KEY);
        return null;
      }

      console.log(
        `✅ Using cached ${data.timeOfDay} briefing (${data.language})`
      );
      return data;
    } catch {
      return null;
    }
  }, [userName, medications.length, language]);

  /**
   * Save briefing to cache
   */
  const cacheBriefing = useCallback(
    (
      briefingScript: BriefingScript,
      url: string,
      weatherData: WeatherData | null
    ) => {
      try {
        const data: CachedBriefing = {
          script: briefingScript,
          audioUrl: url,
          weather: weatherData,
          timestamp: Date.now(),
          userName,
          medicationCount: medications.length,
          timeOfDay: getTimeOfDay(),
          language,
        };
        localStorage.setItem(BRIEFING_CACHE_KEY, JSON.stringify(data));
        console.log(`💾 Cached ${data.timeOfDay} briefing (${language})`);
      } catch {
        // Ignore storage errors
      }
    },
    [userName, medications.length, language]
  );

  /**
   * Clean up audio resources
   */
  const cleanupAudio = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    // Stop all TTS (both OpenAI and browser)
    stopAllSpeech();
    speechSynthRef.current = null;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
  }, [audioUrl]);

  /**
   * Generate the morning briefing
   */
  const generateBriefing = useCallback(async () => {
    setStatus("loading");
    setError(null);
    setProgress(0);
    setUsingSpeechSynthesis(false);

    // Check cache first
    const cached = getCachedBriefing();
    if (cached) {
      setWeather(cached.weather);
      setScript(cached.script);
      setAudioUrl(cached.audioUrl);
      setStatus("ready");
      hasTriedGenerating.current = false; // Reset for next time
      return;
    }

    try {
      // Fetch weather (don't fail if this fails)
      let weatherData: WeatherData | null = null;
      try {
        weatherData = await fetchWeather();
        setWeather(weatherData);
      } catch (weatherError) {
        console.warn("Weather fetch failed:", weatherError);
        // Continue without weather
      }

      // Generate briefing script and audio
      try {
        const { script: briefingScript, audioUrl: url } =
          await generateMorningBriefing(
            userName,
            weatherData,
            medications,
            language
          );

        setScript(briefingScript);
        setAudioUrl(url);
        cacheBriefing(briefingScript, url, weatherData);
        setStatus("ready");
        hasTriedGenerating.current = false; // Reset for next time
        hasCompletedRef.current = false; // Reset completion flag for new briefing
      } catch (apiError) {
        // Fall back to local generation without TTS
        console.warn("API briefing generation failed:", apiError);
        const fallbackText = generateFallbackBriefing(
          userName,
          weatherData,
          medications,
          language
        );
        setScript({ text: fallbackText, generatedAt: new Date() });
        setAudioUrl(null); // Ensure no audio URL - will use speech synthesis
        setStatus("ready");
        hasTriedGenerating.current = false; // Reset for next time
        hasCompletedRef.current = false; // Reset completion flag for new briefing
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to generate briefing";
      setError(errorMessage);
      setStatus("error");
    }
  }, [userName, medications, getCachedBriefing, cacheBriefing, language]);

  /**
   * Update progress during playback
   */
  const startProgressTracking = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    progressIntervalRef.current = window.setInterval(() => {
      if (audioRef.current) {
        const currentProgress =
          (audioRef.current.currentTime / audioRef.current.duration) * 100;
        setProgress(currentProgress);
      }
    }, 100);
  }, []);

  /**
   * Play using the shared TTS service (same as chat)
   * Uses speakWithFallback which supports both OpenAI and browser TTS
   */
  const playWithTTSService = useCallback(
    async (text: string) => {
      try {
        // Stop any existing speech AND audio elements
        stopAllSpeech();
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }

        // Get TTS engine preference (same as chat)
        const engine: TTSEngine = loadTTSEnginePreference();
        console.log(`📻 Loading briefing with ${engine} TTS in ${language}`);

        // Estimate duration (~150 words per minute)
        const wordCount = text.split(/\s+/).length;
        const estimatedDuration = Math.max((wordCount / 150) * 60, 5);
        setDuration(estimatedDuration);

        setUsingSpeechSynthesis(engine === "browser");
        // Keep status as "loading" until audio actually starts
        setStatus("loading");

        let startTime: number | null = null;

        // Use the same TTS service as the chat
        await speakWithFallback(text, language, {
          engine,
          speed: 0.95, // Slightly slower for seniors
          voice: "shimmer", // Warmest female voice for OpenAI
          onStart: () => {
            // Audio is now playing - start progress tracking
            console.log(`📻 Briefing started playing`);
            setStatus("playing");
            startTime = Date.now();

            // Track progress during playback
            progressIntervalRef.current = window.setInterval(() => {
              if (startTime) {
                const elapsed = (Date.now() - startTime) / 1000;
                const currentProgress = Math.min(
                  (elapsed / estimatedDuration) * 100,
                  99
                );
                setProgress(currentProgress);
              }
            }, 100);
          },
        });

        // Playback completed successfully
        console.log("TTS playback completed");
        isPlayingRef.current = false;
        hasCompletedRef.current = true;
        setStatus("ready");
        setProgress(100);

        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
      } catch (err) {
        console.error("TTS playback error:", err);
        isPlayingRef.current = false;

        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }

        // Don't show error for interruption
        const errorMessage = err instanceof Error ? err.message : "TTS failed";
        if (
          !errorMessage.includes("interrupted") &&
          !errorMessage.includes("canceled")
        ) {
          setError(`Playback failed: ${errorMessage}`);
          setStatus("error");
        } else {
          setStatus("ready");
        }
      }
    },
    [language]
  );

  /**
   * Play the briefing audio
   */
  const play = useCallback(() => {
    // Prevent double-play
    if (isPlayingRef.current) {
      console.log("Already playing, ignoring duplicate play call");
      return;
    }

    // IMPORTANT: Stop all existing audio before starting new playback
    // This prevents the "two voices" bug
    stopAllSpeech();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    // Reset fallback flag for this play attempt
    hasFallenBackRef.current = false;

    // If we have an audio URL (from server-side OpenAI TTS), use it directly
    if (audioUrl) {
      // Create audio element if needed
      if (!audioRef.current) {
        audioRef.current = new Audio(audioUrl);

        // Explicitly disable looping
        audioRef.current.loop = false;

        // Set up event listeners
        audioRef.current.addEventListener("loadedmetadata", () => {
          setDuration(audioRef.current?.duration ?? 0);
        });

        audioRef.current.addEventListener(
          "ended",
          () => {
            console.log("Audio ended - marking as completed");
            isPlayingRef.current = false;
            hasCompletedRef.current = true;
            setStatus("ready");
            setProgress(100);
            if (progressIntervalRef.current) {
              clearInterval(progressIntervalRef.current);
              progressIntervalRef.current = null;
            }
          },
          { once: false }
        );

        audioRef.current.addEventListener("error", (e) => {
          console.error("Audio playback error:", e);
          isPlayingRef.current = false;
          // Fallback to TTS service on audio error (only once)
          if (script?.text && !hasFallenBackRef.current) {
            hasFallenBackRef.current = true;
            console.log("Falling back to TTS service...");
            playWithTTSService(script.text).catch(console.error);
          } else if (!hasFallenBackRef.current) {
            setError("Failed to play audio");
            setStatus("error");
          }
        });
      }

      isPlayingRef.current = true;
      audioRef.current
        .play()
        .then(() => {
          setStatus("playing");
          startProgressTracking();
        })
        .catch((err) => {
          console.error("Play failed:", err);
          isPlayingRef.current = false;
          // Fallback to TTS service (only if not already fallen back)
          if (script?.text && !hasFallenBackRef.current) {
            hasFallenBackRef.current = true;
            console.log("Falling back to TTS service...");
            playWithTTSService(script.text).catch(console.error);
          } else if (!hasFallenBackRef.current) {
            setError("Failed to start playback");
            setStatus("error");
          }
        });
      return;
    }

    // No audio URL - use the TTS service (same as chat) if we have a script
    if (script?.text) {
      isPlayingRef.current = true;
      setStatus("loading"); // Show loading while TTS prepares
      playWithTTSService(script.text).catch((err) => {
        console.error("TTS service failed:", err);
        isPlayingRef.current = false;
      });
      return;
    }

    // No script yet - try to generate (but only once to prevent infinite loop)
    if (!hasTriedGenerating.current) {
      hasTriedGenerating.current = true;
      generateBriefing();
      // Don't auto-play after generation - let the component handle it
      return;
    }

    // Already tried generating, show error
    setError(
      "Unable to generate briefing. Please check your internet connection."
    );
    setStatus("error");
  }, [
    audioUrl,
    script,
    generateBriefing,
    startProgressTracking,
    playWithTTSService,
  ]);

  /**
   * Pause the briefing audio
   */
  const pause = useCallback(() => {
    isPlayingRef.current = false;
    if (usingSpeechSynthesis) {
      // Browser speech synthesis supports pause
      if ("speechSynthesis" in window) {
        window.speechSynthesis.pause();
      }
    } else if (audioRef.current) {
      audioRef.current.pause();
    }
    setStatus("paused");
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, [usingSpeechSynthesis]);

  /**
   * Stop and reset the briefing audio
   */
  const stop = useCallback(() => {
    isPlayingRef.current = false;
    // Stop all TTS (both OpenAI and browser)
    stopAllSpeech();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setStatus("ready");
    setProgress(0);
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  /**
   * Replay from the beginning
   */
  const replay = useCallback(() => {
    // Stop current playback first
    isPlayingRef.current = false;
    hasCompletedRef.current = false; // Reset completion flag for replay
    hasFallenBackRef.current = false; // Reset fallback flag for replay
    stopAllSpeech();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setProgress(0);
    setStatus("ready"); // Reset to ready state before playing
    // Small delay to ensure cleanup before replay
    setTimeout(() => {
      play();
    }, 100);
  }, [play]);

  // Auto-generate briefing on mount
  useEffect(() => {
    if (status === "idle" && userName) {
      generateBriefing();
    }
  }, [status, userName, generateBriefing]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, [cleanupAudio]);

  return {
    weather,
    script,
    status,
    progress,
    duration,
    error,
    usingSpeechSynthesis,
    generateBriefing,
    play,
    pause,
    stop,
    replay,
  };
}
