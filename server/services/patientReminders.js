// ============================================
// Patient Reminders Service - Upcoming Dose Notifications
// Sends email reminders to patients before scheduled medication time
// ============================================

import {
  getPatientsWithUpcomingMedications,
  getRemindersSentToday,
  recordReminderNotification,
} from './supabase.js';
import { sendMedicationReminderEmail, isEmailConfigured } from './email.js';
import { sendPatientReminderTelegram, isTelegramConfigured } from './telegramBot.js';

// Configuration
const REMINDER_CONFIG = {
  // Default minutes before scheduled time to send reminder
  DEFAULT_MINUTES_BEFORE: parseInt(process.env.REMINDER_MINUTES_BEFORE || '5'),
  // Window in minutes to consider a medication "upcoming"
  WINDOW_MINUTES: parseInt(process.env.REMINDER_WINDOW || '2'),
  // Whether to enable reminders
  ENABLED: process.env.PATIENT_REMINDERS_ENABLED !== 'false',
};

/**
 * Parse time string like "8:00 AM" or "14:30" to { hours, minutes }
 */
function parseTimeString(timeStr) {
  if (!timeStr) return null;
  
  // Handle "HH:MM AM/PM" format
  const amPmMatch = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (amPmMatch) {
    let hours = parseInt(amPmMatch[1]);
    const minutes = parseInt(amPmMatch[2]);
    const period = amPmMatch[3]?.toUpperCase();
    
    if (period === 'PM' && hours !== 12) {
      hours += 12;
    } else if (period === 'AM' && hours === 12) {
      hours = 0;
    }
    
    return { hours, minutes };
  }
  
  // Handle "HH:MM" 24-hour format
  const h24Match = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (h24Match) {
    return {
      hours: parseInt(h24Match[1]),
      minutes: parseInt(h24Match[2]),
    };
  }
  
  return null;
}

/**
 * Calculate minutes until a scheduled time from now
 * Returns negative if time has passed
 */
function minutesUntilScheduledTime(scheduledTime, currentTime = new Date()) {
  const parsed = parseTimeString(scheduledTime);
  if (!parsed) return null;
  
  const scheduledDate = new Date(currentTime);
  scheduledDate.setHours(parsed.hours, parsed.minutes, 0, 0);
  
  const diffMs = scheduledDate.getTime() - currentTime.getTime();
  return Math.floor(diffMs / 60000); // Convert to minutes
}

/**
 * Check if a medication time is within the reminder window
 * @param {string} scheduledTime - Time string like "8:00 AM"
 * @param {number} reminderMinutes - Minutes before to send reminder
 * @param {Date} currentTime - Current time
 * @returns {boolean} Whether to send reminder now
 */
function isInReminderWindow(scheduledTime, reminderMinutes, currentTime = new Date()) {
  const minutesUntil = minutesUntilScheduledTime(scheduledTime, currentTime);
  if (minutesUntil === null) return false;
  
  // Check if within window: reminderMinutes - WINDOW_MINUTES to reminderMinutes + WINDOW_MINUTES
  const windowStart = reminderMinutes - REMINDER_CONFIG.WINDOW_MINUTES;
  const windowEnd = reminderMinutes + REMINDER_CONFIG.WINDOW_MINUTES;
  
  return minutesUntil >= windowStart && minutesUntil <= windowEnd;
}

/**
 * Check all medications for upcoming doses and send reminders
 */
