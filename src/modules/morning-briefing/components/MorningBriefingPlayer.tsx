// ============================================
// Morning Briefing Player Component
// ============================================

import React from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/contexts/AppContext';
import { useMorningBriefing } from '../hooks/useMorningBriefing';
import { BRIEFING_CACHE_KEY } from '../constants';
import type { WeatherData } from '../types';

/**
 * Get greeting and icon based on time of day
 */
function getTimeOfDayInfo() {
  const hour = new Date().getHours();
  if (hour < 12) {
    return { greeting: 'Morning Briefing', Icon: Sunrise, theme: 'morning' };
  }
  if (hour < 17) {
    return { greeting: 'Afternoon Briefing', Icon: Sun, theme: 'afternoon' };
  }
  return { greeting: 'Evening Briefing', Icon: Moon, theme: 'evening' };
}

/**
 * Get weather icon component based on condition
 */
function WeatherIcon({ condition }: { condition: string }) {
  const cond = condition.toLowerCase();

  if (cond.includes('rain') || cond.includes('drizzle') || cond.includes('shower')) {
    return <CloudRain className="w-5 h-5" />;
  }
  if (cond.includes('cloud') || cond.includes('overcast')) {
    return <Cloud className="w-5 h-5" />;
  }
  if (cond.includes('clear') || cond.includes('sun')) {
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
  const userName = userNameOverride || contextUserName || 'Friend';

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
  } = useMorningBriefing(userName, medications);

  const { greeting, Icon: TimeIcon } = getTimeOfDayInfo();
  const isLoading = status === 'loading';
  const isPlaying = status === 'playing';
  const isPaused = status === 'paused';
  const isReady = status === 'ready';
  const hasError = status === 'error';

  // Auto-play when ready
  React.useEffect(() => {
    if (autoPlay && isReady && !isPlaying && progress === 0) {
      play();
    }
  }, [autoPlay, isReady, isPlaying, progress, play]);

  // Call onPlayComplete when finished
  React.useEffect(() => {
    if (progress >= 100 && onPlayComplete) {
      onPlayComplete();
    }
  }, [progress, onPlayComplete]);

  const handlePlayPause = () => {
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
    console.log('🗑️ Cache cleared, regenerating briefing...');
    generateBriefing();
  };

  const getStatusText = () => {
    if (isLoading) return 'Preparing your briefing...';
    if (isPlaying) return 'Playing...';
    if (isPaused) return 'Paused';
    if (hasError) return 'Tap to retry';
    if (progress >= 100) return 'Tap to replay';
    return 'Tap to listen';
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
              className={`w-1 bg-white rounded-full ${isPlaying ? 'animate-bounce' : ''}`}
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
              <h2 className="text-lg font-bold tracking-tight">Health Radio</h2>
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
                <span className="text-sm font-medium">{weather.temperature}°C</span>
              </div>
            )}
            
            {/* Refresh button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isLoading}
              className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full"
              title="Generate new briefing"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Script text */}
        <div className="mb-5">
          {isLoading ? (
            <div className="flex items-center gap-2 text-white/80">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Creating your personalized briefing...</span>
            </div>
          ) : hasError ? (
            <p className="text-sm text-white/80 leading-relaxed">
              {error || 'Unable to load briefing. Tap to try again.'}
            </p>
          ) : (
            <p className="text-base leading-relaxed text-white/95">
              {script?.text || 'Loading your daily briefing...'}
            </p>
          )}
        </div>

        {/* Audio Player Card */}
        <div className="bg-white/20 rounded-2xl p-4 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            {/* Play/Pause Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={hasError ? generateBriefing : handlePlayPause}
              disabled={isLoading}
              className="w-14 h-14 bg-white text-rose-500 hover:bg-white/90 hover:text-rose-600 rounded-full shrink-0 shadow-lg transition-all duration-200 active:scale-95 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-7 h-7 animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-7 h-7" />
              ) : progress >= 100 || hasError ? (
                <RotateCcw className="w-6 h-6" />
              ) : (
                <Play className="w-7 h-7 ml-1" />
              )}
            </Button>

            <div className="flex-1 min-w-0">
              {/* Status text */}
              <div className="flex items-center gap-2 mb-2">
                <Volume2 className="w-4 h-4 shrink-0" />
                <span className="text-sm font-medium truncate">{getStatusText()}</span>
              </div>

              {/* Progress bar */}
              <div className="h-2 bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-200 ease-out"
                  style={{ width: `${Math.max(progress, 0)}%` }}
                />
              </div>

              {/* Duration indicator */}
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
        </div>

        {/* Footer hint */}
        <p className="text-center text-xs text-white/60 mt-3">
          🎙️ Your personalized health update
        </p>
      </div>
    </div>
  );
}

export default MorningBriefingPlayer;

