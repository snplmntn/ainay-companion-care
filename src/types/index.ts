export interface Medication {
  id: string;
  name: string;
  dosage: string;
  time: string;
  taken: boolean;
  instructions?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export type UserRole = 'patient' | 'companion' | null;

export interface WeatherInfo {
  temp: number;
  condition: string;
}
