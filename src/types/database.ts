export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type MedicationCategory =
  | "medicine"
  | "vitamin"
  | "supplement"
  | "herbal"
  | "other";
export type FrequencyType =
  | "once_daily"
  | "twice_daily"
  | "three_times_daily"
  | "four_times_daily"
  | "every_other_day"
  | "weekly"
  | "as_needed"
  | "custom";
export type NextDayMode = "restart" | "continue";
export type DoseStatus = "pending" | "taken" | "missed" | "skipped";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          name: string;
          role: "patient" | "companion";
          link_code: string | null; // Unique code for patients to share with companions
          email_reminder_enabled: boolean; // Whether to send email reminders before medication intake
          email_reminder_minutes: number; // Minutes before scheduled time to send reminder
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name: string;
          role: "patient" | "companion";
          link_code?: string | null;
          email_reminder_enabled?: boolean;
          email_reminder_minutes?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          role?: "patient" | "companion";
          link_code?: string | null;
          email_reminder_enabled?: boolean;
          email_reminder_minutes?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      medications: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          dosage: string;
          category: MedicationCategory;
          instructions: string | null;
          image_url: string | null;
          frequency: FrequencyType;
          custom_frequency: number | null;
          time_period: string;
          start_date: string | null;
          end_date: string | null;
          start_time: string;
          next_day_mode: NextDayMode;
          interval_minutes: number | null;
          is_active: boolean;
          // Legacy fields
          time: string | null;
          taken: boolean;
          taken_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          dosage: string;
          category?: MedicationCategory;
          instructions?: string | null;
          image_url?: string | null;
          frequency?: FrequencyType;
          custom_frequency?: number | null;
          time_period?: string;
          start_date?: string | null;
          end_date?: string | null;
          start_time?: string;
          next_day_mode?: NextDayMode;
          interval_minutes?: number | null;
          is_active?: boolean;
          time?: string | null;
          taken?: boolean;
          taken_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          dosage?: string;
          category?: MedicationCategory;
          instructions?: string | null;
          image_url?: string | null;
          frequency?: FrequencyType;
          custom_frequency?: number | null;
          time_period?: string;
          start_date?: string | null;
          end_date?: string | null;
          start_time?: string;
          next_day_mode?: NextDayMode;
          interval_minutes?: number | null;
          is_active?: boolean;
          time?: string | null;
          taken?: boolean;
          taken_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      schedule_doses: {
        Row: {
          id: string;
          medication_id: string;
          time: string;
          label: string;
          taken: boolean;
          taken_at: string | null;
          dose_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          medication_id: string;
          time: string;
          label: string;
          taken?: boolean;
          taken_at?: string | null;
          dose_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          medication_id?: string;
          time?: string;
          label?: string;
          taken?: boolean;
          taken_at?: string | null;
          dose_order?: number;
          created_at?: string;
        };
      };
      dose_history: {
        Row: {
          id: string;
          user_id: string;
          medication_id: string;
          dose_id: string | null;
          scheduled_time: string;
          scheduled_date: string;
          taken_at: string | null;
          status: DoseStatus;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          medication_id: string;
          dose_id?: string | null;
          scheduled_time: string;
          scheduled_date: string;
          taken_at?: string | null;
          status?: DoseStatus;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          medication_id?: string;
          dose_id?: string | null;
          scheduled_time?: string;
          scheduled_date?: string;
          taken_at?: string | null;
          status?: DoseStatus;
          notes?: string | null;
          created_at?: string;
        };
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Medication = Database["public"]["Tables"]["medications"]["Row"];
export type InsertMedication =
  Database["public"]["Tables"]["medications"]["Insert"];
export type UpdateMedication =
  Database["public"]["Tables"]["medications"]["Update"];
export type ScheduleDose =
  Database["public"]["Tables"]["schedule_doses"]["Row"];
export type InsertScheduleDose =
  Database["public"]["Tables"]["schedule_doses"]["Insert"];
export type DoseHistory = Database["public"]["Tables"]["dose_history"]["Row"];
export type InsertDoseHistory =
  Database["public"]["Tables"]["dose_history"]["Insert"];

// Subscription types
export type SubscriptionTierDb = "free" | "pro" | "enterprise";
export type SubscriptionStatusDb =
  | "active"
  | "cancelled"
  | "past_due"
  | "trialing"
  | "expired";

export interface DbSubscription {
  id: string;
  user_id: string;
  tier: SubscriptionTierDb;
  status: SubscriptionStatusDb;
  current_period_start: string;
  current_period_end: string | null;
  payrex_checkout_id: string | null;
  payrex_payment_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbPaymentHistory {
  id: string;
  user_id: string;
  subscription_id: string | null;
  amount: number;
  currency: string;
  status: "pending" | "completed" | "failed" | "refunded";
  payrex_checkout_id: string | null;
  payrex_payment_id: string | null;
  payment_method: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ============================================
// PATIENT-COMPANION LINKING
// ============================================

export type LinkStatus = "pending" | "accepted" | "rejected";

export interface PatientCompanion {
  id: string;
  patient_id: string;
  companion_id: string;
  status: LinkStatus;
  created_at: string;
  accepted_at: string | null;
}

export interface InsertPatientCompanion {
  id?: string;
  patient_id: string;
  companion_id: string;
  status?: LinkStatus;
  created_at?: string;
  accepted_at?: string | null;
}

export interface UpdatePatientCompanion {
  id?: string;
  patient_id?: string;
  companion_id?: string;
  status?: LinkStatus;
  accepted_at?: string | null;
}

// Enriched types for UI
export interface LinkedPatient extends PatientCompanion {
  patient_profile: Profile;
}

export interface LinkedCompanion extends PatientCompanion {
  companion_profile: Profile;
}

// Patient data as seen by companion
export interface PatientData {
  profile: Profile;
  medications: Medication[];
  linkInfo: PatientCompanion;
}