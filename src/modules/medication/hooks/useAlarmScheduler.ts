// ============================================
// Alarm Scheduler Hook
// ============================================

import { useState, useEffect, useCallback, useRef } from "react";
import type { MedicationSchedule, MedicationAlarm, EnhancedMedication } from "../types";
import {
  parseTime,
  formatTime12Hour,
  getMinutesUntilNextDose,
  formatTimeUntil,
} from "../services/scheduleService";

interface UseAlarmSchedulerOptions {
  onAlarmTrigger?: (alarm: MedicationAlarm) => void;
  checkIntervalMs?: number;
  reminderMinutesBefore?: number;
}

interface AlarmState {
  activeAlarms: MedicationAlarm[];
  upcomingAlarms: MedicationAlarm[];
  currentTime: Date;
}

/**
 * Request notification permission
 */
async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) {
    console.warn("This browser does not support notifications");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
}

/**
 * Show a notification for a medication alarm
 */
function showNotification(alarm: MedicationAlarm): void {
  if (Notification.permission !== "granted") return;

  const notification = new Notification(`Time for ${alarm.medicationName}`, {
    body: `Take ${alarm.dosage} now`,
    icon: "/icon.ico",
    badge: "/icon.ico",
    tag: alarm.id,
    requireInteraction: true,
    vibrate: [200, 100, 200],
  });

  notification.onclick = () => {
    window.focus();
    notification.close();
  };
}

/**
 * Generate alarms for a medication schedule
 */
function generateAlarmsForSchedule(
  medication: EnhancedMedication,
  date: Date = new Date()
): MedicationAlarm[] {
  const dateStr = date.toISOString().split("T")[0];

  return medication.schedule.doses.map((dose) => ({
    id: `${medication.id}-${dose.id}-${dateStr}`,
    medicationId: medication.id,
    medicationName: medication.name,
    dosage: medication.dosage,
    scheduledTime: dose.time,
    scheduledDate: dateStr,
    notified: false,
    snoozed: false,
  }));
}

/**
 * Hook for managing medication alarms
 */
