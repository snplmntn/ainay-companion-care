-- ============================================
-- AInay Companion Care - Supabase Schema
-- ============================================
-- Run this SQL in your Supabase SQL Editor to set up the database

-- Enable UUID extension (usually already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CUSTOM TYPES
-- ============================================

DO $$ BEGIN
  CREATE TYPE medication_category AS ENUM ('medicine', 'vitamin', 'supplement', 'herbal', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE frequency_type AS ENUM ('once_daily', 'twice_daily', 'three_times_daily', 'four_times_daily', 'every_other_day', 'weekly', 'as_needed', 'custom');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE next_day_mode AS ENUM ('restart', 'continue');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE dose_status AS ENUM ('pending', 'taken', 'missed', 'skipped');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE link_status AS ENUM ('pending', 'accepted', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- PROFILES TABLE
-- ============================================
-- Stores user profile information linked to auth.users

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('patient', 'companion')),
  link_code TEXT UNIQUE, -- Unique code for patients to share with companions
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Basic policies for profiles (companion access policy added after patient_companions table)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================
-- PATIENT-COMPANION LINKS TABLE
-- ============================================
-- Links patients with their companions/caregivers
-- Note: Links are auto-accepted when companion enters patient's link code

CREATE TABLE IF NOT EXISTS public.patient_companions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(patient_id, companion_id)
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_patient_companions_patient ON public.patient_companions(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_companions_companion ON public.patient_companions(companion_id);

-- Enable RLS
ALTER TABLE public.patient_companions ENABLE ROW LEVEL SECURITY;

-- Patients can view their own links
DROP POLICY IF EXISTS "Patients can view their links" ON public.patient_companions;
CREATE POLICY "Patients can view their links"
  ON public.patient_companions
  FOR SELECT
  USING (auth.uid() = patient_id);

-- Companions can view their links
DROP POLICY IF EXISTS "Companions can view their links" ON public.patient_companions;
CREATE POLICY "Companions can view their links"
  ON public.patient_companions
  FOR SELECT
  USING (auth.uid() = companion_id);

-- Companions can create link requests
DROP POLICY IF EXISTS "Companions can create link requests" ON public.patient_companions;
CREATE POLICY "Companions can create link requests"
  ON public.patient_companions
  FOR INSERT
  WITH CHECK (auth.uid() = companion_id);

-- Patients can update link status (for removing links)
DROP POLICY IF EXISTS "Patients can update link status" ON public.patient_companions;
CREATE POLICY "Patients can update link status"
  ON public.patient_companions
  FOR UPDATE
  USING (auth.uid() = patient_id);

-- Companions can also update links they created
DROP POLICY IF EXISTS "Companions can update their links" ON public.patient_companions;
CREATE POLICY "Companions can update their links"
  ON public.patient_companions
  FOR UPDATE
  USING (auth.uid() = companion_id);

-- Either party can delete the link
DROP POLICY IF EXISTS "Either party can delete link" ON public.patient_companions;
CREATE POLICY "Either party can delete link"
  ON public.patient_companions
  FOR DELETE
  USING (auth.uid() = patient_id OR auth.uid() = companion_id);

-- NOW add companion access policy for profiles (after patient_companions exists)
DROP POLICY IF EXISTS "Companions can view linked patient profiles" ON public.profiles;
CREATE POLICY "Companions can view linked patient profiles"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.patient_companions pc
      WHERE pc.patient_id = profiles.id
      AND pc.companion_id = auth.uid()
      AND pc.status = 'accepted'
    )
  );

-- ============================================
-- FUNCTION: Find patient by link code (bypasses RLS)
-- ============================================
-- This function allows companions to find patients by link code
-- without exposing all patient profiles

CREATE OR REPLACE FUNCTION public.find_patient_by_link_code(p_link_code TEXT)
RETURNS TABLE(
  patient_id UUID,
  patient_name TEXT,
  patient_email TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.email
  FROM public.profiles p
  WHERE p.link_code = UPPER(p_link_code)
    AND p.role = 'patient';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.find_patient_by_link_code(TEXT) TO authenticated;

-- ============================================
-- MEDICATIONS TABLE
-- ============================================
-- Stores medication reminders for users

CREATE TABLE IF NOT EXISTS public.medications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'medicine' CHECK (category IN ('medicine', 'vitamin', 'supplement', 'herbal', 'other')),
  instructions TEXT,
  image_url TEXT, -- Base64 or URL to medicine photo
  frequency TEXT NOT NULL DEFAULT 'once_daily' CHECK (frequency IN ('once_daily', 'twice_daily', 'three_times_daily', 'four_times_daily', 'every_other_day', 'weekly', 'as_needed', 'custom')),
  custom_frequency INTEGER, -- Custom interval in hours
  time_period TEXT DEFAULT 'ongoing', -- e.g., "7", "14", "30", "60", "90", "ongoing" (days or ongoing)
  start_date DATE DEFAULT CURRENT_DATE, -- When the prescription starts
  end_date DATE, -- When the prescription ends (NULL for ongoing)
  start_time TEXT DEFAULT '08:00 AM', -- First dose time
  next_day_mode TEXT DEFAULT 'restart' CHECK (next_day_mode IN ('restart', 'continue')),
  interval_minutes INTEGER, -- Computed interval between doses
  is_active BOOLEAN DEFAULT TRUE,
  -- Legacy single-dose fields (for backward compatibility)
  time TEXT, -- Stored as string like "08:00 AM"
  taken BOOLEAN DEFAULT FALSE,
  taken_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries by user
CREATE INDEX IF NOT EXISTS idx_medications_user_id ON public.medications(user_id);

-- Enable RLS
ALTER TABLE public.medications ENABLE ROW LEVEL SECURITY;

-- Policies for medications
DROP POLICY IF EXISTS "Users can view their own medications" ON public.medications;
CREATE POLICY "Users can view their own medications"
  ON public.medications
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own medications" ON public.medications;
CREATE POLICY "Users can insert their own medications"
  ON public.medications
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own medications" ON public.medications;
CREATE POLICY "Users can update their own medications"
  ON public.medications
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own medications" ON public.medications;
CREATE POLICY "Users can delete their own medications"
  ON public.medications
  FOR DELETE
  USING (auth.uid() = user_id);

-- Companions can view linked patient medications
DROP POLICY IF EXISTS "Companions can view linked patient medications" ON public.medications;
CREATE POLICY "Companions can view linked patient medications"
  ON public.medications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.patient_companions pc
      WHERE pc.patient_id = medications.user_id
      AND pc.companion_id = auth.uid()
      AND pc.status = 'accepted'
    )
  );

