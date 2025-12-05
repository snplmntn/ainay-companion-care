// ============================================
// Morning Briefing Module Types
// ============================================

export interface WeatherData {
  temperature: number;
  feelsLike: number;
  condition: string;
  description: string;
  icon: string;
  humidity: number;
  windSpeed: number;
  city: string;
}

export interface MedicationSummary {
  total: number;
  pending: number;
  taken: number;
  nextMedicine?: {
    name: string;
    dosage: string;
    time: string;
    instructions?: string;
  };
  todaysMedicines: Array<{
    name: string;
    dosage: string;
    time: string;
    taken: boolean;
  }>;
}

export interface BriefingScript {
  text: string;
  generatedAt: Date;
}

export interface MorningBriefingState {
  weather: WeatherData | null;
  medications: MedicationSummary | null;
  script: BriefingScript | null;
  audioUrl: string | null;
  isLoading: boolean;
  isPlaying: boolean;
  isGenerating: boolean;
  progress: number;
  duration: number;
  error: string | null;
}

export type BriefingStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'error';