export function useAlarmScheduler(
  medications: EnhancedMedication[],
  options: UseAlarmSchedulerOptions = {}
) {
  const {
    onAlarmTrigger,
    checkIntervalMs = 30000, // Check every 30 seconds
    reminderMinutesBefore = 5,
  } = options;

  const [state, setState] = useState<AlarmState>({
    activeAlarms: [],
    upcomingAlarms: [],
    currentTime: new Date(),
  });

  const [hasNotificationPermission, setHasNotificationPermission] = useState(false);
  const notifiedAlarmsRef = useRef<Set<string>>(new Set());

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission().then(setHasNotificationPermission);
  }, []);

  // Generate all alarms for today
  const generateTodaysAlarms = useCallback((): MedicationAlarm[] => {
    const today = new Date();
    return medications.flatMap((med) => {
      if (!med.schedule.isActive) return [];
      return generateAlarmsForSchedule(med, today);
    });
  }, [medications]);

  // Check alarms and trigger notifications
  const checkAlarms = useCallback(() => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const allAlarms = generateTodaysAlarms();
    const activeAlarms: MedicationAlarm[] = [];
    const upcomingAlarms: MedicationAlarm[] = [];

    for (const alarm of allAlarms) {
      const { hours, minutes } = parseTime(alarm.scheduledTime);
      const alarmMinutes = hours * 60 + minutes;
      const minutesUntil = alarmMinutes - currentMinutes;

      if (minutesUntil <= 0 && minutesUntil > -30) {
        // Alarm is due (within last 30 minutes)
        activeAlarms.push(alarm);

        // Trigger notification if not already notified
        if (!notifiedAlarmsRef.current.has(alarm.id)) {
          notifiedAlarmsRef.current.add(alarm.id);

          if (hasNotificationPermission) {
            showNotification(alarm);
          }

          onAlarmTrigger?.(alarm);
        }
      } else if (minutesUntil > 0 && minutesUntil <= reminderMinutesBefore) {
        // Upcoming alarm (within reminder window)
        upcomingAlarms.push(alarm);
      } else if (minutesUntil > reminderMinutesBefore) {
        // Future alarm
        upcomingAlarms.push(alarm);
      }
    }

    // Sort upcoming by time
    upcomingAlarms.sort((a, b) => {
      const aMinutes = parseTime(a.scheduledTime).hours * 60 + parseTime(a.scheduledTime).minutes;
      const bMinutes = parseTime(b.scheduledTime).hours * 60 + parseTime(b.scheduledTime).minutes;
      return aMinutes - bMinutes;
    });

    setState({
      activeAlarms,
      upcomingAlarms: upcomingAlarms.slice(0, 5), // Only show next 5
      currentTime: now,
    });
  }, [generateTodaysAlarms, hasNotificationPermission, onAlarmTrigger, reminderMinutesBefore]);

  // Set up interval to check alarms
  useEffect(() => {
    checkAlarms(); // Initial check

    const interval = setInterval(checkAlarms, checkIntervalMs);
    return () => clearInterval(interval);
  }, [checkAlarms, checkIntervalMs]);

  // Reset notified alarms at midnight
  useEffect(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const msUntilMidnight = tomorrow.getTime() - now.getTime();

    const timeout = setTimeout(() => {
      notifiedAlarmsRef.current.clear();
    }, msUntilMidnight);

    return () => clearTimeout(timeout);
  }, []);

  // Snooze an alarm
  const snoozeAlarm = useCallback((alarmId: string, minutesToSnooze: number = 10) => {
    notifiedAlarmsRef.current.delete(alarmId);

    // Re-add after snooze period
    setTimeout(() => {
      checkAlarms();
    }, minutesToSnooze * 60 * 1000);
  }, [checkAlarms]);

  // Dismiss an alarm
  const dismissAlarm = useCallback((alarmId: string) => {
    // Already in notified set, so it won't trigger again today
  }, []);

  // Get next alarm info
  const getNextAlarmInfo = useCallback(() => {
    if (state.upcomingAlarms.length === 0) {
      return null;
    }

    const nextAlarm = state.upcomingAlarms[0];
    const { hours, minutes } = parseTime(nextAlarm.scheduledTime);
    const alarmMinutes = hours * 60 + minutes;
    const currentMinutes = state.currentTime.getHours() * 60 + state.currentTime.getMinutes();
    const minutesUntil = alarmMinutes - currentMinutes;

    return {
      alarm: nextAlarm,
      formattedTime: formatTime12Hour(nextAlarm.scheduledTime),
      timeUntil: formatTimeUntil(minutesUntil),
      minutesUntil,
    };
  }, [state]);

  return {
    activeAlarms: state.activeAlarms,
    upcomingAlarms: state.upcomingAlarms,
    hasNotificationPermission,
    snoozeAlarm,
    dismissAlarm,
    getNextAlarmInfo,
    requestNotificationPermission: async () => {
      const granted = await requestNotificationPermission();
      setHasNotificationPermission(granted);
      return granted;
    },
  };
}

/**
 * Hook for getting formatted schedule display for a single medication
 */
export function useMedicationScheduleDisplay(schedule: MedicationSchedule | null) {
  const [nextDoseInfo, setNextDoseInfo] = useState<{
    time: string;
    timeUntil: string;
    minutesUntil: number;
  } | null>(null);

  useEffect(() => {
    if (!schedule || !schedule.isActive) {
      setNextDoseInfo(null);
      return;
    }

    const update = () => {
      const minutesUntil = getMinutesUntilNextDose(schedule);
      if (minutesUntil === null) {
        setNextDoseInfo(null);
        return;
      }

      const nextDose = schedule.doses.find((d) => !d.taken);
      if (!nextDose) {
        setNextDoseInfo(null);
        return;
      }

      setNextDoseInfo({
        time: formatTime12Hour(nextDose.time),
        timeUntil: formatTimeUntil(minutesUntil),
        minutesUntil,
      });
    };

    update();
    const interval = setInterval(update, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [schedule]);

  return nextDoseInfo;
}

