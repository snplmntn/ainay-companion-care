import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import type { Profile, Medication as DbMedication } from "@/types/database";
import type {
  Medication,
  MedicationCategory,
  FrequencyType,
  NextDayMode,
  LinkedPatient,
  LinkedCompanion,
  PatientCompanionLink,
  UserRole,
} from "@/types";
import type { EnhancedMedication } from "@/modules/medication";
import { isSupabaseConfigured } from "@/lib/supabase";
import {
  onAuthStateChange,
  getProfile,
  getMedicationsWithDoses,
  addMedication as addMedicationToDb,
  addMedicationWithDoses,
  updateMedicationWithDoses,
  deactivateMedication,
  toggleMedicationTaken,
  toggleDoseTaken,
  signOut as supabaseSignOut,
  getLinkCode,
  getLinkedPatients,
  getLinkedCompanions,
  requestPatientLink,
  removeLink,
  checkAndAutoExpire,
  updateProfile,
} from "@/services/supabase";
import { toast } from "@/hooks/use-toast";

// Note: PendingLinkRequest removed - links are now auto-accepted

interface AppContextType {
  // Auth state
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Legacy state (for backward compatibility)
  userRole: UserRole;
  setUserRole: (role: UserRole) => void;
  userName: string;
  setUserName: (name: string) => void;

  // Medications
  medications: Medication[];
  addMedication: (
    med: Omit<Medication, "id" | "taken" | "doses">
  ) => Promise<void>;
  addEnhancedMedication: (med: EnhancedMedication) => Promise<void>;
  updateMedication: (id: string, med: Partial<Medication>) => Promise<void>;
  deleteMedication: (id: string) => Promise<void>;
  toggleMedication: (id: string) => Promise<void>;
  toggleDose: (medicationId: string, doseId: string) => Promise<void>;
  refreshMedications: () => Promise<void>;

  // Companion features
  linkCode: string | null;
  linkedPatients: LinkedPatient[];
  linkedCompanions: LinkedCompanion[];
  pendingRequests: PatientCompanionLink[]; // Kept for backward compatibility, always empty
  requestLinkToPatient: (
    linkCode: string
  ) => Promise<{ success: boolean; patientName?: string; error?: string }>;
  acceptLinkRequest: (requestId: string) => Promise<void>;
  rejectLinkRequest: (requestId: string) => Promise<void>;
  unlinkPatientOrCompanion: (linkId: string) => Promise<void>;
  refreshCompanionData: () => Promise<void>;

  // Notification settings
  updateNotificationSettings: (settings: {
    email_reminder_enabled?: boolean;
    email_reminder_minutes?: number;
  }) => Promise<{ error: string | null }>;

  // Profile updates
  updateProfileName: (name: string) => Promise<{ error: string | null }>;

