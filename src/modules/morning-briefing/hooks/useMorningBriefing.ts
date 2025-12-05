// ============================================
// useMorningBriefing Hook
// ============================================

import { useState, useCallback, useRef, useEffect } from 'react';
import type { WeatherData, BriefingScript, BriefingStatus } from '../types';
import type { Medication } from '@/types';
import { fetchWeather } from '../services/weatherService';
import {
  generateMorningBriefing,
  generateFallbackBriefing,
} from '../services/briefingService';
import { BRIEFING_CACHE_KEY, BRIEFING_CACHE_DURATION } from '../constants';

interface CachedBriefing {
  script: BriefingScript;
  audioUrl: string;
  weather: WeatherData | null;
  timestamp: number;
  userName: string;
  medicationCount: number;
  timeOfDay: 'morning' | 'afternoon' | 'evening';
}

/**
 * Get current time of day
 */
function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
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
  medications: Medication[]
): UseMorningBriefingResult {
  // State
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [script, setScript] = useState<BriefingScript | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<BriefingStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [usingSpeechSynthesis, setUsingSpeechSynthesis] = useState(false);

  // Refs
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const speechSynthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const hasTriedGenerating = useRef(false);

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
        console.log('🗑️ Cache expired, clearing...');
        localStorage.removeItem(BRIEFING_CACHE_KEY);
        return null;
      }

      // Check if time of day changed (e.g., morning -> afternoon)
      if (data.timeOfDay !== currentTimeOfDay) {
        console.log(`🗑️ Time changed from ${data.timeOfDay} to ${currentTimeOfDay}, clearing cache...`);
        localStorage.removeItem(BRIEFING_CACHE_KEY);
        return null;
      }

      // Check if user or medication count changed
      if (data.userName !== userName || data.medicationCount !== medications.length) {
        console.log('🗑️ User/medication changed, clearing cache...');
        localStorage.removeItem(BRIEFING_CACHE_KEY);
        return null;
      }

      console.log(`✅ Using cached ${data.timeOfDay} briefing`);
      return data;
    } catch {
      return null;
    }
  }, [userName, medications.length]);

  /**
   * Save briefing to cache
   */
  const cacheBriefing = useCallback(
    (briefingScript: BriefingScript, url: string, weatherData: WeatherData | null) => {
      try {
        const data: CachedBriefing = {
          script: briefingScript,
          audioUrl: url,
          weather: weatherData,
          timestamp: Date.now(),
          userName,
          medicationCount: medications.length,
          timeOfDay: getTimeOfDay(),
        };
        localStorage.setItem(BRIEFING_CACHE_KEY, JSON.stringify(data));
        console.log(`💾 Cached ${data.timeOfDay} briefing`);
      } catch {
        // Ignore storage errors
      }
    },
    [userName, medications.length]
  );

  /**
   * Clean up audio resources
   */
  const cleanupAudio = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    // Cancel speech synthesis
    window.speechSynthesis.cancel();
    speechSynthRef.current = null;
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
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
    setStatus('loading');
    setError(null);
    setProgress(0);
    setUsingSpeechSynthesis(false);

    // Check cache first
    const cached = getCachedBriefing();
    if (cached) {
      setWeather(cached.weather);
      setScript(cached.script);
      setAudioUrl(cached.audioUrl);
      setStatus('ready');
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
        console.warn('Weather fetch failed:', weatherError);
        // Continue without weather
      }

      // Generate briefing script and audio
      try {
        const { script: briefingScript, audioUrl: url } = await generateMorningBriefing(
          userName,
          weatherData,
          medications
        );

        setScript(briefingScript);
        setAudioUrl(url);
        cacheBriefing(briefingScript, url, weatherData);
        setStatus('ready');
        hasTriedGenerating.current = false; // Reset for next time
      } catch (apiError) {
        // Fall back to local generation without TTS
        console.warn('API briefing generation failed:', apiError);
        const fallbackText = generateFallbackBriefing(userName, weatherData, medications);
        setScript({ text: fallbackText, generatedAt: new Date() });
        setAudioUrl(null); // Ensure no audio URL - will use speech synthesis
        setStatus('ready');
        hasTriedGenerating.current = false; // Reset for next time
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate briefing';
      setError(errorMessage);
      setStatus('error');
    }
  }, [userName, medications, getCachedBriefing, cacheBriefing]);

  /**
   * Update progress during playback
   */
  const startProgressTracking = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    progressIntervalRef.current = window.setInterval(() => {
      if (audioRef.current) {
        const currentProgress = (audioRef.current.currentTime / audioRef.current.duration) * 100;
        setProgress(currentProgress);
      }
    }, 100);
  }, []);

  /**
   * Get available voices (with retry for async loading)
   */
  const getVoices = useCallback((): Promise<SpeechSynthesisVoice[]> => {
    return new Promise((resolve) => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        resolve(voices);
        return;
      }
      
      // Voices load asynchronously - wait for them
      const onVoicesChanged = () => {
        window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
        resolve(window.speechSynthesis.getVoices());
      };
      window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
      
      // Timeout after 2 seconds
      setTimeout(() => {
        window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
        resolve(window.speechSynthesis.getVoices());
      }, 2000);
    });
  }, []);

  /**
   * Play using browser's Speech Synthesis API (fallback)
   */
  const playWithSpeechSynthesis = useCallback(async (text: string) => {
    // Check if speech synthesis is supported
    if (!('speechSynthesis' in window)) {
      console.error('Speech synthesis not supported');
      setError('Speech synthesis is not supported in this browser');
      setStatus('error');
      return;
    }

    try {
      // Cancel any existing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9; // Slightly slower for seniors
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      utterance.lang = 'en-US';

      // Wait for voices to load and try to find a warm female voice
      const voices = await getVoices();
      console.log('Available voices:', voices.length, voices.map(v => v.name));
      
      if (voices.length > 0) {
        // Prioritize warm female voices for the "Health Radio" experience
        // Order of preference: Zira (warm), Samantha (Mac), other female voices, then any English voice
        const femaleVoiceNames = [
          'zira',      // Microsoft Zira - warm female voice (Windows)
          'samantha',  // Samantha - natural female voice (Mac)
          'karen',     // Karen - Australian female (Mac)
          'victoria',  // Victoria - female (Mac)
          'susan',     // Susan - female
          'hazel',     // Hazel - UK female
          'linda',     // Linda - female
          'female',    // Any voice with 'female' in name
          'woman',     // Any voice with 'woman' in name
          'fiona',     // Fiona - Scottish female
          'moira',     // Moira - Irish female
          'tessa',     // Tessa - South African female
          'veena',     // Veena - Indian female
          'google us english', // Google's female voice
        ];

        // Find the best female voice
        let preferredVoice: SpeechSynthesisVoice | undefined;
        
        for (const voiceName of femaleVoiceNames) {
          preferredVoice = voices.find(
            (v) => v.lang.startsWith('en') && v.name.toLowerCase().includes(voiceName)
          );
          if (preferredVoice) break;
        }

        // Fallback to any English voice, but avoid male voices if possible
        if (!preferredVoice) {
          const englishVoices = voices.filter(v => v.lang.startsWith('en'));
          // Try to avoid David, Mark, James, etc. (common male voice names)
          const maleNames = ['david', 'mark', 'james', 'george', 'richard', 'daniel', 'alex'];
          preferredVoice = englishVoices.find(
            v => !maleNames.some(male => v.name.toLowerCase().includes(male))
          ) || englishVoices[0] || voices[0];
        }
        
        if (preferredVoice) {
          utterance.voice = preferredVoice;
          console.log('Using voice:', preferredVoice.name);
        }
      }

      // Estimate duration (~150 words per minute at 0.9 rate)
      const wordCount = text.split(/\s+/).length;
      const estimatedDuration = Math.max((wordCount / 150) * 60 / 0.9, 5);
      setDuration(estimatedDuration);

      // Track progress
      const startTime = Date.now();
      progressIntervalRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        const currentProgress = Math.min((elapsed / estimatedDuration) * 100, 99);
        setProgress(currentProgress);
      }, 100);

      utterance.onstart = () => {
        console.log('Speech started');
        setStatus('playing');
      };

      utterance.onend = () => {
        console.log('Speech ended');
        setStatus('ready');
        setProgress(100);
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
      };

      utterance.onerror = (e) => {
        console.error('Speech synthesis error:', e.error, e);
        // Don't show error for 'interrupted' or 'canceled' - these are expected
        if (e.error !== 'interrupted' && e.error !== 'canceled') {
          setError(`Speech failed: ${e.error || 'Unknown error'}`);
          setStatus('error');
        }
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
        }
      };

      speechSynthRef.current = utterance;
      setUsingSpeechSynthesis(true);
      setStatus('playing');
      
      // Small delay to ensure UI updates before speech starts
      await new Promise(resolve => setTimeout(resolve, 100));
      window.speechSynthesis.speak(utterance);
      
    } catch (err) {
      console.error('Speech synthesis setup error:', err);
      setError('Failed to initialize speech');
      setStatus('error');
    }
  }, [getVoices]);

  /**
   * Play the briefing audio
   */
  const play = useCallback(() => {
    // If we have an audio URL, use it
    if (audioUrl) {
      // Create audio element if needed
      if (!audioRef.current) {
        audioRef.current = new Audio(audioUrl);

        // Set up event listeners
        audioRef.current.addEventListener('loadedmetadata', () => {
          setDuration(audioRef.current?.duration ?? 0);
        });

        audioRef.current.addEventListener('ended', () => {
          setStatus('ready');
          setProgress(100);
          if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
          }
        });

        audioRef.current.addEventListener('error', (e) => {
          console.error('Audio playback error:', e);
          // Fallback to speech synthesis on audio error
          if (script?.text) {
            console.log('Falling back to speech synthesis...');
            playWithSpeechSynthesis(script.text).catch(console.error);
          } else {
            setError('Failed to play audio');
            setStatus('error');
          }
        });
      }

      audioRef.current.play().then(() => {
        setStatus('playing');
        startProgressTracking();
      }).catch((err) => {
        console.error('Play failed:', err);
        // Fallback to speech synthesis
        if (script?.text) {
          console.log('Falling back to speech synthesis...');
          playWithSpeechSynthesis(script.text).catch(console.error);
        } else {
          setError('Failed to start playback');
          setStatus('error');
        }
      });
      return;
    }

    // No audio URL - use speech synthesis if we have a script
    if (script?.text) {
      playWithSpeechSynthesis(script.text).catch(console.error);
      return;
    }

    // No script yet - try to generate (but only once to prevent infinite loop)
    if (!hasTriedGenerating.current) {
      hasTriedGenerating.current = true;
      generateBriefing().then(() => {
        // After generation, try to play again
        setTimeout(play, 100);
      });
      return;
    }

    // Already tried generating, show error
    setError('Unable to generate briefing. Please check your internet connection.');
    setStatus('error');
  }, [audioUrl, script, generateBriefing, startProgressTracking, playWithSpeechSynthesis]);

  /**
   * Pause the briefing audio
   */
  const pause = useCallback(() => {
    if (usingSpeechSynthesis) {
      window.speechSynthesis.pause();
    } else if (audioRef.current) {
      audioRef.current.pause();
    }
    setStatus('paused');
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, [usingSpeechSynthesis]);

  /**
   * Stop and reset the briefing audio
   */
  const stop = useCallback(() => {
    if (usingSpeechSynthesis) {
      window.speechSynthesis.cancel();
    } else if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setStatus('ready');
    setProgress(0);
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, [usingSpeechSynthesis]);

  /**
   * Replay from the beginning
   */
  const replay = useCallback(() => {
    // Stop current playback
    if (usingSpeechSynthesis) {
      window.speechSynthesis.cancel();
    } else if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
    setProgress(0);
    play();
  }, [play, usingSpeechSynthesis]);

  // Auto-generate briefing on mount
  useEffect(() => {
    if (status === 'idle' && userName) {
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

