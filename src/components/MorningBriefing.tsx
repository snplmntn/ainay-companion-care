import React, { useState } from 'react';
import { Play, Pause, Sun, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/contexts/AppContext';

export function MorningBriefing() {
  const { userName, medications } = useApp();
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const nextMed = medications.find(m => !m.taken);
  const briefingText = `Good morning, ${userName}! It's 28°C and sunny today. ${nextMed ? `Don't forget to take your ${nextMed.name} ${nextMed.dosage}.` : 'All medications taken for now!'}`;

  // TODO: Connect to OpenAI TTS API
  const handlePlay = () => {
    setIsPlaying(true);
    setProgress(0);
    
    // Simulate audio playback
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsPlaying(false);
          return 0;
        }
        return prev + 2;
      });
    }, 100);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  return (
    <div className="card-senior gradient-coral text-white relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full" />
      <div className="absolute -bottom-5 -left-5 w-20 h-20 bg-white/10 rounded-full" />
      
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <Sun className="w-6 h-6" />
          <span className="text-senior-lg font-semibold">Morning Briefing</span>
        </div>

        <p className="text-senior-base mb-6 leading-relaxed opacity-95">
          {briefingText}
        </p>

        {/* Audio Player */}
        <div className="bg-white/20 rounded-2xl p-4 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon-lg"
              onClick={isPlaying ? handlePause : handlePlay}
              className="bg-white text-primary hover:bg-white/90 rounded-full shrink-0"
            >
              {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
            </Button>

            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Volume2 className="w-5 h-5" />
                <span className="text-senior-sm">
                  {isPlaying ? 'Playing...' : 'Tap to listen'}
                </span>
              </div>
              
              {/* Progress bar */}
              <div className="h-2 bg-white/30 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-white rounded-full transition-all duration-100"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
