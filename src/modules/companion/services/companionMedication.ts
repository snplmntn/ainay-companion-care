// ============================================
// Companion Medication Service
// Allows companions to add medications for their linked patients
// ============================================

import { supabase } from "@/lib/supabase";
import type { Medication } from "@/types/database";

interface AddMedicationParams {
  name: string;
  dosage: string;
  time: string;
  instructions?: string;
  category: string;
  frequency: string;
  imageUrl?: string;
  timePeriod: string;
  startTime: string;
  nextDayMode: string;
  isActive: boolean;
}

/**
 * Verify that a companion is linked to a patient with accepted status
 */
export async function verifyCompanionLink(
  patientId: string,
  companionId: string
): Promise<{ isLinked: boolean; error: string | null }> {
  const { data, error } = await supabase
    .from("patient_companions")
    .select("status")
    .eq("patient_id", patientId)
    .eq("companion_id", companionId)
    .eq("status", "accepted")
    .single();

  if (error || !data) {
    return { isLinked: false, error: "Not authorized to manage this patient's medications" };
  }

  return { isLinked: true, error: null };
}

/**
 * Add a medication for a patient (as a companion)
 * Verifies the companion has an accepted link to the patient first
 */
export async function addMedicationForPatient(
  patientId: string,
  companionId: string,
  medication: AddMedicationParams
): Promise<{ medication: Medication | null; error: string | null }> {
  // First verify the companion is linked to the patient
  const { isLinked, error: linkError } = await verifyCompanionLink(patientId, companionId);
  
  if (!isLinked) {
    return { medication: null, error: linkError || "Not authorized" };
  }

  // Insert the medication for the patient
  const { data, error } = await supabase
    .from("medications")
    .insert({
      user_id: patientId,
      name: medication.name,
      dosage: medication.dosage,
      time: medication.time,
      instructions: medication.instructions ?? null,
      category: medication.category,
      frequency: medication.frequency,
      image_url: medication.imageUrl ?? null,
      time_period: medication.timePeriod,
      start_time: medication.startTime,
      next_day_mode: medication.nextDayMode,
      is_active: medication.isActive,
      taken: false,
    })
    .select()
    .single();

  if (error) {
    return { medication: null, error: error.message };
  }

  return { medication: data, error: null };
}

/**
 * Update a medication for a patient (as a companion)
 */
export async function updateMedicationForPatient(
  medicationId: string,
  patientId: string,
  companionId: string,
  updates: Partial<AddMedicationParams>
): Promise<{ error: string | null }> {
  // Verify the companion is linked to the patient
  const { isLinked, error: linkError } = await verifyCompanionLink(patientId, companionId);
  
  if (!isLinked) {
    return { error: linkError || "Not authorized" };
  }

  // Prepare update object
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.dosage !== undefined) updateData.dosage = updates.dosage;
  if (updates.time !== undefined) updateData.time = updates.time;
  if (updates.instructions !== undefined) updateData.instructions = updates.instructions;
  if (updates.category !== undefined) updateData.category = updates.category;
  if (updates.frequency !== undefined) updateData.frequency = updates.frequency;
  if (updates.imageUrl !== undefined) updateData.image_url = updates.imageUrl;
  if (updates.timePeriod !== undefined) updateData.time_period = updates.timePeriod;
  if (updates.startTime !== undefined) updateData.start_time = updates.startTime;
  if (updates.nextDayMode !== undefined) updateData.next_day_mode = updates.nextDayMode;
  if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

  const { error } = await supabase
    .from("medications")
    .update(updateData)
    .eq("id", medicationId)
    .eq("user_id", patientId); // Ensure the medication belongs to this patient

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

/**
 * Delete (deactivate) a medication for a patient (as a companion)
 */
export async function deactivateMedicationForPatient(
  medicationId: string,
  patientId: string,
  companionId: string
): Promise<{ error: string | null }> {
  // Verify the companion is linked to the patient
  const { isLinked, error: linkError } = await verifyCompanionLink(patientId, companionId);
  
  if (!isLinked) {
    return { error: linkError || "Not authorized" };
  }

  const { error } = await supabase
    .from("medications")
    .update({ 
      is_active: false, 
      updated_at: new Date().toISOString() 
    })
    .eq("id", medicationId)
    .eq("user_id", patientId);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