-- ============================================
-- SCHEDULE DOSES TABLE
-- ============================================
-- Stores individual doses for multi-dose medications

CREATE TABLE IF NOT EXISTS public.schedule_doses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  medication_id UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  time TEXT NOT NULL, -- Time of day like "08:00 AM"
  label TEXT NOT NULL DEFAULT 'Dose', -- e.g., "Morning", "Afternoon"
  taken BOOLEAN DEFAULT FALSE,
  taken_at TIMESTAMPTZ,
  dose_order INTEGER DEFAULT 1, -- Order of dose in day (1, 2, 3...)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_doses_medication ON public.schedule_doses(medication_id);

ALTER TABLE public.schedule_doses ENABLE ROW LEVEL SECURITY;

-- Users can manage doses for their medications
DROP POLICY IF EXISTS "Users can view their doses" ON public.schedule_doses;
CREATE POLICY "Users can view their doses"
  ON public.schedule_doses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.medications m
      WHERE m.id = schedule_doses.medication_id
      AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage their doses" ON public.schedule_doses;
CREATE POLICY "Users can manage their doses"
  ON public.schedule_doses
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.medications m
      WHERE m.id = schedule_doses.medication_id
      AND m.user_id = auth.uid()
    )
  );

-- Companions can view linked patient doses
DROP POLICY IF EXISTS "Companions can view linked patient doses" ON public.schedule_doses;
CREATE POLICY "Companions can view linked patient doses"
  ON public.schedule_doses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.medications m
      JOIN public.patient_companions pc ON pc.patient_id = m.user_id
      WHERE m.id = schedule_doses.medication_id
      AND pc.companion_id = auth.uid()
      AND pc.status = 'accepted'
    )
  );

-- ============================================
-- DOSE HISTORY TABLE
-- ============================================
-- Tracks historical dose-taking for adherence analytics

CREATE TABLE IF NOT EXISTS public.dose_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medication_id UUID NOT NULL REFERENCES public.medications(id) ON DELETE CASCADE,
  dose_id UUID REFERENCES public.schedule_doses(id) ON DELETE SET NULL,
  scheduled_time TEXT NOT NULL,
  scheduled_date DATE NOT NULL DEFAULT CURRENT_DATE,
  taken_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'taken', 'missed', 'skipped')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dose_history_user ON public.dose_history(user_id);
CREATE INDEX IF NOT EXISTS idx_dose_history_medication ON public.dose_history(medication_id);
CREATE INDEX IF NOT EXISTS idx_dose_history_date ON public.dose_history(scheduled_date);

ALTER TABLE public.dose_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their dose history" ON public.dose_history;
CREATE POLICY "Users can manage their dose history"
  ON public.dose_history
  FOR ALL
  USING (auth.uid() = user_id);

