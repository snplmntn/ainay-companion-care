import { supabase } from "@/lib/supabase";
import type {
  Profile,
  Medication,
  InsertMedication,
  UpdateMedication,
  ScheduleDose,
  InsertScheduleDose,
} from "@/types/database";
import type { User, Session } from "@supabase/supabase-js";
import type { LinkedPatient, LinkedCompanion, LinkStatus } from "@/types";

// ============ AUTH FUNCTIONS ============

export interface AuthResult {
  user: User | null;
  session: Session | null;
  error: string | null;
}

/**
 * Sign up with email and password
 */
export async function signUp(
  email: string,
  password: string,
  name: string,
  role: "patient" | "companion"
): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name,
        role,
      },
    },
  });

  if (error) {
    return { user: null, session: null, error: error.message };
  }

  // Create profile after signup
  if (data.user) {
    const { error: profileError } = await supabase.from("profiles").insert({
      id: data.user.id,
      email: data.user.email!,
      name,
      role,
    });

    if (profileError) {
      console.error("Error creating profile:", profileError);
    }
  }

  return { user: data.user, session: data.session, error: null };
}

/**
 * Sign in with email and password
 */
export async function signIn(
  email: string,
  password: string
): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { user: null, session: null, error: error.message };
  }

  return { user: data.user, session: data.session, error: null };
}

/**
 * Sign out
 */
export async function signOut(): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signOut();
  return { error: error?.message ?? null };
}

/**
 * Get current session
 */
export async function getSession(): Promise<{
  session: Session | null;
  error: string | null;
}> {
  const { data, error } = await supabase.auth.getSession();
  return { session: data.session, error: error?.message ?? null };
}

/**
 * Get current user
 */
export async function getCurrentUser(): Promise<{
  user: User | null;
  error: string | null;
}> {
  const { data, error } = await supabase.auth.getUser();
  return { user: data.user, error: error?.message ?? null };
}

/**
 * Listen to auth state changes
 */
export function onAuthStateChange(
  callback: (user: User | null, session: Session | null) => void
) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user ?? null, session);
  });
}

// ============ PROFILE FUNCTIONS ============

/**
 * Get user profile
 */
export async function getProfile(
  userId: string
): Promise<{ profile: Profile | null; error: string | null }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  return { profile: data, error: error?.message ?? null };
}

/**
 * Update user profile
 */
export async function updateProfile(
  userId: string,
  updates: {
    name?: string;
    role?: "patient" | "companion";
    email_reminder_enabled?: boolean;
    email_reminder_minutes?: number;
  }
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("profiles")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", userId);

  return { error: error?.message ?? null };
}

/**
 * Get user's link code (for patients to share with companions)
 */
export async function getLinkCode(
  userId: string
): Promise<{ linkCode: string | null; error: string | null }> {
  const { data, error } = await supabase
    .from("profiles")
    .select("link_code")
    .eq("id", userId)
    .single();

  return { linkCode: data?.link_code ?? null, error: error?.message ?? null };
}

/**
 * Find patient by link code (uses RPC to bypass RLS)
 */
export async function findPatientByLinkCode(linkCode: string): Promise<{
  patient: Pick<Profile, "id" | "name" | "email"> | null;
  error: string | null;
}> {
  const { data, error } = await supabase
    .rpc("find_patient_by_link_code", { p_link_code: linkCode.toUpperCase() })
    .single();

  if (error || !data) {
    return { patient: null, error: error?.message ?? "Patient not found" };
  }

  return {
    patient: {
      id: data.patient_id,
      name: data.patient_name,
      email: data.patient_email,
    } as Pick<Profile, "id" | "name" | "email">,
    error: null,
  };
}

// ============ MEDICATION FUNCTIONS ============

/**
 * Get all medications for a user
 */
export async function getMedications(
  userId: string
): Promise<{ medications: Medication[]; error: string | null }> {
  const { data, error } = await supabase
    .from("medications")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("time", { ascending: true });

  return { medications: data ?? [], error: error?.message ?? null };
}

/**
 * Get medications with their scheduled doses
 */
export async function getMedicationsWithDoses(userId: string): Promise<{
  medications: (Medication & { doses: ScheduleDose[] })[];
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("medications")
    .select(
      `
      *,
      doses:schedule_doses(*)
    `
    )
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("time", { ascending: true });

  return { medications: data ?? [], error: error?.message ?? null };
}

