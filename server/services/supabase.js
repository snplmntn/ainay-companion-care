// ============================================
// Supabase Service for Server-Side Operations
// Uses separate queries to avoid foreign key relationship issues
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
 * Uses two queries to fetch medications and their associated user profiles
 */
export async function getMedicationsToCheck() {
  // Step 1: Fetch active, untaken medications
  const { data: medications, error: medError } = await supabase
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
      updated_at
    `)
    .eq('is_active', true)
    .eq('taken', false);

  if (medError) {
    console.error('[Supabase] Error fetching medications:', medError);
    return { medications: [], error: medError.message };
  }

  if (!medications || medications.length === 0) {
    return { medications: [], error: null };
  }

  // Step 2: Fetch user profiles for these medications
  const userIds = [...new Set(medications.map(m => m.user_id))];
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, name, email')
    .in('id', userIds);

  if (profileError) {
    console.error('[Supabase] Error fetching profiles:', profileError);
    // Return medications without user info rather than failing entirely
    return { 
      medications: medications.map(m => ({ ...m, user: null })), 
      error: null 
    };
  }

  // Step 3: Map profiles to medications
  const profileMap = new Map((profiles || []).map(p => [p.id, p]));
  const medicationsWithUsers = medications.map(med => ({
    ...med,
    user: profileMap.get(med.user_id) || null,
  }));

  return { medications: medicationsWithUsers, error: null };
}

/**
 * Get companions linked to a patient
 */
export async function getLinkedCompanions(patientId) {
  // Step 1: Fetch companion links
  const { data: links, error } = await supabase
    .from('patient_companions')
    .select('id, companion_id')
    .eq('patient_id', patientId)
    .eq('status', 'accepted');

  if (error) {
    console.error('[Supabase] Error fetching companion links:', error);
    return { companions: [], error: error.message };
  }

  if (!links || links.length === 0) {
    return { companions: [], error: null };
  }

  // Step 2: Fetch companion profiles
  const companionIds = links.map(l => l.companion_id);
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, name, email')
    .in('id', companionIds);

  if (profileError) {
    console.error('[Supabase] Error fetching companion profiles:', profileError);
    // Return companions without profile info rather than failing entirely
    return { 
      companions: links.map(link => ({
        id: link.companion_id,
        name: 'Companion',
        email: null,
      })), 
      error: null 
    };
  }

  // Step 3: Map profiles to companions
  const profileMap = new Map((profiles || []).map(p => [p.id, p]));
  const companions = links.map(link => {
    const profile = profileMap.get(link.companion_id);
    return {
      id: profile?.id || link.companion_id,
      name: profile?.name || 'Companion',
      email: profile?.email,
    };
  });

  return { companions, error: null };
}

/**
 * Get all linked companions for multiple patients at once
 * OPTIMIZATION: Batch fetch companions for multiple patients in two queries
 */
export async function getLinkedCompanionsForPatients(patientIds) {
  if (!patientIds || patientIds.length === 0) {
    return { companionsByPatient: new Map(), error: null };
  }

  // Step 1: Fetch companion links for all patients
  const { data: links, error } = await supabase
    .from('patient_companions')
    .select('id, patient_id, companion_id')
    .in('patient_id', patientIds)
    .eq('status', 'accepted');

  if (error) {
    console.error('[Supabase] Error fetching companion links:', error);
    return { companionsByPatient: new Map(), error: error.message };
  }

  if (!links || links.length === 0) {
    return { companionsByPatient: new Map(), error: null };
  }

  // Step 2: Fetch companion profiles
  const companionIds = [...new Set(links.map(l => l.companion_id))];
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, name, email')
    .in('id', companionIds);

  if (profileError) {
    console.error('[Supabase] Error fetching companion profiles:', profileError);
  }

  const profileMap = new Map((profiles || []).map(p => [p.id, p]));

  // Step 3: Group companions by patient ID with profile info
  const companionsByPatient = new Map();
  for (const link of links) {
    const patientCompanions = companionsByPatient.get(link.patient_id) || [];
    const profile = profileMap.get(link.companion_id);
    patientCompanions.push({
      id: profile?.id || link.companion_id,
      name: profile?.name || 'Companion',
      email: profile?.email,
    });
    companionsByPatient.set(link.patient_id, patientCompanions);
  }

  return { companionsByPatient, error: null };
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
 * Record multiple notifications in batch
 * OPTIMIZATION: Batch insert instead of multiple single inserts
 */
export async function recordNotificationsBatch(notifications) {
  if (!notifications || notifications.length === 0) {
    return { notifications: [], error: null };
  }

  const records = notifications.map(n => ({
    patient_id: n.patientId,
    companion_id: n.companionId,
    medication_id: n.medicationId,
    type: n.type,
    channel: n.channel,
    recipient_email: n.recipientEmail,
    message: n.message,
    scheduled_time: n.scheduledTime,
    sent_at: new Date().toISOString(),
    status: n.status,
  }));

  const { data, error } = await supabase
    .from('notification_history')
    .insert(records)
    .select();

  if (error) {
    console.error('[Supabase] Error recording notifications batch:', error);
    return { notifications: [], error: error.message };
  }

  return { notifications: data || [], error: null };
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
 * Check notifications sent today for multiple medication-companion pairs
 * OPTIMIZATION: Batch check instead of individual queries
 * Now tracks different notification types: push_first, push_second, email
 */
export async function getNotificationsSentToday(medicationIds, date) {
  if (!medicationIds || medicationIds.length === 0) {
    return { sentPairs: new Set(), error: null };
  }

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from('notification_history')
    .select('medication_id, companion_id, type')
    .in('medication_id', medicationIds)
    .in('type', ['missed_medication', 'missed_medication_push_first', 'missed_medication_push_second', 'missed_medication_telegram', 'missed_medication_email'])
    .gte('sent_at', startOfDay.toISOString())
    .lte('sent_at', endOfDay.toISOString());

  if (error) {
    console.error('[Supabase] Error checking notification history:', error);
    return { sentPairs: new Set(), error: error.message };
  }

  // Create a Set of "medicationId|companionId|type" pairs for O(1) lookup
  // This allows tracking each notification tier separately
  const sentPairs = new Set();
  for (const d of (data || [])) {
    // Add the specific type
    if (d.type === 'missed_medication_push_first') {
      sentPairs.add(`${d.medication_id}|${d.companion_id}|push_first`);
    } else if (d.type === 'missed_medication_push_second') {
      sentPairs.add(`${d.medication_id}|${d.companion_id}|push_second`);
    } else if (d.type === 'missed_medication_telegram') {
      sentPairs.add(`${d.medication_id}|${d.companion_id}|telegram`);
    } else if (d.type === 'missed_medication_email' || d.type === 'missed_medication') {
      sentPairs.add(`${d.medication_id}|${d.companion_id}|email`);
    }
  }

  return { sentPairs, error: null };
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

// ============================================
// AUTO-EXPIRATION FUNCTIONS
// ============================================

/**
 * Auto-expire all medications that have passed their end_date
 * This is called by a daily cron job
 */
export async function autoExpireAllMedications() {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  
  // Step 1: Find all active medications that have expired (end_date < today)
  const { data: expiredMeds, error: fetchError } = await supabase
    .from('medications')
    .select(`
      id, 
      name, 
      end_date,
      user_id
    `)
    .eq('is_active', true)
    .not('end_date', 'is', null)
    .lt('end_date', today);

  if (fetchError) {
    console.error('[AutoExpire] Error fetching expired medications:', fetchError);
    return { 
      expiredCount: 0, 
      expiredMedications: [],
      error: fetchError.message 
    };
  }

  if (!expiredMeds || expiredMeds.length === 0) {
    return { expiredCount: 0, expiredMedications: [], error: null };
  }

  // Step 2: Fetch user profiles for expired medications
  const userIds = [...new Set(expiredMeds.map(m => m.user_id))];
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, name, email')
    .in('id', userIds);

  if (profileError) {
    console.error('[AutoExpire] Error fetching profiles:', profileError);
  }

  const profileMap = new Map((profiles || []).map(p => [p.id, p]));

  const expiredIds = expiredMeds.map((m) => m.id);

  // Step 3: Mark them as inactive
  const { error: updateError } = await supabase
    .from('medications')
    .update({ 
      is_active: false, 
      updated_at: new Date().toISOString() 
    })
    .in('id', expiredIds);

  if (updateError) {
    console.error('[AutoExpire] Error updating medications:', updateError);
    return { expiredCount: 0, expiredMedications: [], error: updateError.message };
  }

  console.log(`[AutoExpire] Deactivated ${expiredMeds.length} expired medication(s)`);
  
  return { 
    expiredCount: expiredMeds.length, 
    expiredMedications: expiredMeds.map(m => {
      const profile = profileMap.get(m.user_id);
      return {
        id: m.id,
        name: m.name,
        endDate: m.end_date,
        userId: m.user_id,
        userName: profile?.name || 'Unknown',
        userEmail: profile?.email,
      };
    }),
    error: null 
  };
}

/**
 * Get patients with email reminders enabled and their upcoming medications
 * Used to send medication reminders before scheduled time
 */
export async function getPatientsWithUpcomingMedications(minutesBefore = 5) {
  const now = new Date();
  
  // Step 1: Get all patients with reminders enabled (email OR telegram)
  // We fetch all patients with role=patient and filter later for those who have
  // email_reminder_enabled=true OR telegram_chat_id set
  const { data: patients, error: patientError } = await supabase
    .from('profiles')
    .select('id, name, email, email_reminder_enabled, email_reminder_minutes, telegram_chat_id')
    .eq('role', 'patient')
    .or('email_reminder_enabled.eq.true,telegram_chat_id.not.is.null');

  if (patientError) {
    console.error('[Supabase] Error fetching patients:', patientError);
    return { patients: [], error: patientError.message };
  }

  if (!patients || patients.length === 0) {
    return { patients: [], error: null };
  }

  // Step 2: Get active medications for these patients
  const patientIds = patients.map(p => p.id);
  const { data: medications, error: medError } = await supabase
    .from('medications')
    .select(`
      id,
      user_id,
      name,
      dosage,
      time,
      start_time,
      taken,
      is_active
    `)
    .in('user_id', patientIds)
    .eq('is_active', true)
    .eq('taken', false);

  if (medError) {
    console.error('[Supabase] Error fetching medications:', medError);
    return { patients: [], error: medError.message };
  }

  // Step 3: Also get scheduled doses for multi-dose medications
  const medIds = (medications || []).map(m => m.id);
  let doses = [];
  if (medIds.length > 0) {
    const { data: dosesData, error: dosesError } = await supabase
      .from('schedule_doses')
      .select('id, medication_id, time, label, taken')
      .in('medication_id', medIds)
      .eq('taken', false);
    
    if (!dosesError && dosesData) {
      doses = dosesData;
    }
  }

  // Step 4: Map medications to patients
  const patientMap = new Map(patients.map(p => [p.id, { ...p, medications: [] }]));
  
  for (const med of (medications || [])) {
    const patient = patientMap.get(med.user_id);
    if (patient) {
      // Get doses for this medication
      const medDoses = doses.filter(d => d.medication_id === med.id);
      patient.medications.push({
        ...med,
        doses: medDoses,
      });
    }
  }

  return { patients: Array.from(patientMap.values()), error: null };
}

/**
 * Check if a reminder was already sent for this medication/dose today
 */
export async function getRemindersSentToday(medicationIds, date) {
  if (!medicationIds || medicationIds.length === 0) {
    return { sentSet: new Set(), error: null };
  }

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from('notification_history')
    .select('medication_id')
    .in('medication_id', medicationIds)
    .eq('type', 'medication_reminder')
    .gte('sent_at', startOfDay.toISOString())
    .lte('sent_at', endOfDay.toISOString());

  if (error) {
    console.error('[Supabase] Error checking reminder history:', error);
    return { sentSet: new Set(), error: error.message };
  }

  // Create a Set of medication IDs that have been reminded today
  const sentSet = new Set((data || []).map(d => d.medication_id));

  return { sentSet, error: null };
}

/**
 * Record a medication reminder notification
 */
export async function recordReminderNotification(notification) {
  const { data, error } = await supabase
    .from('notification_history')
    .insert({
      patient_id: notification.patientId,
      companion_id: notification.patientId, // Self-reminder, use patient as companion
      medication_id: notification.medicationId,
      type: 'medication_reminder',
      channel: 'email',
      recipient_email: notification.recipientEmail,
      message: notification.message,
      scheduled_time: notification.scheduledTime,
      sent_at: new Date().toISOString(),
      status: notification.status,
    })
    .select()
    .single();

  if (error) {
    console.error('[Supabase] Error recording reminder:', error);
    return { notification: null, error: error.message };
  }

  return { notification: data, error: null };
}

/**
 * Get medications expiring within threshold days for all users
 * Used to send advance warnings
 */
export async function getAllExpiringMedications(thresholdDays = 3) {
  const today = new Date();
  const threshold = new Date(today);
  threshold.setDate(threshold.getDate() + thresholdDays);
  
  const todayStr = today.toISOString().split("T")[0];
  const thresholdStr = threshold.toISOString().split("T")[0];
  
  // Step 1: Fetch expiring medications
  const { data, error } = await supabase
    .from('medications')
    .select(`
      id, 
      name, 
      end_date,
      user_id
    `)
    .eq('is_active', true)
    .not('end_date', 'is', null)
    .gte('end_date', todayStr)  // Not yet expired
    .lte('end_date', thresholdStr); // Within threshold

  if (error) {
    console.error('[AutoExpire] Error fetching expiring medications:', error);
    return { medications: [], error: error.message };
  }

  if (!data || data.length === 0) {
    return { medications: [], error: null };
  }

  // Step 2: Fetch user profiles
  const userIds = [...new Set(data.map(m => m.user_id))];
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, name, email')
    .in('id', userIds);

  if (profileError) {
    console.error('[AutoExpire] Error fetching profiles:', profileError);
  }

  const profileMap = new Map((profiles || []).map(p => [p.id, p]));

  // Step 3: Map profiles to medications
  const medications = data.map((m) => {
    const endDate = new Date(m.end_date);
    const diffTime = endDate.getTime() - today.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const profile = profileMap.get(m.user_id);
    
    return {
      id: m.id,
      name: m.name,
      endDate: m.end_date,
      daysRemaining: Math.max(0, daysRemaining),
      userId: m.user_id,
      userName: profile?.name || 'Unknown',
      userEmail: profile?.email,
    };
  });

  return { medications, error: null };
}