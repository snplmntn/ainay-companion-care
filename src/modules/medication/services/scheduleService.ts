// ============================================
// Medication Schedule Service
// ============================================

import type {
  FrequencyType,
  NextDayMode,
  ScheduledDose,
  MedicationSchedule,
  MedicineFormData,
} from "../types";
import {
  FREQUENCY_OPTIONS,
  getDoseLabelForHour,
  getIntervalForFrequency,
} from "../constants";

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Parse time string to hours and minutes
 */
export function parseTime(timeStr: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeStr.split(":").map(Number);
  return { hours: hours || 0, minutes: minutes || 0 };
}

/**
 * Format hours and minutes to HH:mm string
 */
export function formatTime(hours: number, minutes: number): string {
  const h = ((hours % 24) + 24) % 24; // Handle negative hours
  const m = ((minutes % 60) + 60) % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

/**
 * Convert 24-hour time to 12-hour format with AM/PM
 */
export function formatTime12Hour(timeStr: string): string {
  const { hours, minutes } = parseTime(timeStr);
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
}

/**
 * Add minutes to a time string
 */
export function addMinutesToTime(timeStr: string, minutesToAdd: number): string {
  const { hours, minutes } = parseTime(timeStr);
  const totalMinutes = hours * 60 + minutes + minutesToAdd;
  const newHours = Math.floor(totalMinutes / 60);
  const newMinutes = totalMinutes % 60;
  return formatTime(newHours, newMinutes);
}

/**
 * Get the number of doses per day for a frequency
 */
export function getDosesPerDay(
  frequency: FrequencyType,
  customFrequency?: number
): number {
  if (frequency === "custom" && customFrequency) {
    return customFrequency;
  }

  const option = FREQUENCY_OPTIONS.find((opt) => opt.value === frequency);
  return option?.timesPerDay ?? 1;
}

/**
 * Calculate all dose times for a day given a start time and frequency
 */
export function calculateDoseTimes(
  startTime: string,
  frequency: FrequencyType,
  customFrequency?: number,
  nextDayMode: NextDayMode = "restart"
): ScheduledDose[] {
  const doses: ScheduledDose[] = [];
  const dosesPerDay = getDosesPerDay(frequency, customFrequency);

  if (dosesPerDay <= 0 || frequency === "as_needed") {
    // For "as needed" medications, just create one placeholder dose
    return [
      {
        id: generateId(),
        time: startTime,
        label: "As needed",
        taken: false,
      },
    ];
  }

  // For every other day or weekly, just one dose
  if (frequency === "every_other_day" || frequency === "weekly") {
    const { hours } = parseTime(startTime);
    return [
      {
        id: generateId(),
        time: startTime,
        label: getDoseLabelForHour(hours),
        taken: false,
      },
    ];
  }

  const intervalMinutes = getIntervalForFrequency(frequency, customFrequency);
  let currentTime = startTime;

  for (let i = 0; i < dosesPerDay; i++) {
    const { hours } = parseTime(currentTime);

    doses.push({
      id: generateId(),
      time: currentTime,
      label: getDoseLabelForHour(hours),
      taken: false,
    });

    // Calculate next dose time
    currentTime = addMinutesToTime(currentTime, intervalMinutes);

    // For restart mode, cap times at 22:00 (10 PM) to avoid late night doses
    if (nextDayMode === "restart") {
      const { hours: nextHours } = parseTime(currentTime);
      if (nextHours >= 22 || nextHours < 6) {
        // If we'd go past 10 PM or into early morning, redistribute
        // Instead, we'll just add remaining doses evenly
        const remainingDoses = dosesPerDay - i - 1;
        if (remainingDoses > 0) {
          const { hours: startHours, minutes: startMinutes } = parseTime(startTime);
          const startTotalMinutes = startHours * 60 + startMinutes;
          const endTotalMinutes = 22 * 60; // 10 PM
          const availableMinutes = endTotalMinutes - startTotalMinutes;
          const redistributedInterval = Math.floor(availableMinutes / dosesPerDay);

          // Recalculate remaining doses with redistributed interval
          for (let j = i + 1; j < dosesPerDay; j++) {
            currentTime = addMinutesToTime(startTime, redistributedInterval * j);
            const { hours: redistHours } = parseTime(currentTime);
            doses.push({
              id: generateId(),
              time: currentTime,
              label: getDoseLabelForHour(redistHours),
              taken: false,
            });
          }
          break;
        }
      }
    }
  }

  return doses;
}

/**
 * Calculate the next dose time based on current time and schedule
 */
export function getNextDoseTime(
  schedule: MedicationSchedule,
  currentTime: Date = new Date()
): ScheduledDose | null {
  const currentHours = currentTime.getHours();
  const currentMinutes = currentTime.getMinutes();
  const currentTotalMinutes = currentHours * 60 + currentMinutes;

  // Find the next untaken dose
  for (const dose of schedule.doses) {
    if (dose.taken) continue;

    const { hours, minutes } = parseTime(dose.time);
    const doseTotalMinutes = hours * 60 + minutes;

    if (doseTotalMinutes > currentTotalMinutes) {
      return dose;
    }
  }

  // All doses for today are either taken or past
  return null;
}

/**
 * Create a full medication schedule from form data
 */
export function createMedicationSchedule(
  formData: MedicineFormData,
  medicationId: string = generateId()
): MedicationSchedule {
  const intervalMinutes = getIntervalForFrequency(
    formData.frequency,
    formData.customFrequency
  );

  const doses = calculateDoseTimes(
    formData.startTime,
    formData.frequency,
    formData.customFrequency,
    formData.nextDayMode
  );

  return {
    id: generateId(),
    medicationId,
    frequency: formData.frequency,
    customFrequency: formData.customFrequency,
    startTime: formData.startTime,
    nextDayMode: formData.nextDayMode,
    intervalMinutes,
    doses,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Recalculate doses for the next day based on mode
 */
export function calculateNextDayDoses(
  schedule: MedicationSchedule,
  lastDoseTime?: string
): ScheduledDose[] {
  if (schedule.nextDayMode === "restart") {
    // Restart from the original start time
    return calculateDoseTimes(
      schedule.startTime,
      schedule.frequency,
      schedule.customFrequency,
      schedule.nextDayMode
    );
  }

  // Continue mode: calculate from last dose
  if (lastDoseTime) {
    const nextStartTime = addMinutesToTime(lastDoseTime, schedule.intervalMinutes);
    return calculateDoseTimes(
      nextStartTime,
      schedule.frequency,
      schedule.customFrequency,
      schedule.nextDayMode
    );
  }

  // Fallback to restart behavior if no last dose
  return calculateDoseTimes(
    schedule.startTime,
    schedule.frequency,
    schedule.customFrequency,
    schedule.nextDayMode
  );
}

/**
 * Format schedule summary for display
 */
export function formatScheduleSummary(schedule: MedicationSchedule): string {
  const doseCount = schedule.doses.length;
  const times = schedule.doses.map((d) => formatTime12Hour(d.time)).join(", ");

  if (schedule.frequency === "as_needed") {
    return "Take as needed";
  }

  if (schedule.frequency === "every_other_day") {
    return `Every other day at ${times}`;
  }

  if (schedule.frequency === "weekly") {
    return `Once weekly at ${times}`;
  }

  return `${doseCount}x daily: ${times}`;
}

/**
 * Calculate time until next dose in minutes
 */
export function getMinutesUntilNextDose(
  schedule: MedicationSchedule,
  currentTime: Date = new Date()
): number | null {
  const nextDose = getNextDoseTime(schedule, currentTime);
  if (!nextDose) return null;

  const { hours, minutes } = parseTime(nextDose.time);
  const doseTime = new Date(currentTime);
  doseTime.setHours(hours, minutes, 0, 0);

  const diffMs = doseTime.getTime() - currentTime.getTime();
  return Math.max(0, Math.floor(diffMs / 60000));
}

/**
 * Format "time until" for display
 */
export function formatTimeUntil(minutes: number): string {
  if (minutes < 1) return "now";
  if (minutes < 60) return `in ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `in ${hours} hr${hours > 1 ? "s" : ""}`;
  }

  return `in ${hours}hr ${remainingMinutes}min`;
}