/**
 * Add a new medication
 */
export async function addMedication(
  medication: InsertMedication
): Promise<{ medication: Medication | null; error: string | null }> {
  const { data, error } = await supabase
    .from("medications")
    .insert(medication)
    .select()
    .single();

  return { medication: data, error: error?.message ?? null };
}

/**
 * Add medication with computed doses
 */
export async function addMedicationWithDoses(
  medication: InsertMedication,
  doses: InsertScheduleDose[]
): Promise<{ medication: Medication | null; error: string | null }> {
  // First insert the medication
  const { data: medData, error: medError } = await supabase
    .from("medications")
    .insert(medication)
    .select()
    .single();

  if (medError || !medData) {
    return {
      medication: null,
      error: medError?.message ?? "Failed to create medication",
    };
  }

  // Then insert the doses
  if (doses.length > 0) {
    const dosesWithMedId = doses.map((dose) => ({
      ...dose,
      medication_id: medData.id,
    }));

    const { error: doseError } = await supabase
      .from("schedule_doses")
      .insert(dosesWithMedId);

    if (doseError) {
      console.error("Error creating doses:", doseError);
    }
  }

  return { medication: medData, error: null };
}

/**
 * Update a medication
 */
export async function updateMedication(
  medicationId: string,
  updates: UpdateMedication
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("medications")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", medicationId);

  return { error: error?.message ?? null };
}

/**
 * Update medication with new doses (replaces existing doses)
 */
export async function updateMedicationWithDoses(
  medicationId: string,
  updates: UpdateMedication,
  doses: InsertScheduleDose[]
): Promise<{ error: string | null }> {
  // Update the medication
  const { error: medError } = await supabase
    .from("medications")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", medicationId);

  if (medError) {
    return { error: medError.message };
  }

  // Delete existing doses for this medication
  const { error: deleteError } = await supabase
    .from("schedule_doses")
    .delete()
    .eq("medication_id", medicationId);

  if (deleteError) {
    console.error("Error deleting old doses:", deleteError);
  }

  // Insert new doses
  if (doses.length > 0) {
    const dosesWithMedId = doses.map((dose) => ({
      ...dose,
      medication_id: medicationId,
    }));

    const { error: doseError } = await supabase
      .from("schedule_doses")
      .insert(dosesWithMedId);

    if (doseError) {
      console.error("Error creating new doses:", doseError);
      return { error: doseError.message };
    }
  }

  return { error: null };
}

/**
 * Toggle medication taken status
 */
