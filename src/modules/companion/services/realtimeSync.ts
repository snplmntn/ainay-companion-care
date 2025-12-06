// ============================================
// Real-time Sync Service for Companion Dashboard
// Uses Supabase Realtime to sync patient medication updates
// ============================================

import { supabase } from "@/lib/supabase";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { Medication as DbMedication } from "@/types/database";

export type MedicationChangeType = "INSERT" | "UPDATE" | "DELETE";

export interface MedicationChangeEvent {
  type: MedicationChangeType;
  medication: DbMedication;
  patientId: string;
}

export type MedicationChangeHandler = (event: MedicationChangeEvent) => void;

/**
 * Subscribe to real-time medication changes for a specific patient
 */
export function subscribeToPatientMedications(
  patientId: string,
  onMedicationChange: MedicationChangeHandler
): RealtimeChannel {
  const channel = supabase
    .channel(`patient-medications-${patientId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "medications",
        filter: `user_id=eq.${patientId}`,
      },
      (payload: RealtimePostgresChangesPayload<DbMedication>) => {
        const eventType = payload.eventType.toUpperCase() as MedicationChangeType;
        
        // For DELETE, the record is in old, otherwise in new
        const medication = eventType === "DELETE" 
          ? payload.old as DbMedication 
          : payload.new as DbMedication;

        if (medication) {
          onMedicationChange({
            type: eventType,
            medication,
            patientId,
          });
        }
      }
    )
    .subscribe();

  return channel;
}

/**
 * Subscribe to real-time medication changes for multiple patients
 */
export function subscribeToMultiplePatientsMedications(
  patientIds: string[],
  onMedicationChange: MedicationChangeHandler
): RealtimeChannel[] {
  return patientIds.map((patientId) =>
    subscribeToPatientMedications(patientId, onMedicationChange)
  );
}

/**
 * Unsubscribe from a realtime channel
 */
export async function unsubscribeFromChannel(channel: RealtimeChannel): Promise<void> {
  await supabase.removeChannel(channel);
}

/**
 * Unsubscribe from multiple realtime channels
 */
export async function unsubscribeFromChannels(channels: RealtimeChannel[]): Promise<void> {
  await Promise.all(channels.map((channel) => unsubscribeFromChannel(channel)));
}

/**
 * Subscribe to patient-companion link changes (for companions to know when patients accept/reject)
 */
export function subscribeToLinkChanges(
  companionId: string,
  onLinkChange: (event: {
    type: "INSERT" | "UPDATE" | "DELETE";
    link: {
      id: string;
      patient_id: string;
      companion_id: string;
      status: string;
    };
  }) => void
): RealtimeChannel {
  const channel = supabase
    .channel(`companion-links-${companionId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "patient_companions",
        filter: `companion_id=eq.${companionId}`,
      },
      (payload: RealtimePostgresChangesPayload<{
        id: string;
        patient_id: string;
        companion_id: string;
        status: string;
      }>) => {
        const eventType = payload.eventType.toUpperCase() as "INSERT" | "UPDATE" | "DELETE";
        const link = eventType === "DELETE" 
          ? payload.old as typeof payload.new 
          : payload.new;

        if (link) {
          onLinkChange({
            type: eventType,
            link: link as {
              id: string;
              patient_id: string;
              companion_id: string;
              status: string;
            },
          });
        }
      }
    )
    .subscribe();

  return channel;
}

/**
 * Subscribe to schedule dose changes for a patient
 */
export function subscribeToPatientDoses(
  patientId: string,
  medicationIds: string[],
  onDoseChange: (event: {
    type: MedicationChangeType;
    dose: {
      id: string;
      medication_id: string;
      taken: boolean;
      taken_at: string | null;
    };
  }) => void
): RealtimeChannel | null {
  if (medicationIds.length === 0) return null;

  // Create a filter for all medication IDs
  const filter = medicationIds.map(id => `medication_id.eq.${id}`).join(",");

  const channel = supabase
    .channel(`patient-doses-${patientId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "schedule_doses",
        filter: `medication_id=in.(${medicationIds.join(",")})`,
      },
      (payload: RealtimePostgresChangesPayload<{
        id: string;
        medication_id: string;
        taken: boolean;
        taken_at: string | null;
      }>) => {
        const eventType = payload.eventType.toUpperCase() as MedicationChangeType;
        const dose = eventType === "DELETE" 
          ? payload.old 
          : payload.new;

        if (dose) {
          onDoseChange({
            type: eventType,
            dose: dose as {
              id: string;
              medication_id: string;
              taken: boolean;
              taken_at: string | null;
            },
          });
        }
      }
    )
    .subscribe();

  return channel;
}


