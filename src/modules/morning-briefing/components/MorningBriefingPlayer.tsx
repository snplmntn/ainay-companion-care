// ============================================
// Morning Briefing Player Component
// ============================================

import React, { useState } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Sun,
  Moon,
  Sunrise,
  Volume2,
  Loader2,
  Radio,
  CloudRain,
  Cloud,
  CloudSun,
  RefreshCw,
  Languages,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/contexts/AppContext";
import { useMorningBriefing } from "../hooks/useMorningBriefing";
import { BRIEFING_CACHE_KEY } from "../constants";
import type { WeatherData } from "../types";
import {
  type SupportedLanguage,
  loadLanguagePreference,
  saveLanguagePreference,
  getLanguageOptions,
  LANGUAGES,
} from "@/services/language";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Get greeting and icon based on time of day
 */
function getTimeOfDayInfo() {
  const hour = new Date().getHours();
  if (hour < 12) {
    return { greeting: "Good Morning", Icon: Sunrise, theme: "morning" };
  }
  if (hour < 17) {
    return { greeting: "Good Afternoon", Icon: Sun, theme: "afternoon" };
  }
  return { greeting: "Good Evening", Icon: Moon, theme: "evening" };
}

/**
 * Get weather icon component based on condition
 */
function WeatherIcon({ condition }: { condition: string }) {
  const cond = condition.toLowerCase();

  if (
    cond.includes("rain") ||
    cond.includes("drizzle") ||
    cond.includes("shower")
  ) {
    return <CloudRain className="w-5 h-5" />;
  }
  if (cond.includes("cloud") || cond.includes("overcast")) {
    return <Cloud className="w-5 h-5" />;
  }
  if (cond.includes("clear") || cond.includes("sun")) {
    return <Sun className="w-5 h-5" />;
  }
  return <CloudSun className="w-5 h-5" />;
}

interface MorningBriefingPlayerProps {
  /** Optional custom user name override */
  userNameOverride?: string;
  /** Whether to auto-play when ready */
  autoPlay?: boolean;
  /** Callback when briefing finishes playing */
  onPlayComplete?: () => void;
}

