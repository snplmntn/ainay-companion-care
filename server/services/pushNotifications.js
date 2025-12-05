// ============================================
// Web Push Notification Service
// Handles browser push notifications for companions
// ============================================

import webpush from 'web-push';
import { supabase, isSupabaseConfigured } from './supabase.js';

// VAPID Configuration
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@ainay.app';

// Initialize web-push with VAPID keys
let isPushConfigured = false;

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    isPushConfigured = true;
    console.log('[WebPush] VAPID keys configured successfully');
  } catch (error) {
    console.error('[WebPush] Failed to configure VAPID keys:', error);
  }
} else {
  console.warn('[WebPush] VAPID keys not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY');
}

/**
 * Check if push notifications are configured
 */
export function isPushNotificationConfigured() {
  return isPushConfigured && isSupabaseConfigured();
}

/**
 * Get the public VAPID key for clients
 */
export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY || null;
}

/**
 * Save a push subscription for a user
 */
export async function savePushSubscription(userId, subscription) {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    // Check if subscription already exists for this endpoint
    const { data: existing } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', userId)
      .eq('endpoint', subscription.endpoint)
      .single();

    if (existing) {
      // Update existing subscription
      const { error } = await supabase
        .from('push_subscriptions')
        .update({
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) {
        console.error('[WebPush] Error updating subscription:', error);
        return { success: false, error: error.message };
      }

      return { success: true, updated: true };
    }

    // Create new subscription
    const { error } = await supabase
      .from('push_subscriptions')
      .insert({
        user_id: userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error('[WebPush] Error saving subscription:', error);
      return { success: false, error: error.message };
    }

    console.log('[WebPush] Subscription saved for user:', userId);
    return { success: true, created: true };
  } catch (error) {
    console.error('[WebPush] Error in savePushSubscription:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Remove a push subscription
 */
export async function removePushSubscription(userId, endpoint) {
  if (!isSupabaseConfigured()) {
    return { success: false, error: 'Supabase not configured' };
  }

  try {
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', userId)
      .eq('endpoint', endpoint);

    if (error) {
      console.error('[WebPush] Error removing subscription:', error);
      return { success: false, error: error.message };
    }

    console.log('[WebPush] Subscription removed for user:', userId);
    return { success: true };
  } catch (error) {
    console.error('[WebPush] Error in removePushSubscription:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all subscriptions for a user
 */
export async function getUserSubscriptions(userId) {
  if (!isSupabaseConfigured()) {
    return { subscriptions: [], error: 'Supabase not configured' };
  }

  try {
    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('[WebPush] Error getting subscriptions:', error);
      return { subscriptions: [], error: error.message };
    }

    return { subscriptions: data || [], error: null };
  } catch (error) {
    console.error('[WebPush] Error in getUserSubscriptions:', error);
    return { subscriptions: [], error: error.message };
  }
}

/**
 * Send a push notification to a user
 */
export async function sendPushNotification(userId, payload) {
  if (!isPushConfigured) {
    return { success: false, error: 'Push notifications not configured' };
  }

  const { subscriptions, error: fetchError } = await getUserSubscriptions(userId);
  
  if (fetchError) {
    return { success: false, error: fetchError };
  }

  if (subscriptions.length === 0) {
    return { success: false, error: 'No subscriptions found for user' };
  }

  const notificationPayload = JSON.stringify({
    title: payload.title || 'AInay Notification',
    body: payload.body || '',
    icon: payload.icon || '/icon.png',
    badge: payload.badge || '/icon.png',
    tag: payload.tag || 'ainay-notification',
    data: payload.data || {},
    actions: payload.actions || [],
    requireInteraction: payload.requireInteraction || false,
  });

  const results = [];
  const failedEndpoints = [];

  for (const sub of subscriptions) {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
    };

    try {
      await webpush.sendNotification(pushSubscription, notificationPayload);
      results.push({ endpoint: sub.endpoint, success: true });
    } catch (error) {
      console.error('[WebPush] Error sending to endpoint:', error.statusCode);
      results.push({ endpoint: sub.endpoint, success: false, error: error.message });
      
      // If subscription is no longer valid (410 Gone or 404 Not Found), mark for removal
      if (error.statusCode === 410 || error.statusCode === 404) {
        failedEndpoints.push(sub.endpoint);
      }
    }
  }

  // Clean up invalid subscriptions
  if (failedEndpoints.length > 0) {
    for (const endpoint of failedEndpoints) {
      await removePushSubscription(userId, endpoint);
    }
    console.log(`[WebPush] Removed ${failedEndpoints.length} invalid subscription(s)`);
  }

  const successCount = results.filter(r => r.success).length;
  return {
    success: successCount > 0,
    sent: successCount,
    failed: results.length - successCount,
    results,
  };
}

/**
 * Send push notification to multiple users
 */
export async function sendPushNotificationToMultiple(userIds, payload) {
  const results = [];
  
  for (const userId of userIds) {
    const result = await sendPushNotification(userId, payload);
    results.push({ userId, ...result });
  }

  const successCount = results.filter(r => r.success).length;
  return {
    success: successCount > 0,
    totalUsers: userIds.length,
    successfulUsers: successCount,
    results,
  };
}

/**
 * Send missed medication push notification to companions
 */
export async function sendMissedMedicationPush({
  companionId,
  patientName,
  medicationName,
  dosage,
  scheduledTime,
  minutesMissed,
}) {
  const payload = {
    title: `⚠️ Missed Medication Alert`,
    body: `${patientName} missed ${medicationName} (${dosage}) scheduled at ${scheduledTime}`,
    icon: '/icon.png',
    badge: '/icon.png',
    tag: `missed-med-${Date.now()}`,
    requireInteraction: true,
    data: {
      type: 'missed_medication',
      patientName,
      medicationName,
      dosage,
      scheduledTime,
      minutesMissed,
      url: '/companion',
    },
    actions: [
      { action: 'view', title: 'View Details' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  return sendPushNotification(companionId, payload);
}

/**
 * Send prescription expiring push notification
 */
export async function sendPrescriptionExpiringPush({
  companionId,
  patientName,
  medicationName,
  daysRemaining,
}) {
  const urgency = daysRemaining === 0 ? '🔴' : daysRemaining <= 1 ? '🟠' : '🟡';
  const timeText = daysRemaining === 0 ? 'today' : `in ${daysRemaining} day(s)`;

  const payload = {
    title: `${urgency} Prescription Ending Soon`,
    body: `${patientName}'s ${medicationName} prescription ends ${timeText}`,
    icon: '/icon.png',
    badge: '/icon.png',
    tag: `expiring-${Date.now()}`,
    data: {
      type: 'prescription_expiring',
      patientName,
      medicationName,
      daysRemaining,
      url: '/companion',
    },
  };

  return sendPushNotification(companionId, payload);
}

/**
 * Send a test push notification
 */
export async function sendTestPushNotification(userId) {
  return sendPushNotification(userId, {
    title: '🔔 Test Notification',
    body: 'Push notifications are working! You will receive alerts about patient medications.',
    icon: '/icon.png',
    badge: '/icon.png',
    tag: 'test-notification',
    data: {
      type: 'test',
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Get push notification service status
 */
export function getPushNotificationStatus() {
  return {
    configured: isPushConfigured,
    vapidPublicKey: VAPID_PUBLIC_KEY ? 'Set' : 'Not set',
    vapidPrivateKey: VAPID_PRIVATE_KEY ? 'Set' : 'Not set',
  };
}

