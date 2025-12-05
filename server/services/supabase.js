// ============================================
// Supabase Service for Server-Side Operations
// ============================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('⚠️ Supabase not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
}

// Create Supabase client with service role key (bypasses RLS for server operations)
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceKey || 'placeholder-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export function isSupabaseConfigured() {
  return !!supabaseUrl && !!supabaseServiceKey;
}

/**
 * Get all active medications that need to be checked for missed doses
 * Returns medications with their scheduled time and user information
 */
export async function getMedicationsToCheck() {
  const { data, error } = await supabase
    .from('medications')
    .select(`
      id,
      user_id,
      name,
      dosage,
      time,
      taken,
      taken_at,
      frequency,
      start_time,
      is_active,
      updated_at,
      user:profiles!medications_user_id_fkey(id, name, email)
    `)
    .eq('is_active', true)
    .eq('taken', false);

  if (error) {
    console.error('[Supabase] Error fetching medications:', error);
    return { medications: [], error: error.message };
  }

  return { medications: data || [], error: null };
}

/**
 * Get companions linked to a patient
 */
export async function getLinkedCompanions(patientId) {
  const { data, error } = await supabase
    .from('patient_companions')
    .select(`
      id,
      companion_id,
      companion:profiles!patient_companions_companion_id_fkey(id, name, email)
    `)
    .eq('patient_id', patientId)
    .eq('status', 'accepted');

  if (error) {
    console.error('[Supabase] Error fetching companions:', error);
    return { companions: [], error: error.message };
  }

  return { 
    companions: (data || []).map(d => ({
      id: d.companion_id,
      name: d.companion?.name || 'Companion',
      email: d.companion?.email,
    })),
    error: null 
  };
}

/**
 * Record a notification that was sent
 */
export async function recordNotification(notification) {
  const { data, error } = await supabase
    .from('notification_history')
    .insert({
      patient_id: notification.patientId,
      companion_id: notification.companionId,
      medication_id: notification.medicationId,
      type: notification.type,
      channel: notification.channel,
      recipient_email: notification.recipientEmail,
      message: notification.message,
      scheduled_time: notification.scheduledTime,
      sent_at: new Date().toISOString(),
      status: notification.status,
    })
    .select()
    .single();

  if (error) {
    console.error('[Supabase] Error recording notification:', error);
    return { notification: null, error: error.message };
  }

  return { notification: data, error: null };
}

/**
 * Check if a notification was already sent for this medication today
 */
export async function wasNotificationAlreadySent(medicationId, companionId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from('notification_history')
    .select('id')
    .eq('medication_id', medicationId)
    .eq('companion_id', companionId)
    .eq('type', 'missed_medication')
    .gte('sent_at', startOfDay.toISOString())
    .lte('sent_at', endOfDay.toISOString())
    .limit(1);

  if (error) {
    console.error('[Supabase] Error checking notification history:', error);
    return false;
  }

  return data && data.length > 0;
}

/**
 * Get notification statistics
 */
export async function getNotificationStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { data: todayCount, error: error1 } = await supabase
    .from('notification_history')
    .select('id', { count: 'exact', head: true })
    .gte('sent_at', today.toISOString());

  const { data: totalCount, error: error2 } = await supabase
    .from('notification_history')
    .select('id', { count: 'exact', head: true });

  return {
    today: todayCount || 0,
    total: totalCount || 0,
    error: error1 || error2 ? 'Failed to get stats' : null,
  };
}