export async function toggleMedicationTaken(
  medicationId: string,
  taken: boolean
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("medications")
    .update({
      taken,
      taken_at: taken ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", medicationId);

  return { error: error?.message ?? null };
}

/**
 * Toggle individual dose taken status
 */
export async function toggleDoseTaken(
  doseId: string,
  taken: boolean
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("schedule_doses")
    .update({
      taken,
      taken_at: taken ? new Date().toISOString() : null,
    })
    .eq("id", doseId);

  return { error: error?.message ?? null };
}

/**
 * Delete a medication
 */
export async function deleteMedication(
  medicationId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("medications")
    .delete()
    .eq("id", medicationId);

  return { error: error?.message ?? null };
}

/**
 * Soft delete (deactivate) a medication
 */
export async function deactivateMedication(
  medicationId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("medications")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", medicationId);

  return { error: error?.message ?? null };
}

/**
 * Reset all medications to not taken (for daily reset)
 */
export async function resetDailyMedications(
  userId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("medications")
    .update({ taken: false, taken_at: null })
    .eq("user_id", userId);

  return { error: error?.message ?? null };
}

/**
 * Reset all doses for a user's medications
 */
export async function resetDailyDoses(
  userId: string
): Promise<{ error: string | null }> {
  // Get user's medication IDs
  const { data: meds } = await supabase
    .from("medications")
    .select("id")
    .eq("user_id", userId);

  if (!meds || meds.length === 0) {
    return { error: null };
  }

  const medIds = meds.map((m) => m.id);

  const { error } = await supabase
    .from("schedule_doses")
    .update({ taken: false, taken_at: null })
    .in("medication_id", medIds);

  return { error: error?.message ?? null };
}

// ============ AUTO-EXPIRATION FUNCTIONS ============

/**
 * Auto-expire medications that have passed their end_date
 * Returns the count of expired medications and their names
 */
export async function autoExpireMedications(userId: string): Promise<{
  expiredCount: number;
  expiredNames: string[];
  error: string | null;
}> {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  // Find active medications that have expired (end_date < today)
  // Note: NULL end_date values won't match the < comparison (SQL NULL comparisons return NULL)
  const { data: expiredMeds, error: fetchError } = await supabase
    .from("medications")
    .select("id, name, end_date")
    .eq("user_id", userId)
    .eq("is_active", true)
    .lt("end_date", today);

  if (fetchError) {
    return { expiredCount: 0, expiredNames: [], error: fetchError.message };
  }

  if (!expiredMeds || expiredMeds.length === 0) {
    return { expiredCount: 0, expiredNames: [], error: null };
  }

  const expiredIds = expiredMeds.map((m) => m.id);
  const expiredNames = expiredMeds.map((m) => m.name);

  // Mark them as inactive
  const { error: updateError } = await supabase
    .from("medications")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .in("id", expiredIds);

  if (updateError) {
    return { expiredCount: 0, expiredNames: [], error: updateError.message };
  }

  return { expiredCount: expiredMeds.length, expiredNames, error: null };
}

/**
 * Get medications that are expiring soon (within threshold days)
 */
export async function getExpiringMedications(
  userId: string,
  thresholdDays: number = 3
): Promise<{
  medications: Array<{
    id: string;
    name: string;
    endDate: string;
    daysRemaining: number;
  }>;
  error: string | null;
}> {
  const today = new Date();
  const threshold = new Date(today);
  threshold.setDate(threshold.getDate() + thresholdDays);

  const todayStr = today.toISOString().split("T")[0];
  const thresholdStr = threshold.toISOString().split("T")[0];

  // Note: NULL end_date values won't match range comparisons (SQL NULL comparisons return NULL)
  const { data, error } = await supabase
    .from("medications")
    .select("id, name, end_date")
    .eq("user_id", userId)
    .eq("is_active", true)
    .gte("end_date", todayStr) // Not yet expired
    .lte("end_date", thresholdStr); // Within threshold

  if (error) {
    return { medications: [], error: error.message };
  }

  const medications = (data ?? []).map((m) => {
    const endDate = new Date(m.end_date);
    const diffTime = endDate.getTime() - today.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
      id: m.id,
      name: m.name,
      endDate: m.end_date,
      daysRemaining: Math.max(0, daysRemaining),
    };
  });

  return { medications, error: null };
}

/**
 * Check and auto-expire medications, returning info about what was expired
 * This is the main function to call on app load
 */
export async function checkAndAutoExpire(userId: string): Promise<{
  expired: { count: number; names: string[] };
  expiringSoon: Array<{ name: string; daysRemaining: number }>;
  error: string | null;
}> {
  // Auto-expire past-due medications
  const {
    expiredCount,
    expiredNames,
    error: expireError,
  } = await autoExpireMedications(userId);

  if (expireError) {
    return {
      expired: { count: 0, names: [] },
      expiringSoon: [],
      error: expireError,
    };
  }

  // Get medications expiring soon (within 3 days)
  const { medications: expiring, error: expiringError } =
    await getExpiringMedications(userId, 3);

  if (expiringError) {
    return {
      expired: { count: expiredCount, names: expiredNames },
      expiringSoon: [],
      error: expiringError,
    };
  }

  return {
    expired: { count: expiredCount, names: expiredNames },
    expiringSoon: expiring.map((m) => ({
      name: m.name,
      daysRemaining: m.daysRemaining,
    })),
    error: null,
  };
}

// ============ COMPANION LINKING FUNCTIONS ============

/**
 * Link companion to a patient (immediate - no approval needed)
 */
export async function requestPatientLink(
  companionId: string,
  patientLinkCode: string
): Promise<{
  linkId: string | null;
  patientName: string | null;
  error: string | null;
}> {
  // Validate link code format
  const cleanCode = patientLinkCode.trim().toUpperCase();
  if (!cleanCode || cleanCode.length !== 6) {
    return {
      linkId: null,
      patientName: null,
      error: "Please enter a valid 6-character link code.",
    };
  }

  // Find the patient by link code
  const { patient, error: findError } = await findPatientByLinkCode(cleanCode);

  if (findError || !patient) {
    return {
      linkId: null,
      patientName: null,
      error: "Invalid link code. Please check with the patient and try again.",
    };
  }

  // Check if already linked
  const { data: existingLink } = await supabase
    .from("patient_companions")
    .select("*")
    .eq("patient_id", patient.id)
    .eq("companion_id", companionId)
    .single();

  if (existingLink) {
    if (existingLink.status === "accepted") {
      return {
        linkId: existingLink.id,
        patientName: patient.name,
        error: `You're already linked with ${patient.name}. Check your patient list.`,
      };
    }
    // If rejected previously, update to accepted
    if (existingLink.status === "rejected") {
      const { error: updateError } = await supabase
        .from("patient_companions")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
        })
        .eq("id", existingLink.id);

      if (updateError) {
        return {
          linkId: null,
          patientName: null,
          error: "Failed to restore link. Please try again.",
        };
      }

      return {
        linkId: existingLink.id,
        patientName: patient.name,
        error: null,
      };
    }
  }

  // Create link immediately as accepted (no approval needed)
  const { data, error } = await supabase
    .from("patient_companions")
    .insert({
      patient_id: patient.id,
      companion_id: companionId,
      status: "accepted",
      accepted_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    // Handle unique constraint violation gracefully
    if (error.code === "23505") {
      return {
        linkId: null,
        patientName: patient.name,
        error: `You're already linked with ${patient.name}.`,
      };
    }
    console.error("Link creation error:", error);
    return {
      linkId: null,
      patientName: null,
      error: "Unable to create link. Please try again.",
    };
  }

  return { linkId: data?.id ?? null, patientName: patient.name, error: null };
}

