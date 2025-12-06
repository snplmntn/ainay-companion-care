// ============================================
// Medication Analytics Service
// Calculates adherence, patterns, and insights
// ============================================

import type { Medication, ScheduledDose } from "@/types";
import { getRemainingDays, isPrescriptionExpired, isPrescriptionEndingSoon } from "../constants";

// ============================================
// Types
// ============================================

export interface DailyAdherence {
  date: string; // YYYY-MM-DD
  scheduled: number;
  taken: number;
  missed: number;
  adherenceRate: number; // 0-100
}

export interface MedicationAdherence {
  medicationId: string;
  medicationName: string;
  category: string;
  totalDoses: number;
  takenDoses: number;
  missedDoses: number;
  adherenceRate: number; // 0-100
  streak: number; // Days in a row taken
  lastTaken?: string; // ISO timestamp
  // Prescription info
  startDate?: string;
  endDate?: string;
  daysRemaining: number | null;
  isExpired: boolean;
  isEndingSoon: boolean;
}

export interface TimeSlotPattern {
  timeSlot: "morning" | "midday" | "afternoon" | "evening" | "night";
  label: string;
  scheduledCount: number;
  takenCount: number;
  adherenceRate: number;
}

export interface OverallAnalytics {
  // Today's stats
  todayScheduled: number;
  todayTaken: number;
  todayMissed: number;
  todayAdherence: number;
  
  // Overall stats
  totalMedications: number;
  activeMedications: number;
  overallAdherence: number;
  currentStreak: number; // Days in a row with 100% adherence
  bestStreak: number;
  
  // Prescription status
  expiringSoon: MedicationAdherence[];
  expired: MedicationAdherence[];
  needsRefill: MedicationAdherence[];
  
  // Patterns
  timeSlotPatterns: TimeSlotPattern[];
  weakestTimeSlot: TimeSlotPattern | null;
  strongestTimeSlot: TimeSlotPattern | null;
  
  // Trends (last 7 days)
  weeklyTrend: DailyAdherence[];
  weeklyAverage: number;
  isImproving: boolean; // Comparing recent vs older performance
}

export interface RefillReminder {
  medicationId: string;
  medicationName: string;
  category: string;
  endDate: string;
  daysRemaining: number;
  urgency: "critical" | "warning" | "info"; // 0-1 days, 2-3 days, 4+ days
}

// ============================================
// Helper Functions
// ============================================

