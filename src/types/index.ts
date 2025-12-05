// ============================================
// Core Types for AInay Companion Care
// ============================================

export type MedicationCategory =
  | "medicine"
  | "vitamin"
  | "supplement"
  | "herbal"
  | "other";
export type FrequencyType =
  | "once_daily"
  | "twice_daily"
  | "three_times_daily"
  | "four_times_daily"
  | "every_other_day"
  | "weekly"
  | "as_needed"
  | "custom";
export type NextDayMode = "restart" | "continue";
export type DoseStatus = "pending" | "taken" | "missed" | "skipped";

/**
 * Extended medication type with scheduling support
 */
export interface Medication {
  id: string;
  name: string;
  dosage: string;
  time: string;
  taken: boolean;
  instructions?: string;
  // Extended fields
  category: MedicationCategory;
  imageUrl?: string;
  frequency: FrequencyType;
  customFrequency?: number;
  timePeriod: string;
  startDate?: string; // ISO date string (YYYY-MM-DD) - when prescription starts
  endDate?: string; // ISO date string (YYYY-MM-DD) - when prescription ends (null for ongoing)
  startTime: string;
  nextDayMode: NextDayMode;
  intervalMinutes?: number;
  isActive: boolean;
  takenAt?: string;
  // Computed doses for the day
  doses?: ScheduledDose[];
}

/**
 * Simple medication type for backward compatibility
 */
export interface SimpleMedication {
  id: string;
  name: string;
  dosage: string;
  time: string;
  taken: boolean;
  instructions?: string;
}

/**
 * Scheduled dose for enhanced medications
 */
export interface ScheduledDose {
  id: string;
  medicationId?: string;
  time: string;
  label: string; // e.g., "Morning", "Afternoon", "Evening"
  taken: boolean;
  takenAt?: string;
  order?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  /** Base64 data URLs of attached images */
  imageUrls?: string[];
}

export type UserRole = "patient" | "companion" | null;

export interface WeatherInfo {
  temp: number;
  condition: string;
  description?: string;
  icon?: string;
}

// ============================================
// Companion-Patient Relationship Types
// ============================================

export type LinkStatus = "pending" | "accepted" | "rejected";

export interface PatientCompanionLink {
  id: string;
  patientId: string;
  companionId: string;
  status: LinkStatus;
  patientName?: string;
  patientEmail?: string;
  companionName?: string;
  companionEmail?: string;
  createdAt: string;
  acceptedAt?: string;
}

export interface LinkedPatient {
  id: string;
  name: string;
  email: string;
  linkId: string;
  linkStatus: LinkStatus;
  medications: Medication[];
  adherenceRate: number;
  lastActivity?: string;
}

export interface LinkedCompanion {
  id: string;
  name: string;
  email: string;
  linkId: string;
  linkStatus: LinkStatus;
}

// ============================================
// Category Display Helpers
// ============================================

export const CATEGORY_LABELS: Record<MedicationCategory, string> = {
  medicine: "💊 Medicine",
  vitamin: "🌟 Vitamin",
  supplement: "💪 Supplement",
  herbal: "🌿 Herbal",
  other: "📦 Other",
};

export const CATEGORY_COLORS: Record<MedicationCategory, string> = {
  medicine: "bg-primary/10 text-primary border-primary/30",
  vitamin: "bg-amber-100 text-amber-700 border-amber-300",
  supplement: "bg-blue-100 text-blue-700 border-blue-300",
  herbal: "bg-green-100 text-green-700 border-green-300",
  other: "bg-gray-100 text-gray-700 border-gray-300",
};

export const FREQUENCY_LABELS: Record<FrequencyType, string> = {
  once_daily: "Once daily",
  twice_daily: "Twice daily",
  three_times_daily: "3 times daily",
  four_times_daily: "4 times daily",
  every_other_day: "Every other day",
  weekly: "Weekly",
  as_needed: "As needed",
  custom: "Custom interval",
};

export const FREQUENCY_DOSES: Record<FrequencyType, number> = {
  once_daily: 1,
  twice_daily: 2,
  three_times_daily: 3,
  four_times_daily: 4,
  every_other_day: 1,
  weekly: 1,
  as_needed: 0,
  custom: 0,
};
