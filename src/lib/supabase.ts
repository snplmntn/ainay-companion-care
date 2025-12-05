import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Minimal type definition for our tables
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          name: string;
          role: "patient" | "companion";
          link_code: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name: string;
          role: "patient" | "companion";
          link_code?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string;
          role?: "patient" | "companion";
          link_code?: string | null;
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
          category: string;
          instructions: string | null;
          image_url: string | null;
          frequency: string;
          custom_frequency: number | null;
          time_period: string;
          start_time: string;
          next_day_mode: string;
          interval_minutes: number | null;
          is_active: boolean;
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
          category?: string;
          instructions?: string | null;
          image_url?: string | null;
          frequency?: string;
          custom_frequency?: number | null;
          time_period?: string;
          start_time?: string;
          next_day_mode?: string;
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
          category?: string;
          instructions?: string | null;
          image_url?: string | null;
          frequency?: string;
          custom_frequency?: number | null;
          time_period?: string;
          start_time?: string;
          next_day_mode?: string;
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
          status: string;
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
          status?: string;
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
          status?: string;
          notes?: string | null;
          created_at?: string;
        };
      };
      patient_companions: {
        Row: {
          id: string;
          patient_id: string;
          companion_id: string;
          status: string;
          created_at: string;
          accepted_at: string | null;
        };
        Insert: {
          id?: string;
          patient_id: string;
          companion_id: string;
          status?: string;
          created_at?: string;
          accepted_at?: string | null;
        };
        Update: {
          id?: string;
          patient_id?: string;
          companion_id?: string;
          status?: string;
          created_at?: string;
          accepted_at?: string | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

// Type aliases for convenience
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
export type PatientCompanion =
  Database["public"]["Tables"]["patient_companions"]["Row"];

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

// Check if Supabase is properly configured with valid URLs
const isValidUrl = (url: string | undefined): url is string => {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && url.includes("supabase.co");
  } catch {
    return false;
  }
};

export const isSupabaseConfigured =
  isValidUrl(supabaseUrl) && !!supabaseAnonKey && supabaseAnonKey.length > 20;

if (!isSupabaseConfigured) {
  console.warn(
    "⚠️ Supabase not configured. Running in demo mode.\n" +
      "To enable auth & data persistence, add your Supabase credentials to .env.local:\n" +
      "  VITE_SUPABASE_URL=https://your-project.supabase.co\n" +
      "  VITE_SUPABASE_ANON_KEY=your-anon-key"
  );
}

// Create a dummy URL for when Supabase is not configured (client will error but app works in demo mode)
const fallbackUrl = "https://placeholder.supabase.co";
const fallbackKey = "placeholder-key";

// Always create the client - in demo mode it won't be used but TypeScript is happy
export const supabase: SupabaseClient<Database> = createClient<Database>(
  supabaseUrl || fallbackUrl,
  supabaseAnonKey || fallbackKey
);