export function MorningBriefingPlayer({
  userNameOverride,
  autoPlay = false,
  onPlayComplete,
}: MorningBriefingPlayerProps) {
  const { userName: contextUserName, medications } = useApp();
  const userName = userNameOverride || contextUserName || "Friend";

  // Language state - synced with user preference
  const [language, setLanguage] = useState<SupportedLanguage>(() =>
    loadLanguagePreference()
  );

  // Collapsed state for script text - collapsed by default
  const [isTextExpanded, setIsTextExpanded] = useState(false);

  const {
    weather,
    script,
    status,
    progress,
    error,
    play,
    pause,
    replay,
    generateBriefing,
  } = useMorningBriefing(userName, medications, language);

  // Handle language change - save preference and regenerate briefing
  const handleLanguageChange = (newLang: SupportedLanguage) => {
    setLanguage(newLang);
    saveLanguagePreference(newLang);
    // Clear cache and regenerate with new language
    localStorage.removeItem(BRIEFING_CACHE_KEY);
    // Trigger regeneration after state update
    setTimeout(() => generateBriefing(), 100);
  };

  const { greeting, Icon: TimeIcon } = getTimeOfDayInfo();
  const isLoading = status === "loading";
  const isPlaying = status === "playing";
  const isPaused = status === "paused";
  const isReady = status === "ready";
  const hasError = status === "error";

  // Refs to prevent double-triggering
  const hasAutoPlayed = React.useRef(false);
  const hasCalledComplete = React.useRef(false);

  // Reset refs when status changes to idle (new briefing)
  React.useEffect(() => {
    if (status === "idle") {
      hasAutoPlayed.current = false;
      hasCalledComplete.current = false;
    }
  }, [status]);

  // Auto-play when ready (only once)
  React.useEffect(() => {
    if (
      autoPlay &&
      isReady &&
      !isPlaying &&
      progress === 0 &&
      !hasAutoPlayed.current
    ) {
      hasAutoPlayed.current = true;
      play();
    }
  }, [autoPlay, isReady, isPlaying, progress]); // Removed 'play' from deps to prevent re-triggering

  // Call onPlayComplete when finished (only once)
  React.useEffect(() => {
    if (progress >= 100 && onPlayComplete && !hasCalledComplete.current) {
      hasCalledComplete.current = true;
      onPlayComplete();
    }
  }, [progress, onPlayComplete]);

  const handlePlayPause = () => {
    // Prevent clicks while loading
    if (isLoading) return;

    if (isPlaying) {
      pause();
    } else if (isPaused || progress >= 100) {
      replay();
    } else {
      play();
    }
  };

  // Refresh briefing - clear cache and regenerate
  const handleRefresh = () => {
    localStorage.removeItem(BRIEFING_CACHE_KEY);
    console.log("🗑️ Cache cleared, regenerating briefing...");
    generateBriefing();
  };

  const getStatusText = () => {
    if (isLoading) return "Getting ready...";
    if (isPlaying) return "Playing now...";
    if (isPaused) return "Paused";
    if (hasError) return "Try again";
    if (progress >= 100) return "Play again";
    return "Press play to listen";
  };

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 via-rose-500 to-pink-600 text-white shadow-xl">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full animate-pulse" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/10 rounded-full" />
        <div className="absolute top-1/2 right-1/4 w-20 h-20 bg-white/5 rounded-full animate-pulse delay-500" />

        {/* Sound wave decorations */}
        <div className="absolute top-4 right-4 flex gap-1 opacity-30">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className={`w-1 bg-white rounded-full ${
                isPlaying ? "animate-bounce" : ""
              }`}
              style={{
                height: `${12 + (i % 3) * 8}px`,
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="relative z-10 p-5">
        {/* Header with Radio branding */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <Radio className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight">
                Your Daily Update
              </h2>
              <div className="flex items-center gap-1.5 text-white/80 text-sm">
                <TimeIcon className="w-3.5 h-3.5" />
                <span>{greeting}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Weather badge */}
            {weather && (
              <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1.5">
                <WeatherIcon condition={weather.condition} />
                <span className="text-sm font-medium">
                  {weather.temperature}°C
                </span>
              </div>
            )}

            {/* Language selector */}
            <Select
              value={language}
              onValueChange={(val) =>
                handleLanguageChange(val as SupportedLanguage)
              }
            >
              <SelectTrigger className="w-auto h-8 bg-white/20 hover:bg-white/30 border-0 rounded-full px-2 text-white">
                <Languages className="w-4 h-4" />
              </SelectTrigger>
              <SelectContent>
                {getLanguageOptions().map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Refresh button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isLoading}
              className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full"
              title="Create a new update"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>

        {/* Hero Play Button - Prominent and centered */}
        <div className="flex flex-col items-center mb-4">
          <button
            onClick={hasError ? generateBriefing : handlePlayPause}
            disabled={isLoading}
            className={`
              relative w-20 h-20 rounded-full bg-white shadow-2xl
              transition-all duration-300 ease-out
              hover:scale-105 active:scale-95
              disabled:opacity-50 disabled:cursor-not-allowed
              ring-4 ${isPlaying ? "ring-white/60" : "ring-white/30"}
            `}
          >
            <span className="flex items-center justify-center w-full h-full text-rose-500">
              {isLoading ? (
                <Loader2 className="w-9 h-9 animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-9 h-9" />
              ) : progress >= 100 || hasError ? (
                <RotateCcw className="w-8 h-8" />
              ) : (
                <Play className="w-9 h-9 ml-1" />
              )}
            </span>
          </button>

          {/* Status text under button */}
          <div className="flex items-center gap-2 mt-3 text-white/90">
            <Volume2 className="w-4 h-4" />
            <span className="text-sm font-medium">{getStatusText()}</span>
          </div>

          {/* Progress bar */}
          <div className="w-full max-w-xs mt-3">
            <div className="h-1.5 bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-200 ease-out"
                style={{ width: `${Math.max(progress, 0)}%` }}
              />
            </div>
            {(isPlaying || isPaused) && (
              <div className="flex justify-between mt-1">
                <span className="text-xs text-white/70">
                  {Math.floor((progress / 100) * 30)}s
                </span>
                <span className="text-xs text-white/70">~30s</span>
              </div>
            )}
          </div>
        </div>

        {/* Collapsible Script Text */}
        <div className="bg-white/10 rounded-xl backdrop-blur-sm overflow-hidden">
          <button
            onClick={() => setIsTextExpanded(!isTextExpanded)}
            className="w-full flex items-center justify-between p-3 hover:bg-white/5 transition-colors"
          >
            <span className="text-sm font-medium text-white/80">
              {isLoading ? "Getting ready..." : "Read what I'll say"}
            </span>
            {isTextExpanded ? (
              <ChevronUp className="w-4 h-4 text-white/60" />
            ) : (
              <ChevronDown className="w-4 h-4 text-white/60" />
            )}
          </button>

          <div
            className={`
              transition-all duration-300 ease-in-out overflow-hidden
              ${isTextExpanded ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}
            `}
          >
            <div className="px-3 pb-3">
              {isLoading ? (
                <div className="flex items-center gap-2 text-white/70">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Writing your daily update...</span>
                </div>
              ) : hasError ? (
                <p className="text-sm text-white/70 leading-relaxed">
                  {error || "Something went wrong. Press play to try again."}
                </p>
              ) : (
                <p className="text-sm leading-relaxed text-white/90">
                  {script?.text || "Loading..."}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer hint */}
        <p className="text-center text-xs text-white/50 mt-4">
          🎙️ Press play to hear your daily health tips
        </p>
      </div>
    </div>
  );
}

export default MorningBriefingPlayer;
