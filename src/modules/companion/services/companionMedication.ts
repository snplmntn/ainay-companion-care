// ============================================
// Companion Medication Service
// Allows companions to add medications for their linked patients
// ============================================

import { supabase } from "@/lib/supabase";
import type { Medication } from "@/types/database";
import type { FrequencyType, NextDayMode } from "@/modules/medication/types";
import { createMedicationSchedule } from "@/modules/medication/services/scheduleService";

interface AddMedicationParams {
  name: string;
  dosage: string;
  time: string;
  instructions?: string;
  category: string;
  frequency: string;
  imageUrl?: string;
  timePeriod: string;
  startDate?: string; // ISO date string (YYYY-MM-DD)
  endDate?: string; // ISO date string (YYYY-MM-DD)
  startTime: string;
  nextDayMode: string;
  isActive: boolean;
}

/**
 * Convert 12-hour time (e.g., "8:00 AM") to 24-hour format (e.g., "08:00")
 */
function convertTo24Hour(time12h: string): string {
  const match = time12h.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return "08:00"; // default fallback
  
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const period = match[3].toUpperCase();
  
  if (period === "PM" && hours !== 12) {
    hours += 12;
  } else if (period === "AM" && hours === 12) {
    hours = 0;
  }
  
  return `${hours.toString().padStart(2, "0")}:${minutes}`;
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
 * Also creates schedule_doses entries based on frequency
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

  // Convert time to 24-hour format for schedule calculation
  const startTime24h = convertTo24Hour(medication.startTime);

  // Create the schedule with computed doses based on frequency
  const schedule = createMedicationSchedule({
    name: medication.name,
    dosage: medication.dosage,
    category: medication.category as import("@/modules/medication/types").MedicationCategory,
    frequency: medication.frequency as FrequencyType,
    timePeriod: medication.timePeriod,
    instructions: medication.instructions || "",
    startTime: startTime24h,
    nextDayMode: medication.nextDayMode as NextDayMode,
  });

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
      start_date: medication.startDate ?? null,
      end_date: medication.endDate ?? null,
      start_time: medication.startTime,
      next_day_mode: medication.nextDayMode,
      interval_minutes: schedule.intervalMinutes,
      is_active: medication.isActive,
      taken: false,
    })
    .select()
    .single();

  if (error) {
    return { medication: null, error: error.message };
  }

  // Insert the schedule doses
  if (data && schedule.doses.length > 0) {
    const dosesData = schedule.doses.map((dose, index) => ({
      medication_id: data.id,
      time: dose.time,
      label: dose.label,
      taken: false,
      dose_order: index + 1,
    }));

    const { error: doseError } = await supabase
      .from("schedule_doses")
      .insert(dosesData);

    if (doseError) {
      console.error("Error creating doses for patient medication:", doseError);
      // Don't fail the whole operation, the medication is already created
    }
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
  if (updates.startDate !== undefined) updateData.start_date = updates.startDate;
  if (updates.endDate !== undefined) updateData.end_date = updates.endDate;
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