// Note: Accept/Reject functions kept for backwards compatibility but no longer used
// Links are now created as "accepted" immediately

/**
 * Accept a companion link request (patient accepts)
 * @deprecated Links are now auto-accepted
 */
export async function acceptCompanionLink(
  linkId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("patient_companions")
    .update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
    })
    .eq("id", linkId);

  return { error: error?.message ?? null };
}

/**
 * Reject a companion link request
 * @deprecated Links are now auto-accepted
 */
export async function rejectCompanionLink(
  linkId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("patient_companions")
    .update({ status: "rejected" })
    .eq("id", linkId);

  return { error: error?.message ?? null };
}

/**
 * Remove a patient-companion link
 */
export async function removeLink(
  linkId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("patient_companions")
    .delete()
    .eq("id", linkId);

  return { error: error?.message ?? null };
}

/**
 * Get pending link requests for a patient
 * @deprecated Links are now auto-accepted, no pending requests
 */
export async function getPendingLinkRequests(patientId: string): Promise<{
  requests: Array<{
    id: string;
    companionId: string;
    companionName: string;
    companionEmail: string;
    createdAt: string;
  }>;
  error: string | null;
}> {
  // No longer used - links are auto-accepted
  return { requests: [], error: null };
}

/**
 * Get linked companions for a patient
 */
export async function getLinkedCompanions(
  patientId: string
): Promise<{ companions: LinkedCompanion[]; error: string | null }> {
  // First, get the link records
  const { data: links, error: linksError } = await supabase
    .from("patient_companions")
    .select("id, status, companion_id")
    .eq("patient_id", patientId)
    .eq("status", "accepted");

  if (linksError) {
    return { companions: [], error: linksError.message };
  }

  const linksArray = (links || []) as Array<{
    id: string;
    status: string;
    companion_id: string;
  }>;

  if (linksArray.length === 0) {
    return { companions: [], error: null };
  }

  // Get companion profiles separately
  const companionIds = linksArray.map((l) => l.companion_id);
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, name, email")
    .in("id", companionIds);

  if (profilesError) {
    return { companions: [], error: profilesError.message };
  }

  // Create a map for quick profile lookup
  const profilesArray = (profiles || []) as Array<{
    id: string;
    name: string;
    email: string;
  }>;
  const profileMap = new Map(profilesArray.map((p) => [p.id, p]));

  const companions: LinkedCompanion[] = linksArray.map((link) => {
    const profile = profileMap.get(link.companion_id);
    // Get the name, falling back to email username or "Caregiver" if empty/missing
    let displayName = profile?.name;
    if (!displayName || displayName.trim() === "" || displayName === "User") {
      // Try to extract name from email (before @)
      if (profile?.email) {
        const emailName = profile.email.split("@")[0];
        // Capitalize first letter
        displayName = emailName.charAt(0).toUpperCase() + emailName.slice(1);
      } else {
        displayName = "Caregiver";
      }
    }

    return {
      id: profile?.id ?? link.companion_id,
      name: displayName,
      email: profile?.email ?? "",
      linkId: link.id,
      linkStatus: link.status as LinkStatus,
    };
  });

  return { companions, error: null };
}

