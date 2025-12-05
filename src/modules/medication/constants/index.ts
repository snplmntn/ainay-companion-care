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
  days: number | null; // null for ongoing
}[] = [
  { value: "1", label: "1 day", days: 1 },
  { value: "2", label: "2 days", days: 2 },
  { value: "3", label: "3 days", days: 3 },
  { value: "4", label: "4 days", days: 4 },
  { value: "5", label: "5 days", days: 5 },
  { value: "6", label: "6 days", days: 6 },
  { value: "7", label: "7 days (1 week)", days: 7 },
  { value: "10", label: "10 days", days: 10 },
  { value: "14", label: "14 days (2 weeks)", days: 14 },
  { value: "21", label: "21 days (3 weeks)", days: 21 },
  { value: "28", label: "28 days (4 weeks)", days: 28 },
  { value: "30", label: "30 days (1 month)", days: 30 },
  { value: "45", label: "45 days (1.5 months)", days: 45 },
  { value: "60", label: "60 days (2 months)", days: 60 },
  { value: "90", label: "90 days (3 months)", days: 90 },
  { value: "120", label: "120 days (4 months)", days: 120 },
  { value: "180", label: "180 days (6 months)", days: 180 },
  { value: "270", label: "270 days (9 months)", days: 270 },
  { value: "365", label: "365 days (1 year)", days: 365 },
  { value: "ongoing", label: "Ongoing (no end date)", days: null },
];

/**
 * Calculate end date from start date and time period
 * @param startDate - ISO date string (YYYY-MM-DD) or Date object
 * @param timePeriod - Number of days as string or "ongoing"
 * @returns ISO date string (YYYY-MM-DD) or null for ongoing
 */
export function calculateEndDate(
  startDate: string | Date,
  timePeriod: string
): string | null {
  if (timePeriod === "ongoing") return null;
  
  const days = parseInt(timePeriod, 10);
  if (isNaN(days)) return null;
  
  const start = typeof startDate === "string" ? new Date(startDate) : startDate;
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  
  return end.toISOString().split("T")[0];
}

/**
 * Calculate remaining days for a prescription
 * @param endDate - ISO date string (YYYY-MM-DD) or null for ongoing
 * @returns Number of remaining days, or null for ongoing, or 0 if expired
 */
export function getRemainingDays(endDate: string | null | undefined): number | null {
  if (!endDate) return null; // Ongoing
  
  const end = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  const diffTime = end.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
}

/**
 * Check if a prescription is expired
 * @param endDate - ISO date string (YYYY-MM-DD) or null for ongoing
 * @returns true if expired, false otherwise
 */
export function isPrescriptionExpired(endDate: string | null | undefined): boolean {
  if (!endDate) return false; // Ongoing never expires
  
  const remaining = getRemainingDays(endDate);
  return remaining !== null && remaining <= 0;
}

/**
 * Check if a prescription is ending soon (within threshold days)
 * @param endDate - ISO date string (YYYY-MM-DD) or null for ongoing
 * @param thresholdDays - Number of days to consider "ending soon" (default: 3)
 * @returns true if ending soon, false otherwise
 */
export function isPrescriptionEndingSoon(
  endDate: string | null | undefined,
  thresholdDays: number = 3
): boolean {
  if (!endDate) return false; // Ongoing never ends
  
  const remaining = getRemainingDays(endDate);
  return remaining !== null && remaining > 0 && remaining <= thresholdDays;
}

/**
 * Format remaining days for display
 * @param endDate - ISO date string (YYYY-MM-DD) or null for ongoing
 * @returns Formatted string like "5 days left", "Last day!", "Expired", or "Ongoing"
 */
export function formatRemainingDays(endDate: string | null | undefined): string {
  if (!endDate) return "Ongoing";
  
  const remaining = getRemainingDays(endDate);
  if (remaining === null) return "Ongoing";
  if (remaining === 0) return "Last day!";
  if (remaining < 0) return "Expired";
  if (remaining === 1) return "1 day left";
  
  return `${remaining} days left`;
}

/**
 * Get the status color class for remaining days
 * @param endDate - ISO date string (YYYY-MM-DD) or null for ongoing
 * @returns Tailwind CSS classes for the status
 */
export function getDurationStatusColor(endDate: string | null | undefined): {
  bg: string;
  text: string;
  border: string;
} {
  if (!endDate) {
    return {
      bg: "bg-gray-100 dark:bg-gray-800",
      text: "text-gray-600 dark:text-gray-400",
      border: "border-gray-200 dark:border-gray-700",
    };
  }
  
  const remaining = getRemainingDays(endDate);
  
  if (remaining === null || remaining > 7) {
    return {
      bg: "bg-green-50 dark:bg-green-950/30",
      text: "text-green-700 dark:text-green-400",
      border: "border-green-200 dark:border-green-800",
    };
  }
  
  if (remaining > 3) {
    return {
      bg: "bg-amber-50 dark:bg-amber-950/30",
      text: "text-amber-700 dark:text-amber-400",
      border: "border-amber-200 dark:border-amber-800",
    };
  }
  
  if (remaining > 0) {
    return {
      bg: "bg-orange-50 dark:bg-orange-950/30",
      text: "text-orange-700 dark:text-orange-400",
      border: "border-orange-200 dark:border-orange-800",
    };
  }
  
  // Expired or last day
  return {
    bg: "bg-red-50 dark:bg-red-950/30",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200 dark:border-red-800",
  };
}

/**
 * Get today's date as ISO string (YYYY-MM-DD)
 */
export function getTodayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

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