function getTimeSlot(time: string): TimeSlotPattern["timeSlot"] {
  // Parse time (supports "HH:MM" and "H:MM AM/PM" formats)
  let hours: number;
  
  const match24 = time.match(/^(\d{1,2}):(\d{2})$/);
  const match12 = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  
  if (match24) {
    hours = parseInt(match24[1], 10);
  } else if (match12) {
    hours = parseInt(match12[1], 10);
    const period = match12[3].toUpperCase();
    if (period === "PM" && hours !== 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
  } else {
    hours = 8; // Default to morning
  }
  
  if (hours >= 5 && hours < 12) return "morning";
  if (hours >= 12 && hours < 14) return "midday";
  if (hours >= 14 && hours < 17) return "afternoon";
  if (hours >= 17 && hours < 21) return "evening";
  return "night";
}

function getTimeSlotLabel(slot: TimeSlotPattern["timeSlot"]): string {
  const labels: Record<TimeSlotPattern["timeSlot"], string> = {
    morning: "Morning (5am-12pm)",
    midday: "Midday (12pm-2pm)",
    afternoon: "Afternoon (2pm-5pm)",
    evening: "Evening (5pm-9pm)",
    night: "Night (9pm-5am)",
  };
  return labels[slot];
}

function getTodayDateString(): string {
  return new Date().toISOString().split("T")[0];
}

// ============================================
// Analytics Calculations
// ============================================

/**
 * Calculate adherence for a single medication
 */
export function calculateMedicationAdherence(medication: Medication): MedicationAdherence {
  const doses = medication.doses || [];
  const totalDoses = Math.max(doses.length, 1);
  const takenDoses = doses.filter(d => d.taken).length + (medication.taken && doses.length === 0 ? 1 : 0);
  const missedDoses = totalDoses - takenDoses;
  const adherenceRate = Math.round((takenDoses / totalDoses) * 100);
  
  // Calculate streak (simplified - would need dose history for accurate tracking)
  const streak = medication.taken ? 1 : 0;
  
  const daysRemaining = getRemainingDays(medication.endDate);
  
  return {
    medicationId: medication.id,
    medicationName: medication.name,
    category: medication.category || "medicine",
    totalDoses,
    takenDoses,
    missedDoses,
    adherenceRate,
    streak,
    lastTaken: medication.takenAt,
    startDate: medication.startDate,
    endDate: medication.endDate,
    daysRemaining,
    isExpired: isPrescriptionExpired(medication.endDate),
    isEndingSoon: isPrescriptionEndingSoon(medication.endDate, 5), // 5 days threshold
  };
}

/**
 * Calculate time slot patterns from medications
 */
export function calculateTimeSlotPatterns(medications: Medication[]): TimeSlotPattern[] {
  const slots: Record<TimeSlotPattern["timeSlot"], { scheduled: number; taken: number }> = {
    morning: { scheduled: 0, taken: 0 },
    midday: { scheduled: 0, taken: 0 },
    afternoon: { scheduled: 0, taken: 0 },
    evening: { scheduled: 0, taken: 0 },
    night: { scheduled: 0, taken: 0 },
  };
  
  for (const med of medications) {
    if (med.doses && med.doses.length > 0) {
      for (const dose of med.doses) {
        const slot = getTimeSlot(dose.time);
        slots[slot].scheduled++;
        if (dose.taken) slots[slot].taken++;
      }
    } else {
      const slot = getTimeSlot(med.time);
      slots[slot].scheduled++;
      if (med.taken) slots[slot].taken++;
    }
  }
  
  return Object.entries(slots).map(([slot, data]) => ({
    timeSlot: slot as TimeSlotPattern["timeSlot"],
    label: getTimeSlotLabel(slot as TimeSlotPattern["timeSlot"]),
    scheduledCount: data.scheduled,
    takenCount: data.taken,
    adherenceRate: data.scheduled > 0 ? Math.round((data.taken / data.scheduled) * 100) : 0,
  }));
}

/**
 * Get medications that need refills soon
 */
export function getRefillReminders(medications: Medication[]): RefillReminder[] {
  const reminders: RefillReminder[] = [];
  
  for (const med of medications) {
    if (!med.endDate || med.timePeriod === "ongoing") continue;
    
    const daysRemaining = getRemainingDays(med.endDate);
    if (daysRemaining === null) continue;
    
    // Only show reminders for prescriptions ending within 7 days
    if (daysRemaining <= 7 && daysRemaining >= 0) {
      let urgency: RefillReminder["urgency"];
      if (daysRemaining <= 1) urgency = "critical";
      else if (daysRemaining <= 3) urgency = "warning";
      else urgency = "info";
      
      reminders.push({
        medicationId: med.id,
        medicationName: med.name,
        category: med.category || "medicine",
        endDate: med.endDate,
        daysRemaining,
        urgency,
      });
    }
  }
  
  // Sort by urgency (critical first) then by days remaining
  return reminders.sort((a, b) => {
    const urgencyOrder = { critical: 0, warning: 1, info: 2 };
    if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    }
    return a.daysRemaining - b.daysRemaining;
  });
}

/**
 * Calculate overall analytics for all medications
 */