/**
 * Get linked patients for a companion (with their medications)
 * OPTIMIZED: Uses batch query instead of N+1 pattern
 */
export async function getLinkedPatients(
  companionId: string
): Promise<{ patients: LinkedPatient[]; error: string | null }> {
  // First, get the link records
  const { data: links, error: linksError } = await supabase
    .from("patient_companions")
    .select("id, status, accepted_at, patient_id")
    .eq("companion_id", companionId)
    .eq("status", "accepted"); // Only accepted links (auto-accepted on creation)

  if (linksError) {
    return { patients: [], error: linksError.message };
  }

  const linksArray = (links || []) as Array<{
    id: string;
    status: string;
    accepted_at: string | null;
    patient_id: string;
  }>;

  if (linksArray.length === 0) {
    return { patients: [], error: null };
  }

  // Get patient IDs from links
  const patientIds = linksArray.map((l) => l.patient_id);

  // Batch fetch patient profiles
  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, name, email")
    .in("id", patientIds);

  if (profilesError) {
    console.error("Error fetching patient profiles:", profilesError);
    // Continue without profiles - we'll use fallback values
  }

  // Create a map for quick profile lookup
  const profilesArray = (profiles || []) as Array<{
    id: string;
    name: string;
    email: string;
  }>;
  const profileMap = new Map(profilesArray.map((p) => [p.id, p]));

  // OPTIMIZATION: Batch fetch all medications for all patients in ONE query
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let allMedications: any[] = [];
  if (patientIds.length > 0) {
    const { data: medsData, error: medsError } = await supabase
      .from("medications")
      .select("*")
      .in("user_id", patientIds)
      .eq("is_active", true)
      .order("time", { ascending: true });

    if (!medsError && medsData) {
      allMedications = medsData;
    }
  }

  // Group medications by patient ID for O(1) lookup
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const medicationsByPatient = new Map<string, any[]>();
  for (const med of allMedications) {
    const patientMeds = medicationsByPatient.get(med.user_id) || [];
    patientMeds.push(med);
    medicationsByPatient.set(med.user_id, patientMeds);
  }

  // Build patient list with pre-fetched medications (no additional queries)
  const patients: LinkedPatient[] = linksArray.map((link) => {
    const patientId = link.patient_id;
    const profile = profileMap.get(patientId);
    const medications = medicationsByPatient.get(patientId) || [];

    // Calculate adherence rate
    const totalMeds = medications.length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const takenMeds = medications.filter((m: any) => m.taken).length;
    const adherenceRate =
      totalMeds > 0 ? Math.round((takenMeds / totalMeds) * 100) : 0;

    // Get last activity
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lastMed = medications.reduce((latest: any, m: any) => {
      if (!latest) return m;
      return new Date(m.updated_at) > new Date(latest.updated_at) ? m : latest;
    }, null);
    const lastActivity = lastMed?.updated_at;

    // Get the name, falling back to email username or "Patient" if empty/missing
    let displayName = profile?.name;
    if (!displayName || displayName.trim() === "" || displayName === "User") {
      // Try to extract name from email (before @)
      if (profile?.email) {
        const emailName = profile.email.split("@")[0];
        // Capitalize first letter
        displayName = emailName.charAt(0).toUpperCase() + emailName.slice(1);
      } else {
        displayName = "Patient";
      }
    }

    return {
      id: patientId,
      name: displayName,
      email: profile?.email ?? "",
      linkId: link.id,
      linkStatus: link.status as LinkStatus,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      medications: medications as any, // DB type is compatible with app type
      adherenceRate,
      lastActivity,
    };
  });

  return { patients, error: null };
}

/**
 * Get patient medications for companion view
 */
export async function getPatientMedicationsForCompanion(
  patientId: string,
  companionId: string
): Promise<{ medications: Medication[]; error: string | null }> {
  // Verify the link exists and is accepted
  const { data: link } = await supabase
    .from("patient_companions")
    .select("status")
    .eq("patient_id", patientId)
    .eq("companion_id", companionId)
    .eq("status", "accepted")
    .single();

  if (!link) {
    return {
      medications: [],
      error: "Not authorized to view this patient's medications",
    };
  }

  return getMedications(patientId);
}
