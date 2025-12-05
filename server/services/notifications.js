// ============================================
// Notification Service - Missed Dose Detection & Alerts
// ============================================

import {
  getMedicationsToCheck,
  getLinkedCompanions,
  recordNotification,
  wasNotificationAlreadySent,
} from './supabase.js';
import { sendMissedMedicationEmail, isEmailConfigured } from './email.js';

// Configuration
const NOTIFICATION_CONFIG = {
  // Minutes after scheduled time to consider a dose "missed"
  MISSED_THRESHOLD_MINUTES: parseInt(process.env.MISSED_DOSE_THRESHOLD || '15'),
  // Maximum minutes past scheduled time to still send notification (avoid old notifications)
  MAX_MINUTES_PAST: parseInt(process.env.MAX_NOTIFICATION_WINDOW || '120'),
  // Whether to enable notifications
  ENABLED: process.env.NOTIFICATIONS_ENABLED !== 'false',
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
 * Calculate minutes since a scheduled time
 */
function minutesSinceScheduledTime(scheduledTime, currentTime = new Date()) {
  const parsed = parseTimeString(scheduledTime);
  if (!parsed) return null;
  
  const scheduledDate = new Date(currentTime);
  scheduledDate.setHours(parsed.hours, parsed.minutes, 0, 0);
  
  const diffMs = currentTime.getTime() - scheduledDate.getTime();
  return Math.floor(diffMs / 60000); // Convert to minutes
}

/**
 * Check all medications for missed doses and send notifications
 */
export async function checkAndNotifyMissedDoses() {
  if (!NOTIFICATION_CONFIG.ENABLED) {
    console.log('[Notifications] Notifications are disabled');
    return { checked: 0, notified: 0, errors: [] };
  }

  console.log('[Notifications] Checking for missed doses...');
  
  const now = new Date();
  const results = {
    checked: 0,
    notified: 0,
    errors: [],
    details: [],
  };
  
  // Get all medications that are not taken
  const { medications, error: fetchError } = await getMedicationsToCheck();
  
  if (fetchError) {
    console.error('[Notifications] Failed to fetch medications:', fetchError);
    results.errors.push(`Failed to fetch medications: ${fetchError}`);
    return results;
  }
  
  console.log(`[Notifications] Found ${medications.length} untaken medications`);
  results.checked = medications.length;
  
  for (const med of medications) {
    try {
      // Calculate minutes since scheduled time
      const scheduledTime = med.time || med.start_time;
      const minutesMissed = minutesSinceScheduledTime(scheduledTime, now);
      
      if (minutesMissed === null) {
        console.log(`[Notifications] Could not parse time for ${med.name}: ${scheduledTime}`);
        continue;
      }
      
      // Check if within notification window
      if (minutesMissed < NOTIFICATION_CONFIG.MISSED_THRESHOLD_MINUTES) {
        // Not missed yet
        continue;
      }
      
      if (minutesMissed > NOTIFICATION_CONFIG.MAX_MINUTES_PAST) {
        // Too old, skip
        console.log(`[Notifications] Skipping ${med.name} - too old (${minutesMissed} min)`);
        continue;
      }
      
      console.log(`[Notifications] ${med.name} is ${minutesMissed} min past scheduled time`);
      
      // Get linked companions for this patient
      const { companions, error: companionError } = await getLinkedCompanions(med.user_id);
      
      if (companionError) {
        results.errors.push(`Failed to get companions for ${med.user_id}: ${companionError}`);
        continue;
      }
      
      if (companions.length === 0) {
        console.log(`[Notifications] No companions linked for patient ${med.user_id}`);
        continue;
      }
      
      // Get patient info
      const patientName = med.user?.name || 'Your patient';
      const patientEmail = med.user?.email || '';
      
      // Send notification to each companion
      for (const companion of companions) {
        // Check if already notified today
        const alreadySent = await wasNotificationAlreadySent(med.id, companion.id, now);
        if (alreadySent) {
          console.log(`[Notifications] Already notified ${companion.name} about ${med.name} today`);
          continue;
        }
        
        if (!companion.email) {
          console.log(`[Notifications] Companion ${companion.name} has no email`);
          continue;
        }
        
        // Send email notification
        console.log(`[Notifications] Sending notification to ${companion.name} (${companion.email})`);
        
        const emailResult = await sendMissedMedicationEmail({
          companionName: companion.name,
          companionEmail: companion.email,
          patientName,
          medicationName: med.name,
          dosage: med.dosage,
          scheduledTime,
          minutesMissed,
        });
        
        // Record the notification
        await recordNotification({
          patientId: med.user_id,
          companionId: companion.id,
          medicationId: med.id,
          type: 'missed_medication',
          channel: 'email',
          recipientEmail: companion.email,
          message: `${patientName} missed ${med.name} (${med.dosage}) scheduled at ${scheduledTime}`,
          scheduledTime,
          status: emailResult.success ? 'sent' : 'failed',
        });
        
        if (emailResult.success) {
          results.notified++;
          results.details.push({
            medication: med.name,
            patient: patientName,
            companion: companion.name,
            minutesMissed,
            messageId: emailResult.messageId,
          });
        } else {
          results.errors.push(
            `Failed to notify ${companion.name} about ${med.name}: ${emailResult.error}`
          );
        }
      }
    } catch (error) {
      console.error(`[Notifications] Error processing ${med.name}:`, error);
      results.errors.push(`Error processing ${med.name}: ${error.message}`);
    }
  }
  
  console.log(`[Notifications] Complete: ${results.notified} notifications sent`);
  return results;
}

/**
 * Get notification service status
 */
export function getNotificationStatus() {
  return {
    enabled: NOTIFICATION_CONFIG.ENABLED,
    emailConfigured: isEmailConfigured(),
    missedThresholdMinutes: NOTIFICATION_CONFIG.MISSED_THRESHOLD_MINUTES,
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

