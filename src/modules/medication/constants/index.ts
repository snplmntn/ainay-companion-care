// ============================================
// Medication Module Constants
// ============================================

import type { MedicationCategory, FrequencyType, NextDayMode } from "../types";

/**
 * Category options with display labels and icons
 */
export const MEDICATION_CATEGORIES: {
  value: MedicationCategory;
  label: string;
  icon: string;
  color: string;
}[] = [
  { value: "medicine", label: "Medicine", icon: "💊", color: "bg-red-100 text-red-700" },
  { value: "vitamin", label: "Vitamin", icon: "🌟", color: "bg-yellow-100 text-yellow-700" },
  { value: "supplement", label: "Supplement", icon: "💪", color: "bg-blue-100 text-blue-700" },
  { value: "herbal", label: "Herbal", icon: "🌿", color: "bg-green-100 text-green-700" },
  { value: "other", label: "Other", icon: "📦", color: "bg-gray-100 text-gray-700" },
];

/**
 * Frequency options with computed values
 */
export const FREQUENCY_OPTIONS: {
  value: FrequencyType;
  label: string;
  timesPerDay: number;
  description: string;
}[] = [
  { value: "once_daily", label: "Once daily", timesPerDay: 1, description: "1x a day" },
  { value: "twice_daily", label: "Twice daily", timesPerDay: 2, description: "2x a day (every 12 hours)" },
  { value: "three_times_daily", label: "Three times daily", timesPerDay: 3, description: "3x a day (every 8 hours)" },
  { value: "four_times_daily", label: "Four times daily", timesPerDay: 4, description: "4x a day (every 6 hours)" },
  { value: "every_other_day", label: "Every other day", timesPerDay: 0.5, description: "Alternate days" },
  { value: "weekly", label: "Once weekly", timesPerDay: 0.14, description: "1x a week" },
  { value: "as_needed", label: "As needed", timesPerDay: 0, description: "When required" },
  { value: "custom", label: "Custom", timesPerDay: -1, description: "Set your own schedule" },
];

/**
 * Next day mode options
 */
export const NEXT_DAY_MODE_OPTIONS: {
  value: NextDayMode;
  label: string;
  description: string;
}[] = [
  {
    value: "restart",
    label: "Restart at initial time",
    description: "Next day starts fresh at your first dose time (e.g., 8am every morning)",
  },
  {
    value: "continue",
    label: "Continue from last dose",
    description: "Continue counting from last dose (e.g., 8pm → 2am next dose if 3x daily)",
  },
];

/**
 * Common time period options
 */
export const TIME_PERIOD_OPTIONS: {
  value: string;
  label: string;
}[] = [
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days (1 month)" },
  { value: "60", label: "60 days (2 months)" },
  { value: "90", label: "90 days (3 months)" },
  { value: "ongoing", label: "Ongoing (no end date)" },
];

/**
 * Default dose labels based on time of day
 */
export const DOSE_LABELS: { [key: string]: string } = {
  morning: "Morning",
  midMorning: "Mid-morning",
  noon: "Noon",
  afternoon: "Afternoon",
  evening: "Evening",
  night: "Night",
  lateNight: "Late night",
};

/**
 * Get dose label based on hour
 */
export function getDoseLabelForHour(hour: number): string {
  if (hour >= 5 && hour < 9) return DOSE_LABELS.morning;
  if (hour >= 9 && hour < 12) return DOSE_LABELS.midMorning;
  if (hour >= 12 && hour < 14) return DOSE_LABELS.noon;
  if (hour >= 14 && hour < 17) return DOSE_LABELS.afternoon;
  if (hour >= 17 && hour < 20) return DOSE_LABELS.evening;
  if (hour >= 20 && hour < 24) return DOSE_LABELS.night;
  return DOSE_LABELS.lateNight;
}

/**
 * Default start times for common medications
 */
export const DEFAULT_START_TIMES = {
  medicine: "08:00",
  vitamin: "08:00",
  supplement: "12:00",
  herbal: "09:00",
  other: "08:00",
};

/**
 * Interval in minutes for different frequencies (for waking hours 6am-10pm = 16 hours)
 */
export const FREQUENCY_INTERVALS: { [key in FrequencyType]?: number } = {
  once_daily: 24 * 60, // 1440 minutes
  twice_daily: 12 * 60, // 720 minutes
  three_times_daily: 6 * 60, // 360 minutes (covering 18 hours with 3 doses)
  four_times_daily: 4 * 60 + 30, // 270 minutes (covering 18 hours with 4 doses)
};

/**
 * Get interval in minutes for a frequency
 */
export function getIntervalForFrequency(
  frequency: FrequencyType,
  customFrequency?: number
): number {
  if (frequency === "custom" && customFrequency) {
    // Calculate interval for custom frequency within 16 waking hours
    const wakingMinutes = 16 * 60; // 960 minutes
    return Math.floor(wakingMinutes / customFrequency);
  }

  return FREQUENCY_INTERVALS[frequency] ?? 24 * 60;
}