-- Companions can view linked patient dose history
DROP POLICY IF EXISTS "Companions can view linked patient history" ON public.dose_history;
CREATE POLICY "Companions can view linked patient history"
  ON public.dose_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.patient_companions pc
      WHERE pc.patient_id = dose_history.user_id
      AND pc.companion_id = auth.uid()
      AND pc.status = 'accepted'
    )
  );

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for profiles
DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Trigger for medications
DROP TRIGGER IF EXISTS set_medications_updated_at ON public.medications;
CREATE TRIGGER set_medications_updated_at
  BEFORE UPDATE ON public.medications
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Function to generate unique link code for patients
CREATE OR REPLACE FUNCTION public.generate_link_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- ============================================
-- This function automatically creates a profile when a user signs up

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_link_code TEXT;
BEGIN
  -- Generate unique link code for patients
  IF COALESCE(NEW.raw_user_meta_data->>'role', 'patient') = 'patient' THEN
    LOOP
      new_link_code := public.generate_link_code();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE link_code = new_link_code);
    END LOOP;
  END IF;

  INSERT INTO public.profiles (id, email, name, role, link_code)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient'),
    new_link_code
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to run on new user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to compute dose times based on frequency
CREATE OR REPLACE FUNCTION public.compute_dose_times(
  p_start_time TEXT,
  p_frequency TEXT,
  p_custom_hours INTEGER DEFAULT NULL
)
RETURNS TABLE(dose_time TEXT, dose_label TEXT, dose_order INTEGER) AS $$
DECLARE
  start_hour INTEGER;
  start_min INTEGER;
  interval_hours INTEGER;
  current_hour INTEGER;
  dose_count INTEGER := 1;
  labels TEXT[] := ARRAY['Morning', 'Midday', 'Afternoon', 'Evening'];
BEGIN
  -- Parse start time (format: "HH:MM AM/PM" or "HH:MM")
  start_hour := CASE 
    WHEN p_start_time LIKE '%PM%' AND split_part(p_start_time, ':', 1)::INTEGER != 12 
      THEN split_part(p_start_time, ':', 1)::INTEGER + 12
    WHEN p_start_time LIKE '%AM%' AND split_part(p_start_time, ':', 1)::INTEGER = 12 
      THEN 0
    ELSE split_part(p_start_time, ':', 1)::INTEGER
  END;
  start_min := split_part(split_part(p_start_time, ':', 2), ' ', 1)::INTEGER;
  
  -- Determine interval and count based on frequency
  CASE p_frequency
    WHEN 'once_daily' THEN
      RETURN QUERY SELECT p_start_time, 'Daily'::TEXT, 1;
      RETURN;
    WHEN 'twice_daily' THEN
      interval_hours := 12;
    WHEN 'three_times_daily' THEN
      interval_hours := 8;
    WHEN 'four_times_daily' THEN
      interval_hours := 6;
    WHEN 'custom' THEN
      interval_hours := COALESCE(p_custom_hours, 8);
    ELSE
      RETURN QUERY SELECT p_start_time, 'Daily'::TEXT, 1;
      RETURN;
  END CASE;
  
  -- Generate dose times
  current_hour := start_hour;
  WHILE current_hour < 24 AND dose_count <= 4 LOOP
    RETURN QUERY SELECT 
      TO_CHAR(TO_TIMESTAMP(current_hour || ':' || LPAD(start_min::TEXT, 2, '0'), 'HH24:MI'), 'HH:MI AM')::TEXT,
      labels[dose_count],
      dose_count;
    current_hour := current_hour + interval_hours;
    dose_count := dose_count + 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- VIEW: Companion's Patient Summary
-- ============================================

CREATE OR REPLACE VIEW public.companion_patient_summary AS
SELECT 
  pc.companion_id,
  pc.patient_id,
  p.name AS patient_name,
  p.email AS patient_email,
  pc.status AS link_status,
  pc.created_at AS linked_at,
  pc.accepted_at,
  (
    SELECT COUNT(*) FROM public.medications m 
    WHERE m.user_id = pc.patient_id AND m.is_active = TRUE
  ) AS active_medications,
  (
    SELECT COUNT(*) FROM public.medications m 
    WHERE m.user_id = pc.patient_id AND m.taken = TRUE
  ) AS taken_today,
  (
    SELECT MAX(m.updated_at) FROM public.medications m 
    WHERE m.user_id = pc.patient_id
  ) AS last_activity
FROM public.patient_companions pc
JOIN public.profiles p ON p.id = pc.patient_id;

-- ============================================
-- SUBSCRIPTIONS TABLE
-- ============================================
-- Stores subscription information for freemium model

DO $$ BEGIN
  CREATE TYPE subscription_tier AS ENUM ('free', 'pro', 'enterprise');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('active', 'cancelled', 'past_due', 'trialing', 'expired');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing', 'expired')),
  current_period_start TIMESTAMPTZ DEFAULT NOW(),
  current_period_end TIMESTAMPTZ,
  payrex_checkout_id TEXT,
  payrex_payment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id) -- One subscription per user
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tier ON public.subscriptions(tier);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscription
DROP POLICY IF EXISTS "Users can view their subscription" ON public.subscriptions;
CREATE POLICY "Users can view their subscription"
  ON public.subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own subscription