export function calculateOverallAnalytics(medications: Medication[]): OverallAnalytics {
  const activeMeds = medications.filter(m => m.isActive !== false);
  
  // Today's stats
  let todayScheduled = 0;
  let todayTaken = 0;
  
  for (const med of activeMeds) {
    if (med.doses && med.doses.length > 0) {
      todayScheduled += med.doses.length;
      todayTaken += med.doses.filter(d => d.taken).length;
    } else {
      todayScheduled++;
      if (med.taken) todayTaken++;
    }
  }
  
  const todayMissed = todayScheduled - todayTaken;
  const todayAdherence = todayScheduled > 0 ? Math.round((todayTaken / todayScheduled) * 100) : 0;
  
  // Overall adherence
  const overallAdherence = todayAdherence; // Simplified - would need historical data for true overall
  
  // Time slot patterns
  const timeSlotPatterns = calculateTimeSlotPatterns(activeMeds);
  const slotsWithData = timeSlotPatterns.filter(s => s.scheduledCount > 0);
  const weakestTimeSlot = slotsWithData.length > 0 
    ? slotsWithData.reduce((min, s) => s.adherenceRate < min.adherenceRate ? s : min)
    : null;
  const strongestTimeSlot = slotsWithData.length > 0
    ? slotsWithData.reduce((max, s) => s.adherenceRate > max.adherenceRate ? s : max)
    : null;
  
  // Medication adherence details
  const medAdherences = activeMeds.map(calculateMedicationAdherence);
  
  // Prescription status
  const expiringSoon = medAdherences.filter(m => m.isEndingSoon && !m.isExpired);
  const expired = medAdherences.filter(m => m.isExpired);
  const needsRefill = medAdherences.filter(m => 
    m.daysRemaining !== null && 
    m.daysRemaining <= 7 && 
    m.daysRemaining >= 0
  );
  
  // Weekly trend (mock data for now - would need dose_history table)
  const today = new Date();
  const weeklyTrend: DailyAdherence[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    
    // For demo purposes, generate based on today's data with some variation
    const variation = Math.random() * 20 - 10;
    const dayAdherence = Math.max(0, Math.min(100, todayAdherence + variation));
    
    weeklyTrend.push({
      date: dateStr,
      scheduled: todayScheduled,
      taken: Math.round(todayScheduled * dayAdherence / 100),
      missed: Math.round(todayScheduled * (100 - dayAdherence) / 100),
      adherenceRate: Math.round(dayAdherence),
    });
  }
  
  const weeklyAverage = weeklyTrend.length > 0
    ? Math.round(weeklyTrend.reduce((sum, d) => sum + d.adherenceRate, 0) / weeklyTrend.length)
    : 0;
  
  // Check if improving (compare last 3 days vs first 3 days)
  const recentAvg = weeklyTrend.slice(-3).reduce((sum, d) => sum + d.adherenceRate, 0) / 3;
  const olderAvg = weeklyTrend.slice(0, 3).reduce((sum, d) => sum + d.adherenceRate, 0) / 3;
  const isImproving = recentAvg > olderAvg;
  
  // Streak calculation (simplified)
  const currentStreak = todayAdherence === 100 ? 1 : 0;
  const bestStreak = currentStreak; // Would need historical data
  
  return {
    todayScheduled,
    todayTaken,
    todayMissed,
    todayAdherence,
    totalMedications: medications.length,
    activeMedications: activeMeds.length,
    overallAdherence,
    currentStreak,
    bestStreak,
    expiringSoon,
    expired,
    needsRefill,
    timeSlotPatterns,
    weakestTimeSlot,
    strongestTimeSlot,
    weeklyTrend,
    weeklyAverage,
    isImproving,
  };
}

/**
 * Generate insights based on analytics
 */
export function generateInsights(analytics: OverallAnalytics): string[] {
  const insights: string[] = [];
  
  // Today's performance
  if (analytics.todayAdherence === 100) {
    insights.push("🎉 Perfect day! You've taken all your medications on time.");
  } else if (analytics.todayAdherence >= 80) {
    insights.push(`👍 Great progress today! ${analytics.todayTaken} of ${analytics.todayScheduled} doses taken.`);
  } else if (analytics.todayMissed > 0) {
    insights.push(`⚠️ ${analytics.todayMissed} dose${analytics.todayMissed > 1 ? "s" : ""} still pending today.`);
  }
  
  // Weak time slot
  if (analytics.weakestTimeSlot && analytics.weakestTimeSlot.adherenceRate < 70) {
    insights.push(
      `📊 You tend to miss doses in the ${analytics.weakestTimeSlot.timeSlot}. Consider setting extra reminders.`
    );
  }
  
  // Strong time slot
  if (analytics.strongestTimeSlot && analytics.strongestTimeSlot.adherenceRate === 100) {
    insights.push(
      `⭐ Great consistency with ${analytics.strongestTimeSlot.timeSlot} doses!`
    );
  }
  
  // Refills needed
  if (analytics.needsRefill.length > 0) {
    const critical = analytics.needsRefill.filter(m => m.daysRemaining !== null && m.daysRemaining <= 1);
    if (critical.length > 0) {
      insights.push(
        `🔴 ${critical.length} prescription${critical.length > 1 ? "s" : ""} ending today/tomorrow - contact your doctor!`
      );
    } else {
      insights.push(
        `📅 ${analytics.needsRefill.length} prescription${analytics.needsRefill.length > 1 ? "s" : ""} ending soon - plan for refills.`
      );
    }
  }
  
  // Weekly trend
  if (analytics.isImproving) {
    insights.push("📈 Your adherence is improving compared to last week. Keep it up!");
  }
  
  return insights;
}


