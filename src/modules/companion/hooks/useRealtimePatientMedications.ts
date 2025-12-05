// ============================================
// Real-time Patient Medications Hook
// Provides real-time synced medication data for companions
// ============================================

import { useState, useEffect, useCallback, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { Medication, LinkedPatient, MedicationCategory, FrequencyType, NextDayMode } from "@/types";
import type { Medication as DbMedication } from "@/types/database";
import { getMedications } from "@/services/supabase";
import {
  subscribeToPatientMedications,
  unsubscribeFromChannel,
  type MedicationChangeEvent,
} from "../services/realtimeSync";

interface UseRealtimePatientMedicationsOptions {
  /** Whether to automatically subscribe to realtime updates */
  enabled?: boolean;
  /** Callback when a medication is updated in real-time */
  onUpdate?: (patientId: string, medications: Medication[]) => void;
}

interface UseRealtimePatientMedicationsReturn {
  /** Current medications for the patient */
  medications: Medication[];
  /** Whether the initial load is in progress */
  isLoading: boolean;
  /** Any error that occurred */
  error: string | null;
  /** Whether realtime is connected */
  isConnected: boolean;
  /** Manually refresh medications from the database */
  refresh: () => Promise<void>;
}

/**
 * Convert DB medication to app medication format
 */
function convertDbMedication(dbMed: DbMedication & { start_date?: string | null; end_date?: string | null }): Medication {
  return {
    id: dbMed.id,
    name: dbMed.name,
    dosage: dbMed.dosage,
    time: dbMed.time ?? dbMed.start_time ?? "08:00 AM",
    taken: dbMed.taken,
    instructions: dbMed.instructions ?? undefined,
    category: (dbMed.category as MedicationCategory) ?? "medicine",
    imageUrl: dbMed.image_url ?? undefined,
    frequency: (dbMed.frequency as FrequencyType) ?? "once_daily",
    customFrequency: dbMed.custom_frequency ?? undefined,
    timePeriod: dbMed.time_period ?? "ongoing",
    startDate: dbMed.start_date ?? undefined,
    endDate: dbMed.end_date ?? undefined,
    startTime: dbMed.start_time ?? "08:00 AM",
    nextDayMode: (dbMed.next_day_mode as NextDayMode) ?? "restart",
    intervalMinutes: dbMed.interval_minutes ?? undefined,
    isActive: dbMed.is_active ?? true,
    takenAt: dbMed.taken_at ?? undefined,
  };
}

/**
 * Hook for real-time patient medication sync
 */
export function useRealtimePatientMedications(
  patientId: string | null,
  options: UseRealtimePatientMedicationsOptions = {}
): UseRealtimePatientMedicationsReturn {
  const { enabled = true, onUpdate } = options;

  const [medications, setMedications] = useState<Medication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  // Fetch medications from the database
  const fetchMedications = useCallback(async () => {
    if (!patientId) {
      setMedications([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { medications: dbMeds, error: fetchError } = await getMedications(patientId);

      if (fetchError) {
        setError(fetchError);
        setMedications([]);
      } else {
        const converted = dbMeds.map(convertDbMedication);
        setMedications(converted);
        onUpdateRef.current?.(patientId, converted);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch medications");
      setMedications([]);
    } finally {
      setIsLoading(false);
    }
  }, [patientId]);

  // Handle realtime medication changes
  const handleMedicationChange = useCallback(
    (event: MedicationChangeEvent) => {
      const convertedMed = convertDbMedication(event.medication);

      setMedications((prev) => {
        let updated: Medication[];

        switch (event.type) {
          case "INSERT":
            // Add new medication if not already present
            if (prev.some((m) => m.id === convertedMed.id)) {
              updated = prev;
            } else {
              updated = [...prev, convertedMed];
            }
            break;

          case "UPDATE":
            // Update existing medication
            updated = prev.map((m) =>
              m.id === convertedMed.id ? convertedMed : m
            );
            break;

          case "DELETE":
            // Remove medication
            updated = prev.filter((m) => m.id !== convertedMed.id);
            break;

          default:
            updated = prev;
        }

        // Notify parent component
        if (patientId) {
          onUpdateRef.current?.(patientId, updated);
        }

        return updated;
      });
    },
    [patientId]
  );

  // Subscribe to realtime updates
  useEffect(() => {
    if (!patientId || !enabled) {
      return;
    }

    // Subscribe to realtime changes
    channelRef.current = subscribeToPatientMedications(
      patientId,
      handleMedicationChange
    );

    // Track connection status
    const channel = channelRef.current;
    
    // Channel subscription is async, mark as connected once subscribed
    setIsConnected(true);

    return () => {
      if (channelRef.current) {
        unsubscribeFromChannel(channelRef.current);
        channelRef.current = null;
        setIsConnected(false);
      }
    };
  }, [patientId, enabled, handleMedicationChange]);

  // Initial fetch
  useEffect(() => {
    fetchMedications();
  }, [fetchMedications]);

  return {
    medications,
    isLoading,
    error,
    isConnected,
    refresh: fetchMedications,
  };
}

/**
 * Hook for real-time sync of multiple patients (for companion dashboard)
 */
export function useRealtimeMultiplePatients(
  patients: LinkedPatient[],
  options: {
    enabled?: boolean;
    onPatientUpdate?: (patientId: string, medications: Medication[]) => void;
  } = {}
): {
  /** Map of patient ID to their medications */
  patientMedications: Map<string, Medication[]>;
  /** Whether any patient is loading */
  isLoading: boolean;
  /** Whether realtime is connected */
  isConnected: boolean;
  /** Refresh all patients */
  refreshAll: () => Promise<void>;
} {
  const { enabled = true, onPatientUpdate } = options;

  const [patientMedications, setPatientMedications] = useState<Map<string, Medication[]>>(
    new Map()
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);

  const channelsRef = useRef<Map<string, RealtimeChannel>>(new Map());
  const onPatientUpdateRef = useRef(onPatientUpdate);
  onPatientUpdateRef.current = onPatientUpdate;

  // Get accepted patient IDs
  const acceptedPatients = patients.filter((p) => p.linkStatus === "accepted");
  const patientIds = acceptedPatients.map((p) => p.id);

  // Handle medication change for a patient
  const handleMedicationChange = useCallback(
    (event: MedicationChangeEvent) => {
      const convertedMed = convertDbMedication(event.medication);

      setPatientMedications((prev) => {
        const current = prev.get(event.patientId) || [];
        let updated: Medication[];

        switch (event.type) {
          case "INSERT":
            if (current.some((m) => m.id === convertedMed.id)) {
              updated = current;
            } else {
              updated = [...current, convertedMed];
            }
            break;

          case "UPDATE":
            updated = current.map((m) =>
              m.id === convertedMed.id ? convertedMed : m
            );
            break;

          case "DELETE":
            updated = current.filter((m) => m.id !== convertedMed.id);
            break;

          default:
            updated = current;
        }

        const newMap = new Map(prev);
        newMap.set(event.patientId, updated);

        // Notify parent
        onPatientUpdateRef.current?.(event.patientId, updated);

        return newMap;
      });
    },
    []
  );

  // Fetch all patients' medications
  const fetchAllPatients = useCallback(async () => {
    if (patientIds.length === 0) {
      setPatientMedications(new Map());
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const results = await Promise.all(
        patientIds.map(async (patientId) => {
          const { medications: dbMeds } = await getMedications(patientId);
          const converted = dbMeds.map(convertDbMedication);
          return { patientId, medications: converted };
        })
      );

      const newMap = new Map<string, Medication[]>();
      results.forEach(({ patientId, medications }) => {
        newMap.set(patientId, medications);
        onPatientUpdateRef.current?.(patientId, medications);
      });

      setPatientMedications(newMap);
    } catch (err) {
      console.error("Failed to fetch patient medications:", err);
    } finally {
      setIsLoading(false);
    }
  }, [patientIds.join(",")]);

  // Subscribe to all patients
  useEffect(() => {
    if (!enabled) {
      setIsConnected(false);
      return;
    }

    // Mark as connected when enabled - companion is online even without linked patients
    setIsConnected(true);

    if (patientIds.length === 0) {
      // No patients to subscribe to, but still "connected" (online)
      return;
    }

    // Subscribe to each patient
    patientIds.forEach((patientId) => {
      if (!channelsRef.current.has(patientId)) {
        const channel = subscribeToPatientMedications(patientId, handleMedicationChange);
        channelsRef.current.set(patientId, channel);
      }
    });

    // Remove subscriptions for patients no longer in the list
    channelsRef.current.forEach((channel, patientId) => {
      if (!patientIds.includes(patientId)) {
        unsubscribeFromChannel(channel);
        channelsRef.current.delete(patientId);
      }
    });

    return () => {
      // Cleanup all channels
      channelsRef.current.forEach((channel) => {
        unsubscribeFromChannel(channel);
      });
      channelsRef.current.clear();
      setIsConnected(false);
    };
  }, [patientIds.join(","), enabled, handleMedicationChange]);

  // Initial fetch
  useEffect(() => {
    fetchAllPatients();
  }, [fetchAllPatients]);

  return {
    patientMedications,
    isLoading,
    isConnected,
    refreshAll: fetchAllPatients,
  };
}