DROP POLICY IF EXISTS "Users can insert their subscription" ON public.subscriptions;
CREATE POLICY "Users can insert their subscription"
  ON public.subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own subscription
DROP POLICY IF EXISTS "Users can update their subscription" ON public.subscriptions;
CREATE POLICY "Users can update their subscription"
  ON public.subscriptions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS set_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER set_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- PAYMENT HISTORY TABLE
-- ============================================
-- Tracks all payment transactions

CREATE TABLE IF NOT EXISTS public.payment_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL, -- Amount in centavos
  currency TEXT DEFAULT 'PHP',
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  payrex_checkout_id TEXT,
  payrex_payment_id TEXT,
  payment_method TEXT,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_history_user ON public.payment_history(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_subscription ON public.payment_history(subscription_id);

ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

-- Users can view their payment history
DROP POLICY IF EXISTS "Users can view their payment history" ON public.payment_history;
CREATE POLICY "Users can view their payment history"
  ON public.payment_history
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert payment history (for tracking checkout attempts)
DROP POLICY IF EXISTS "Users can insert payment history" ON public.payment_history;
CREATE POLICY "Users can insert payment history"
  ON public.payment_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- AUTO-CREATE FREE SUBSCRIPTION ON SIGNUP
-- ============================================
-- Modify the handle_new_user function to also create a free subscription

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_link_code TEXT;
BEGIN
  -- Generate unique link code for patients
  IF COALESCE(NEW.raw_user_meta_data->>'role', 'patient') = 'patient' THEN
    LOOP
      new_link_code := public.generate_link_code();
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE link_code = new_link_code);
    END LOOP;
  END IF;

  -- Create profile
  INSERT INTO public.profiles (id, email, name, role, link_code)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient'),
    new_link_code
  );

  -- Create free subscription
  INSERT INTO public.subscriptions (user_id, tier, status)
  VALUES (NEW.id, 'free', 'active');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- NOTIFICATION HISTORY TABLE
-- ============================================
-- Tracks all notifications sent to companions for missed medications

CREATE TABLE IF NOT EXISTS public.notification_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medication_id UUID REFERENCES public.medications(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('missed_medication', 'low_adherence', 'daily_summary', 'link_request')),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'telegram', 'discord', 'push')),
  recipient_email TEXT,
  message TEXT NOT NULL,
  scheduled_time TEXT, -- The scheduled medication time
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'pending')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_notification_history_patient ON public.notification_history(patient_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_companion ON public.notification_history(companion_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_medication ON public.notification_history(medication_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_sent_at ON public.notification_history(sent_at);
CREATE INDEX IF NOT EXISTS idx_notification_history_type ON public.notification_history(type);

-- Enable RLS
ALTER TABLE public.notification_history ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can do everything (for backend server)
-- Note: The backend uses the service role key which bypasses RLS

-- Policy: Companions can view notifications they received
DROP POLICY IF EXISTS "Companions can view their notifications" ON public.notification_history;
CREATE POLICY "Companions can view their notifications"
  ON public.notification_history
  FOR SELECT
  USING (auth.uid() = companion_id);

-- Policy: Patients can view notifications sent about them
DROP POLICY IF EXISTS "Patients can view their notifications" ON public.notification_history;
CREATE POLICY "Patients can view their notifications"
  ON public.notification_history
  FOR SELECT
  USING (auth.uid() = patient_id);

-- ============================================
-- SAMPLE DATA (optional - for testing)
-- ============================================
-- Uncomment to insert sample medications for testing
-- Replace 'YOUR_USER_ID' with an actual user UUID

/*
INSERT INTO public.medications (user_id, name, dosage, category, frequency, start_time, time, instructions)
VALUES 
  ('YOUR_USER_ID', 'Metformin', '500mg', 'medicine', 'twice_daily', '8:00 AM', '8:00 AM', 'Take with breakfast'),
  ('YOUR_USER_ID', 'Lisinopril', '10mg', 'medicine', 'once_daily', '9:00 AM', '9:00 AM', 'Take on empty stomach'),
  ('YOUR_USER_ID', 'Vitamin D3', '1000 IU', 'vitamin', 'once_daily', '12:00 PM', '12:00 PM', 'Take with lunch'),
  ('YOUR_USER_ID', 'Fish Oil', '1000mg', 'supplement', 'twice_daily', '8:00 AM', '8:00 AM', 'Take with food'),
  ('YOUR_USER_ID', 'Atorvastatin', '20mg', 'medicine', 'once_daily', '9:00 PM', '9:00 PM', 'Take before bed');
*/
