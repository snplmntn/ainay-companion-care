// ============================================
// Notification Service - Missed Dose Detection & Alerts
// OPTIMIZED: Batch processing and parallel operations
// TIERED: Push → Telegram → Email notifications
// ============================================

import {
  getMedicationsToCheck,
  getLinkedCompanionsForPatients,
  recordNotificationsBatch,
  getNotificationsSentToday,
} from './supabase.js';
import { sendMissedMedicationEmail, isEmailConfigured } from './email.js';
import { sendMissedMedicationPush, isPushNotificationConfigured } from './pushNotifications.js';
import { sendMissedMedicationTelegram, isTelegramConfigured } from './telegramBot.js';

// Configuration - Tiered notification thresholds
// Push/Telegram come FIRST, email comes LATER
const NOTIFICATION_CONFIG = {
  // === PUSH NOTIFICATION THRESHOLDS ===
  // First push notification (30 seconds = 0.5 minutes)
  PUSH_FIRST_THRESHOLD_MINUTES: parseFloat(process.env.PUSH_FIRST_THRESHOLD || '0.5'),
  // Second push reminder (1 minute)
  PUSH_SECOND_THRESHOLD_MINUTES: parseFloat(process.env.PUSH_SECOND_THRESHOLD || '1'),
  
  // === TELEGRAM NOTIFICATION THRESHOLD ===
  // Telegram notification (1.5 minutes) - between push and email
  TELEGRAM_THRESHOLD_MINUTES: parseFloat(process.env.TELEGRAM_THRESHOLD || '1.5'),
  
  // === EMAIL NOTIFICATION THRESHOLD ===
  // Email notification (3 minutes) - sent AFTER push/telegram notifications
  EMAIL_THRESHOLD_MINUTES: parseFloat(process.env.EMAIL_THRESHOLD || '3'),
  
  // Maximum minutes past scheduled time to still send notification (avoid old notifications)
  MAX_MINUTES_PAST: parseInt(process.env.MAX_NOTIFICATION_WINDOW || '120'),
  // Whether to enable notifications
  ENABLED: process.env.NOTIFICATIONS_ENABLED !== 'false',
  // Maximum concurrent sends
  MAX_CONCURRENT_SENDS: parseInt(process.env.MAX_CONCURRENT_SENDS || '5'),
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
 * Calculate minutes since a scheduled time (with decimal precision)
 */
function minutesSinceScheduledTime(scheduledTime, currentTime = new Date()) {
  const parsed = parseTimeString(scheduledTime);
  if (!parsed) return null;
  
  const scheduledDate = new Date(currentTime);
  scheduledDate.setHours(parsed.hours, parsed.minutes, 0, 0);
  
  const diffMs = currentTime.getTime() - scheduledDate.getTime();
  return diffMs / 60000; // Convert to minutes (with decimals for precision)
}

/**
 * Process items in batches with controlled concurrency
 */
async function processBatched(items, fn, concurrency) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

/**
 * Check all medications for missed doses and send TIERED notifications
 * 
 * Notification Timeline:
 * - 30 seconds (0.5 min): First push notification
 * - 1 minute: Second push notification (reminder)
 * - 1.5 minutes: Telegram notification
 * - 3 minutes: Email notification
 * 
 * Push/Telegram notifications are sent BEFORE email to give instant alerts
 */
export async function checkAndNotifyMissedDoses() {
  if (!NOTIFICATION_CONFIG.ENABLED) {
    console.log('[Notifications] Notifications are disabled');
    return { checked: 0, notified: 0, pushSent: 0, telegramSent: 0, emailSent: 0, errors: [] };
  }

  console.log('[Notifications] Checking for missed doses (tiered notifications)...');
  console.log(`[Notifications] Thresholds - Push1: ${NOTIFICATION_CONFIG.PUSH_FIRST_THRESHOLD_MINUTES}min, Push2: ${NOTIFICATION_CONFIG.PUSH_SECOND_THRESHOLD_MINUTES}min, Telegram: ${NOTIFICATION_CONFIG.TELEGRAM_THRESHOLD_MINUTES}min, Email: ${NOTIFICATION_CONFIG.EMAIL_THRESHOLD_MINUTES}min`);
  
  const now = new Date();
  const results = {
    checked: 0,
    notified: 0,
    pushSent: 0,
    telegramSent: 0,
    emailSent: 0,
    errors: [],
    details: [],
  };
  
  // STEP 1: Get all untaken medications
  const { medications, error: fetchError } = await getMedicationsToCheck();
  
  if (fetchError) {
    console.error('[Notifications] Failed to fetch medications:', fetchError);
    results.errors.push(`Failed to fetch medications: ${fetchError}`);
    return results;
  }
  
  console.log(`[Notifications] Found ${medications.length} untaken medications`);
  results.checked = medications.length;

  if (medications.length === 0) {
    return results;
  }

  // STEP 2: Categorize medications by notification tier
  const pushFirstMeds = [];   // >= 30 seconds
  const pushSecondMeds = [];  // >= 1 minute  
  const telegramMeds = [];    // >= 1.5 minutes
  const emailMeds = [];       // >= 3 minutes
  
  for (const med of medications) {
    const scheduledTime = med.time || med.start_time;
    const minutesMissed = minutesSinceScheduledTime(scheduledTime, now);
    
    if (minutesMissed === null) {
      console.log(`[Notifications] Could not parse time for ${med.name}: ${scheduledTime}`);
      continue;
    }
    
    if (minutesMissed < NOTIFICATION_CONFIG.PUSH_FIRST_THRESHOLD_MINUTES) {
      continue; // Not missed yet (less than 30 seconds)
    }
    
    if (minutesMissed > NOTIFICATION_CONFIG.MAX_MINUTES_PAST) {
      console.log(`[Notifications] Skipping ${med.name} - too old (${minutesMissed.toFixed(1)} min)`);
      continue;
    }
    
    const medWithTime = {
      ...med,
      scheduledTime,
      minutesMissed,
    };
    
    // Categorize by tier
    if (minutesMissed >= NOTIFICATION_CONFIG.EMAIL_THRESHOLD_MINUTES) {
      emailMeds.push(medWithTime);
    }
    if (minutesMissed >= NOTIFICATION_CONFIG.TELEGRAM_THRESHOLD_MINUTES) {
      telegramMeds.push(medWithTime);
    }
    if (minutesMissed >= NOTIFICATION_CONFIG.PUSH_SECOND_THRESHOLD_MINUTES) {
      pushSecondMeds.push(medWithTime);
    }
    if (minutesMissed >= NOTIFICATION_CONFIG.PUSH_FIRST_THRESHOLD_MINUTES) {
      pushFirstMeds.push(medWithTime);
    }
  }

  console.log(`[Notifications] Tier counts - Push1: ${pushFirstMeds.length}, Push2: ${pushSecondMeds.length}, Telegram: ${telegramMeds.length}, Email: ${emailMeds.length}`);

  if (pushFirstMeds.length === 0) {
    console.log('[Notifications] No medications past first threshold');
    return results;
  }

  // STEP 3: Batch fetch companions for all affected patients
  const allMeds = [...new Map([...pushFirstMeds, ...pushSecondMeds, ...telegramMeds, ...emailMeds].map(m => [m.id, m])).values()];
  const patientIds = [...new Set(allMeds.map(m => m.user_id))];
  const { companionsByPatient, error: companionError } = await getLinkedCompanionsForPatients(patientIds);
  
  if (companionError) {
    results.errors.push(`Failed to fetch companions: ${companionError}`);
    return results;
  }

  // STEP 4: Check notification history (tracks push_first, push_second, email separately)
  const medicationIds = allMeds.map(m => m.id);
  const { sentPairs, error: historyError } = await getNotificationsSentToday(medicationIds, now);
  
  if (historyError) {
    results.errors.push(`Failed to check notification history: ${historyError}`);
  }

  const notificationRecords = [];

  // STEP 5A: Send FIRST push notifications (30 seconds threshold)
  if (isPushNotificationConfigured() && pushFirstMeds.length > 0) {
    console.log(`[Notifications] Processing ${pushFirstMeds.length} first push notifications...`);
    
    for (const med of pushFirstMeds) {
      const companions = companionsByPatient.get(med.user_id) || [];
      const patientName = med.user?.name || 'Your patient';
      
      for (const companion of companions) {
        const pairKey = `${med.id}|${companion.id}|push_first`;
        if (sentPairs.has(pairKey)) continue;
        
        try {
          const pushResult = await sendMissedMedicationPush({
            companionId: companion.id,
            patientName,
            medicationName: med.name,
            dosage: med.dosage,
            scheduledTime: med.scheduledTime,
            minutesMissed: med.minutesMissed,
            medicationId: med.id,
          });
          
          if (pushResult.success) {
            results.pushSent++;
            results.notified++;
            console.log(`[Notifications] 🔔 Push (1st) sent to ${companion.name} for ${med.name}`);
            
            notificationRecords.push({
              patientId: med.user_id,
              companionId: companion.id,
              medicationId: med.id,
              type: 'missed_medication_push_first',
              channel: 'push',
              recipientEmail: companion.email,
              message: `[PUSH 1] ${patientName} missed ${med.name}`,
              scheduledTime: med.scheduledTime,
              status: 'sent',
            });
          }
        } catch (error) {
          console.error(`[Notifications] Push (1st) failed for ${companion.name}:`, error.message);
        }
      }
    }
  }

  // STEP 5B: Send SECOND push notifications (1 minute threshold)
  if (isPushNotificationConfigured() && pushSecondMeds.length > 0) {
    console.log(`[Notifications] Processing ${pushSecondMeds.length} second push notifications...`);
    
    for (const med of pushSecondMeds) {
      const companions = companionsByPatient.get(med.user_id) || [];
      const patientName = med.user?.name || 'Your patient';
      
      for (const companion of companions) {
        const pairKey = `${med.id}|${companion.id}|push_second`;
        if (sentPairs.has(pairKey)) continue;
        
        try {
          const pushResult = await sendMissedMedicationPush({
            companionId: companion.id,
            patientName,
            medicationName: med.name,
            dosage: med.dosage,
            scheduledTime: med.scheduledTime,
            minutesMissed: med.minutesMissed,
            medicationId: med.id,
          });
          
          if (pushResult.success) {
            results.pushSent++;
            results.notified++;
            console.log(`[Notifications] 🔔🔔 Push (2nd) sent to ${companion.name} for ${med.name}`);
            
            notificationRecords.push({
              patientId: med.user_id,
              companionId: companion.id,
              medicationId: med.id,
              type: 'missed_medication_push_second',
              channel: 'push',
              recipientEmail: companion.email,
              message: `[PUSH 2] ${patientName} missed ${med.name}`,
              scheduledTime: med.scheduledTime,
              status: 'sent',
            });
          }
        } catch (error) {
          console.error(`[Notifications] Push (2nd) failed for ${companion.name}:`, error.message);
        }
      }
    }
  }

  // STEP 5C: Send TELEGRAM notifications (1.5 minutes threshold)
  if (isTelegramConfigured() && telegramMeds.length > 0) {
    console.log(`[Notifications] Processing ${telegramMeds.length} Telegram notifications...`);
    
    for (const med of telegramMeds) {
      const companions = companionsByPatient.get(med.user_id) || [];
      const patientName = med.user?.name || 'Your patient';
      
      for (const companion of companions) {
        const pairKey = `${med.id}|${companion.id}|telegram`;
        if (sentPairs.has(pairKey)) continue;
        
        try {
          const telegramResult = await sendMissedMedicationTelegram({
            companionId: companion.id,
            patientName,
            medicationName: med.name,
            dosage: med.dosage,
            scheduledTime: med.scheduledTime,
            minutesMissed: med.minutesMissed,
          });
          
          if (telegramResult.success) {
            results.telegramSent++;
            results.notified++;
            console.log(`[Notifications] 📱 Telegram sent to ${companion.name} for ${med.name}`);
            
            notificationRecords.push({
              patientId: med.user_id,
              companionId: companion.id,
              medicationId: med.id,
              type: 'missed_medication_telegram',
              channel: 'telegram',
              recipientEmail: companion.email,
              message: `[TELEGRAM] ${patientName} missed ${med.name}`,
              scheduledTime: med.scheduledTime,
              status: 'sent',
            });
          }
        } catch (error) {
          console.error(`[Notifications] Telegram failed for ${companion.name}:`, error.message);
        }
      }
    }
  }

  // STEP 5D: Send EMAIL notifications (3 minutes threshold)
  if (isEmailConfigured() && emailMeds.length > 0) {
    console.log(`[Notifications] Processing ${emailMeds.length} email notifications...`);
    
    for (const med of emailMeds) {
      const companions = companionsByPatient.get(med.user_id) || [];
      const patientName = med.user?.name || 'Your patient';
      
      for (const companion of companions) {
        if (!companion.email) continue;
        
        const pairKey = `${med.id}|${companion.id}|email`;
        if (sentPairs.has(pairKey)) continue;
        
        try {
          const emailResult = await sendMissedMedicationEmail({
            companionName: companion.name,
            companionEmail: companion.email,
            patientName,
            medicationName: med.name,
            dosage: med.dosage,
            scheduledTime: med.scheduledTime,
            minutesMissed: med.minutesMissed,
          });
          
          if (emailResult.success) {
            results.emailSent++;
            results.notified++;
            console.log(`[Notifications] 📧 Email sent to ${companion.name} for ${med.name}`);
            
            notificationRecords.push({
              patientId: med.user_id,
              companionId: companion.id,
              medicationId: med.id,
              type: 'missed_medication_email',
              channel: 'email',
              recipientEmail: companion.email,
              message: `[EMAIL] ${patientName} missed ${med.name} (${med.dosage}) scheduled at ${med.scheduledTime}`,
              scheduledTime: med.scheduledTime,
              status: 'sent',
            });
            
            results.details.push({
              medication: med.name,
              patient: patientName,
              companion: companion.name,
              minutesMissed: med.minutesMissed,
              messageId: emailResult.messageId,
            });
          }
        } catch (error) {
          console.error(`[Notifications] Email failed for ${companion.name}:`, error.message);
          results.errors.push(`Failed to email ${companion.name}: ${error.message}`);
        }
      }
    }
  }

  // STEP 6: Record all notifications sent
  if (notificationRecords.length > 0) {
    const { error: recordError } = await recordNotificationsBatch(notificationRecords);
    if (recordError) {
      results.errors.push(`Failed to record notifications: ${recordError}`);
    }
  }
  
  console.log(`[Notifications] Complete: ${results.pushSent} push + ${results.telegramSent} telegram + ${results.emailSent} email = ${results.notified} total`);
  return results;
}

/**
 * Get notification service status
 */
export function getNotificationStatus() {
  return {
    enabled: NOTIFICATION_CONFIG.ENABLED,
    emailConfigured: isEmailConfigured(),
    pushConfigured: isPushNotificationConfigured(),
    telegramConfigured: isTelegramConfigured(),
    thresholds: {
      pushFirst: `${NOTIFICATION_CONFIG.PUSH_FIRST_THRESHOLD_MINUTES} min (${NOTIFICATION_CONFIG.PUSH_FIRST_THRESHOLD_MINUTES * 60} sec)`,
      pushSecond: `${NOTIFICATION_CONFIG.PUSH_SECOND_THRESHOLD_MINUTES} min`,
      telegram: `${NOTIFICATION_CONFIG.TELEGRAM_THRESHOLD_MINUTES} min`,
      email: `${NOTIFICATION_CONFIG.EMAIL_THRESHOLD_MINUTES} min`,
    },
    maxNotificationWindow: NOTIFICATION_CONFIG.MAX_MINUTES_PAST,
  };
}

/**
 * Manually trigger a test notification
 */
export async function sendTestNotification(companionEmail, companionName = 'Test User') {
  const result = await sendMissedMedicationEmail({
    companionName,
    companionEmail,
    patientName: 'Test Patient',
    medicationName: 'Test Medicine',
    dosage: '500mg',
    scheduledTime: '8:00 AM',
    minutesMissed: 15,
  });
  
  return result;
}