  // Auth actions
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Convert DB medication to app medication
const convertMedication = (
  dbMed: DbMedication & { doses?: Array<{ id: string; time: string; label: string; taken: boolean; taken_at: string | null; dose_order: number }>; start_date?: string | null; end_date?: string | null }
): Medication => ({
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
  doses: dbMed.doses?.map((dose) => ({
    id: dose.id,
    time: dose.time,
    label: dose.label,
    taken: dose.taken,
    takenAt: dose.taken_at ?? undefined,
    order: dose.dose_order,
  })),
});

export function AppProvider({ children }: { children: ReactNode }) {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Legacy state
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [userName, setUserName] = useState("");

  // Medications
  const [medications, setMedications] = useState<Medication[]>([]);

  // Companion data
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [linkedPatients, setLinkedPatients] = useState<LinkedPatient[]>([]);
  const [linkedCompanions, setLinkedCompanions] = useState<LinkedCompanion[]>(
    []
  );
  // pendingRequests removed - links are now auto-accepted

  // Load user profile, medications, and companion data
  const loadUserData = useCallback(async (userId: string) => {
    try {
      // Load profile
      const { profile: userProfile } = await getProfile(userId);
      if (userProfile) {
        setProfile(userProfile);
        setUserRole(userProfile.role);
        setUserName(userProfile.name);

        // Load link code for patients
        if (userProfile.role === "patient") {
          const { linkCode: code } = await getLinkCode(userId);
          setLinkCode(code);

          // Load linked companions
          const { companions } = await getLinkedCompanions(userId);
          setLinkedCompanions(companions);
        }

        // Load linked patients for companions
        if (userProfile.role === "companion") {
          const { patients } = await getLinkedPatients(userId);
          setLinkedPatients(patients);
        }
      }

      // Auto-expire medications before loading them
      // This ensures expired prescriptions are deactivated
      const { expired, expiringSoon } = await checkAndAutoExpire(userId);
      
      // Notify user about expired medications
      if (expired.count > 0) {
        toast({
          title: `${expired.count} prescription${expired.count > 1 ? "s" : ""} expired`,
          description: `${expired.names.join(", ")} ${expired.count > 1 ? "have" : "has"} completed. Consult your doctor if you need a refill.`,
          variant: "default",
        });
      }

      // Warn about medications expiring soon
      if (expiringSoon.length > 0) {
        const soonNames = expiringSoon
          .map((m) => `${m.name} (${m.daysRemaining === 0 ? "today" : `${m.daysRemaining}d`})`)
          .join(", ");
        toast({
          title: "Prescriptions ending soon ⚠️",
          description: `${soonNames}. Consider contacting your doctor for a refill.`,
        });
      }

      // Load medications with doses (expired ones are now filtered out)
      const { medications: userMeds } = await getMedicationsWithDoses(userId);
      setMedications(userMeds.map(convertMedication));
    } catch (error) {
      console.error("Error loading user data:", error);
    }
  }, []);

  // Listen to auth state changes (only if Supabase is configured)
  useEffect(() => {
    if (!isSupabaseConfigured) {
      // Demo mode - no auth needed, just mark as loaded
      setIsLoading(false);
      return;
    }

    const {
      data: { subscription },
    } = onAuthStateChange(async (authUser, authSession) => {
      setUser(authUser);
      setSession(authSession);

      if (authUser) {
        await loadUserData(authUser.id);
      } else {
        // Clear all state on logout
        setProfile(null);
        setUserRole(null);
        setUserName("");
        setMedications([]);
        setLinkCode(null);
        setLinkedPatients([]);
        setLinkedCompanions([]);
      }

      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadUserData]);

  // Add medication
  const addMedication = async (
    med: Omit<Medication, "id" | "taken" | "doses">
  ) => {
    if (!user) {
      // Fallback for non-authenticated mode (demo)
      const newMed: Medication = {
        ...med,
        id: Date.now().toString(),
        taken: false,
        isActive: true,
      };
      setMedications((prev) => [...prev, newMed]);
      return;
    }

    const { medication: newMed, error } = await addMedicationToDb({
      user_id: user.id,
      name: med.name,
      dosage: med.dosage,
      time: med.time,
      instructions: med.instructions ?? null,
      category: med.category,
      image_url: med.imageUrl ?? null,
      frequency: med.frequency,
      custom_frequency: med.customFrequency ?? null,
      time_period: med.timePeriod,
      start_date: med.startDate ?? null,
      end_date: med.endDate ?? null,
      start_time: med.startTime,
      next_day_mode: med.nextDayMode,
      interval_minutes: med.intervalMinutes ?? null,
      is_active: true,
    });

    if (error) {
      console.error("Error adding medication:", error);
      throw new Error(error);
    }

    if (newMed) {
      setMedications((prev) => [...prev, convertMedication(newMed)]);
    }
  };

  // Toggle medication taken status
  const toggleMedication = async (id: string) => {
    const medication = medications.find((m) => m.id === id);
    if (!medication) return;

    // Optimistic update
    setMedications((prev) =>
      prev.map((med) => (med.id === id ? { ...med, taken: !med.taken } : med))
    );

    if (user) {
      const { error } = await toggleMedicationTaken(id, !medication.taken);
      if (error) {
        // Revert on error
        setMedications((prev) =>
          prev.map((med) =>
            med.id === id ? { ...med, taken: medication.taken } : med
          )
        );
        console.error("Error toggling medication:", error);
      }
    }
  };

  // Toggle individual dose taken status
  const toggleDose = async (medicationId: string, doseId: string) => {
    const medication = medications.find((m) => m.id === medicationId);
    if (!medication) return;

    const dose = medication.doses?.find((d) => d.id === doseId);
    if (!dose) return;

    const newTakenStatus = !dose.taken;

    // Optimistic update for the dose
    setMedications((prev) =>
      prev.map((med) => {
        if (med.id !== medicationId) return med;
        return {
          ...med,
          doses: med.doses?.map((d) =>
            d.id === doseId ? { ...d, taken: newTakenStatus } : d
          ),
        };
      })
    );

    if (user) {
      const { error } = await toggleDoseTaken(doseId, newTakenStatus);
      if (error) {
        // Revert on error
        setMedications((prev) =>
          prev.map((med) => {
            if (med.id !== medicationId) return med;
            return {
              ...med,
              doses: med.doses?.map((d) =>
                d.id === doseId ? { ...d, taken: dose.taken } : d
              ),
            };
          })
        );
        console.error("Error toggling dose:", error);
      }
    }
  };

  // Update an existing medication
  const updateMedicationFn = async (id: string, updates: Partial<Medication>) => {
    const medication = medications.find((m) => m.id === id);
    if (!medication) return;

    // Optimistic update
    setMedications((prev) =>
      prev.map((med) => (med.id === id ? { ...med, ...updates } : med))
    );

    if (user) {
      // Prepare data for database update
      const dbUpdates = {
        name: updates.name,
        dosage: updates.dosage,
        time: updates.time,
        instructions: updates.instructions ?? null,
        category: updates.category,
        image_url: updates.imageUrl ?? null,
        frequency: updates.frequency,
        custom_frequency: updates.customFrequency ?? null,
        time_period: updates.timePeriod,
        start_date: updates.startDate ?? null,
        end_date: updates.endDate ?? null,
        start_time: updates.startTime,
        next_day_mode: updates.nextDayMode,
        interval_minutes: updates.intervalMinutes ?? null,
      };

      // Prepare doses if they exist
      const dosesData = updates.doses?.map((dose, index) => ({
        time: dose.time,
        label: dose.label,
        taken: dose.taken,
        dose_order: index + 1,
      })) ?? [];

      const { error } = await updateMedicationWithDoses(id, dbUpdates, dosesData);
      if (error) {
        // Revert on error
        setMedications((prev) =>
          prev.map((med) => (med.id === id ? medication : med))
        );
        console.error("Error updating medication:", error);
        throw new Error(error);
      }

      // Refresh to get updated data from database
      await refreshMedications();
    }
  };

  // Delete (deactivate) a medication
  const deleteMedicationFn = async (id: string) => {
    const medication = medications.find((m) => m.id === id);
    if (!medication) return;

    // Optimistic update - remove from list
    setMedications((prev) => prev.filter((med) => med.id !== id));

    if (user) {
      const { error } = await deactivateMedication(id);
      if (error) {
        // Revert on error - add back to list
        setMedications((prev) => [...prev, medication]);
        console.error("Error deleting medication:", error);
        throw new Error(error);
      }
    }
  };

  // Refresh medications from database
  const refreshMedications = async () => {
    if (!user) return;

    const { medications: userMeds, error } = await getMedicationsWithDoses(user.id);
    if (!error) {
      setMedications(userMeds.map(convertMedication));
    }
  };

  // Add enhanced medication with full scheduling support
  const addEnhancedMedication = async (med: EnhancedMedication) => {
    if (!user) {
      // Fallback for non-authenticated mode (demo)
      const newMed: Medication = {
        id: Date.now().toString(),
        name: med.name,
        dosage: med.dosage,
        time: med.schedule.startTime,
        instructions: med.instructions,
        category: med.category,
        imageUrl: med.imageUrl,
        frequency: med.frequency,
        customFrequency: med.customFrequency,
        timePeriod: med.timePeriod,
        startTime: med.schedule.startTime,
        nextDayMode: med.schedule.nextDayMode,
        intervalMinutes: med.schedule.intervalMinutes,
        isActive: med.schedule.isActive,
        taken: false,
        doses: med.schedule.doses.map((dose, index) => ({
          id: `${Date.now()}-${index}`,
          time: dose.time,
          label: dose.label,
          taken: false,
        })),
      };
      setMedications((prev) => [...prev, newMed]);
      return;
    }

    // Prepare medication data for database
    const medicationData = {
      user_id: user.id,
      name: med.name,
      dosage: med.dosage,
      time: med.schedule.startTime,
      instructions: med.instructions ?? null,
      category: med.category,
      image_url: med.imageUrl ?? null,
      frequency: med.frequency,
      custom_frequency: med.customFrequency ?? null,
      time_period: med.timePeriod,
      start_time: med.schedule.startTime,
      next_day_mode: med.schedule.nextDayMode,
      interval_minutes: med.schedule.intervalMinutes,
      is_active: true,
    };

    // Prepare doses data
    const dosesData = med.schedule.doses.map((dose, index) => ({
      time: dose.time,
      label: dose.label,
      taken: false,
      dose_order: index + 1,
    }));

    const { medication: newMed, error } = await addMedicationWithDoses(
      medicationData,
      dosesData
    );

    if (error) {
      console.error("Error adding medication with doses:", error);
      throw new Error(error);
    }

    if (newMed) {
      // Refresh to get the full medication with doses
      await refreshMedications();
    }
  };

  // Refresh companion data
  const refreshCompanionData = async () => {
    if (!user || !profile) return;

    if (profile.role === "patient") {
      const { companions } = await getLinkedCompanions(user.id);
      setLinkedCompanions(companions);
    }

    if (profile.role === "companion") {
      const { patients } = await getLinkedPatients(user.id);
      setLinkedPatients(patients);
    }
  };

  // Request link to patient
  const requestLinkToPatient = async (
    code: string
  ): Promise<{ success: boolean; patientName?: string; error?: string }> => {
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const { linkId, patientName, error } = await requestPatientLink(
      user.id,
      code
    );

    if (error) {
      // Pass patientName even in error case (for "already linked" message)
      return { success: false, error, patientName: patientName ?? undefined };
    }

    // Refresh linked patients
    await refreshCompanionData();

    return { success: true, patientName: patientName ?? undefined };
  };

  // Accept link request (no longer used - links are auto-accepted)
  const acceptLinkRequest = async (_requestId: string) => {
    // No-op: links are now auto-accepted
  };

  // Reject link request (no longer used - links are auto-accepted)
  const rejectLinkRequest = async (_requestId: string) => {
    // No-op: links are now auto-accepted
  };

  // Unlink patient or companion
  const unlinkPatientOrCompanion = async (linkId: string) => {
    const { error } = await removeLink(linkId);
    if (!error) {
      await refreshCompanionData();
    }
  };

  // Update notification settings
  const updateNotificationSettings = async (settings: {
    email_reminder_enabled?: boolean;
    email_reminder_minutes?: number;
  }): Promise<{ error: string | null }> => {
    if (!user) {
      return { error: "Not authenticated" };
    }

    const { error } = await updateProfile(user.id, settings);
    
    if (!error && profile) {
      // Update local profile state
      setProfile({
        ...profile,
        email_reminder_enabled: settings.email_reminder_enabled ?? profile.email_reminder_enabled,
        email_reminder_minutes: settings.email_reminder_minutes ?? profile.email_reminder_minutes,
      });
    }

    return { error };
  };

  // Update profile name
  const updateProfileName = async (name: string): Promise<{ error: string | null }> => {
    if (!user) {
      return { error: "Not authenticated" };
    }

    const { error } = await updateProfile(user.id, { name });
    
    if (!error && profile) {
      // Update local profile and userName state
      setProfile({ ...profile, name });
      setUserName(name);
    }

    return { error };
  };

  // Sign out
  const signOut = async () => {
    if (isSupabaseConfigured) {
      const { error } = await supabaseSignOut();
      if (error) {
        console.error("Error signing out:", error);
      }
      // State will be cleared by auth state change listener
    } else {
      // Demo mode - just clear local state
      setUser(null);
      setSession(null);
      setProfile(null);
      setUserRole(null);
      setUserName("");
      setMedications([]);
      setLinkCode(null);
      setLinkedPatients([]);
      setLinkedCompanions([]);
    }
  };

  const isAuthenticated = !!user;

  return (
    <AppContext.Provider
      value={{
        user,
        session,
        profile,
        isLoading,
        isAuthenticated,
        userRole,
        setUserRole,
        userName,
        setUserName,
        medications,
        addMedication,
        addEnhancedMedication,
        updateMedication: updateMedicationFn,
        deleteMedication: deleteMedicationFn,
        toggleMedication,
        toggleDose,
        refreshMedications,
        linkCode,
        linkedPatients,
        linkedCompanions,
        pendingRequests: [], // Always empty - links are auto-accepted
        requestLinkToPatient,
        acceptLinkRequest,
        rejectLinkRequest,
        unlinkPatientOrCompanion,
        refreshCompanionData,
        updateNotificationSettings,
        updateProfileName,
        signOut,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}

// Re-export types for convenience
export type { Medication, UserRole };
