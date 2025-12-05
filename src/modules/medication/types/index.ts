// ============================================
// Medication Module Types
// ============================================

/**
 * Categories for health items
 */
export type MedicationCategory =
  | "medicine"
  | "vitamin"
  | "supplement"
  | "herbal"
  | "other";

/**
 * Frequency options for medication intake
 */
export type FrequencyType =
  | "once_daily"
  | "twice_daily"
  | "three_times_daily"
  | "four_times_daily"
  | "every_other_day"
  | "weekly"
  | "as_needed"
  | "custom";

/**
 * Next day behavior for medication schedules
 */
export type NextDayMode = "restart" | "continue";

/**
 * A single scheduled dose time
 */
export interface ScheduledDose {
  id: string;
  time: string; // HH:mm format (24-hour)
  label: string; // e.g., "Morning", "Afternoon", "Evening"
  taken: boolean;
  takenAt?: string; // ISO timestamp
}

/**
 * Medicine data extracted from input (image, voice, text)
 */
export interface ExtractedMedicineData {
  id: string;
  name: string;
  dosage: string;
  category: MedicationCategory;
  frequency: FrequencyType;
  customFrequency?: number; // Only used when frequency is "custom"
  timePeriod: string; // e.g., "7 days", "30 days", "ongoing"
  instructions?: string;
  source: "scan" | "voice" | "manual";
  imageUrl?: string; // Optional reference photo
  confirmed: boolean;
}

/**
 * Schedule configuration for a medication
 */
export interface MedicationSchedule {
  id: string;
  medicationId: string;
  frequency: FrequencyType;
  customFrequency?: number;
  startTime: string; // HH:mm format - first dose time
  nextDayMode: NextDayMode;
  intervalMinutes: number; // Computed interval between doses
  doses: ScheduledDose[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Enhanced medication with full scheduling support
 */
export interface EnhancedMedication {
  id: string;
  userId: string;
  name: string;
  dosage: string;
  category: MedicationCategory;
  frequency: FrequencyType;
  customFrequency?: number;
  timePeriod: string;
  instructions?: string;
  imageUrl?: string;
  schedule: MedicationSchedule;
  createdAt: string;
  updatedAt: string;
}

/**
 * Alarm notification data
 */
export interface MedicationAlarm {
  id: string;
  medicationId: string;
  medicationName: string;
  dosage: string;
  scheduledTime: string; // HH:mm
  scheduledDate: string; // YYYY-MM-DD
  notified: boolean;
  snoozed: boolean;
  snoozeUntil?: string;
}

/**
 * Form state for the medicine confirmation flow
 */
export interface MedicineFormData {
  name: string;
  dosage: string;
  category: MedicationCategory;
  frequency: FrequencyType;
  customFrequency?: number;
  timePeriod: string;
  instructions: string;
  startTime: string;
  nextDayMode: NextDayMode;
  imageUrl?: string;
}

/**
 * Props for the confirmation step
 */
export interface ConfirmationStepProps {
  medicine: ExtractedMedicineData;
  onConfirm: (data: MedicineFormData) => void;
  onSkip: () => void;
  onBack?: () => void;
  currentIndex: number;
  totalCount: number;
}

/**
 * Props for the alarm scheduler
 */
export interface AlarmSchedulerProps {
  medicine: MedicineFormData;
  onScheduleSet: (schedule: Omit<MedicationSchedule, "id" | "medicationId">) => void;
  onBack: () => void;
}

