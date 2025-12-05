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
  updates: { name?: string; role?: "patient" | "companion" }
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
export async function findPatientByLinkCode(
  linkCode: string
): Promise<{ patient: Pick<Profile, 'id' | 'name' | 'email'> | null; error: string | null }> {
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
    } as Pick<Profile, 'id' | 'name' | 'email'>,
    error: null 
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
        return { linkId: null, patientName: null, error: "Failed to restore link. Please try again." };
      }

      return { linkId: existingLink.id, patientName: patient.name, error: null };
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
    return { linkId: null, patientName: null, error: "Unable to create link. Please try again." };
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
  const { data, error } = await supabase
    .from("patient_companions")
    .select(
      `
      id,
      status,
      companion:profiles!patient_companions_companion_id_fkey(id, name, email)
    `
    )
    .eq("patient_id", patientId)
    .eq("status", "accepted");

  if (error) {
    return { companions: [], error: error.message };
  }

  const companions: LinkedCompanion[] = (data ?? []).map((r: any) => ({
    id: r.companion?.id ?? "",
    name: r.companion?.name ?? "Unknown",
    email: r.companion?.email ?? "",
    linkId: r.id,
    linkStatus: r.status as LinkStatus,
  }));

  return { companions, error: null };
}

/**
 * Get linked patients for a companion (with their medications)
 */
export async function getLinkedPatients(
  companionId: string
): Promise<{ patients: LinkedPatient[]; error: string | null }> {
  const { data, error } = await supabase
    .from("patient_companions")
    .select(
      `
      id,
      status,
      accepted_at,
      patient:profiles!patient_companions_patient_id_fkey(id, name, email)
    `
    )
    .eq("companion_id", companionId)
    .eq("status", "accepted"); // Only accepted links (auto-accepted on creation)

  if (error) {
    return { patients: [], error: error.message };
  }

  // Fetch medications for each accepted patient
  const patients: LinkedPatient[] = await Promise.all(
    (data ?? []).map(async (r: any) => {
      let medications: any[] = [];
      let adherenceRate = 0;
      let lastActivity: string | undefined;

      if (r.status === "accepted" && r.patient?.id) {
        const { medications: meds } = await getMedications(r.patient.id);
        medications = meds;

        // Calculate adherence rate
        const totalMeds = medications.length;
        const takenMeds = medications.filter((m) => m.taken).length;
        adherenceRate =
          totalMeds > 0 ? Math.round((takenMeds / totalMeds) * 100) : 0;

        // Get last activity
        const lastMed = medications.reduce((latest, m) => {
          if (!latest) return m;
          return new Date(m.updated_at) > new Date(latest.updated_at)
            ? m
            : latest;
        }, null);
        lastActivity = lastMed?.updated_at;
      }

      return {
        id: r.patient?.id ?? "",
        name: r.patient?.name ?? "Unknown",
        email: r.patient?.email ?? "",
        linkId: r.id,
        linkStatus: r.status as LinkStatus,
        medications,
        adherenceRate,
        lastActivity,
      };
    })
  );

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