export async function checkAndSendPatientReminders() {
  if (!REMINDER_CONFIG.ENABLED) {
    console.log('[PatientReminders] Patient reminders are disabled');
    return { checked: 0, sent: 0, errors: [] };
  }

  if (!isEmailConfigured()) {
    console.log('[PatientReminders] Email not configured');
    return { checked: 0, sent: 0, errors: ['Email not configured'] };
  }

  console.log('[PatientReminders] Checking for upcoming medications...');
  
  const now = new Date();
  const results = {
    checked: 0,
    sent: 0,
    errors: [],
    details: [],
  };

  // Step 1: Get all patients with email reminders enabled and their medications
  const { patients, error: fetchError } = await getPatientsWithUpcomingMedications();
  
  if (fetchError) {
    console.error('[PatientReminders] Failed to fetch patients:', fetchError);
    results.errors.push(`Failed to fetch patients: ${fetchError}`);
    return results;
  }

  // Flatten all medications for checking which reminders were sent
  const allMedicationIds = [];
  for (const patient of patients) {
    for (const med of patient.medications) {
      allMedicationIds.push(med.id);
    }
  }

  results.checked = allMedicationIds.length;
  console.log(`[PatientReminders] Found ${allMedicationIds.length} active medications across ${patients.length} patients`);

  if (allMedicationIds.length === 0) {
    return results;
  }

  // Step 2: Check which reminders were already sent today
  const { sentSet, error: historyError } = await getRemindersSentToday(allMedicationIds, now);
  
  if (historyError) {
    results.errors.push(`Failed to check reminder history: ${historyError}`);
  }

  // Step 3: Find medications that are upcoming and need reminders
  const remindersToSend = [];

  for (const patient of patients) {
    const reminderMinutes = patient.email_reminder_minutes || REMINDER_CONFIG.DEFAULT_MINUTES_BEFORE;
    
    for (const med of patient.medications) {
      // Skip if already reminded today
      if (sentSet.has(med.id)) {
        continue;
      }

      // Check the main medication time
      const scheduledTime = med.time || med.start_time;
      if (scheduledTime && isInReminderWindow(scheduledTime, reminderMinutes, now)) {
        const minutesUntil = minutesUntilScheduledTime(scheduledTime, now);
        remindersToSend.push({
          patient,
          medication: med,
          scheduledTime,
          minutesUntil: Math.max(1, minutesUntil), // At least 1 minute
        });
      }
    }
  }

  if (remindersToSend.length === 0) {
    console.log('[PatientReminders] No reminders to send');
    return results;
  }

  console.log(`[PatientReminders] Sending ${remindersToSend.length} reminder(s)`);

  // Step 4: Send reminders (both Email and Telegram)
  for (const reminder of remindersToSend) {
    const { patient, medication, scheduledTime, minutesUntil } = reminder;
    
    console.log(`[PatientReminders] Sending reminder to ${patient.name} for ${medication.name}`);

    let emailSent = false;
    let telegramSent = false;

    // Send Email reminder
    if (patient.email && isEmailConfigured()) {
      try {
        const emailResult = await sendMedicationReminderEmail({
          patientName: patient.name,
          patientEmail: patient.email,
          medicationName: medication.name,
          dosage: medication.dosage,
          scheduledTime,
          minutesUntil,
        });
        emailSent = emailResult.success;
        if (!emailResult.success) {
          results.errors.push(`Failed to send email to ${patient.name}: ${emailResult.error}`);
        }
      } catch (error) {
        console.error(`[PatientReminders] Email error for ${patient.name}:`, error);
        results.errors.push(`Email error for ${patient.name}: ${error.message}`);
      }
    }

    // Send Telegram reminder (if patient has Telegram linked)
    if (patient.telegram_chat_id && isTelegramConfigured()) {
      try {
        const telegramResult = await sendPatientReminderTelegram({
          patientId: patient.id,
          medicationName: medication.name,
          dosage: medication.dosage,
          scheduledTime,
          minutesUntil,
        });
        telegramSent = telegramResult.success;
        if (telegramSent) {
          console.log(`[PatientReminders] Telegram sent to ${patient.name}`);
        }
      } catch (error) {
        console.error(`[PatientReminders] Telegram error for ${patient.name}:`, error);
      }
    }

    // Count as sent if either channel succeeded
    if (emailSent || telegramSent) {
      results.sent++;
      results.details.push({
        patient: patient.name,
        medication: medication.name,
        scheduledTime,
        minutesUntil,
        channels: { email: emailSent, telegram: telegramSent },
      });

      // Record the notification
      await recordReminderNotification({
        patientId: patient.id,
        medicationId: medication.id,
        recipientEmail: patient.email || null,
        message: `Reminder for ${medication.name} (${medication.dosage}) at ${scheduledTime}`,
        scheduledTime,
        status: 'sent',
      });
    } else if (!patient.email && !patient.telegram_chat_id) {
      console.log(`[PatientReminders] Patient ${patient.name} has no contact method (email or Telegram)`);
    }
  }

  console.log(`[PatientReminders] Complete: ${results.sent} reminder(s) sent`);
  return results;
}

/**
 * Get patient reminders service status
 */
export function getPatientReminderStatus() {
  return {
    enabled: REMINDER_CONFIG.ENABLED,
    emailConfigured: isEmailConfigured(),
    defaultMinutesBefore: REMINDER_CONFIG.DEFAULT_MINUTES_BEFORE,
    windowMinutes: REMINDER_CONFIG.WINDOW_MINUTES,
  };
}

