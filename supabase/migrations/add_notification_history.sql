-- ============================================
-- Migration: Add Notification History Table
-- Purpose: Track all notifications sent to companions for missed medications
-- Run this SQL in your Supabase SQL Editor
-- ============================================

-- ============================================
-- NOTIFICATION HISTORY TABLE
-- ============================================
-- Tracks all notifications sent to companions for missed medications

CREATE TABLE IF NOT EXISTS public.notification_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medication_id UUID REFERENCES public.medications(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN (
    'missed_medication',           -- Legacy/generic missed medication
    'missed_medication_push_first', -- First push notification (30 sec)
    'missed_medication_push_second',-- Second push notification (1 min)
    'missed_medication_email',      -- Email notification (3 min)
    'medication_reminder',          -- Upcoming dose reminder to patient
    'low_adherence',                -- Low adherence warning
    'daily_summary',                -- Daily adherence summary
    'link_request'                  -- Patient-companion link request
  )),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'telegram', 'discord', 'push', 'sms')),
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

-- Composite index for checking if notifications were already sent today
CREATE INDEX IF NOT EXISTS idx_notification_history_dedup 
  ON public.notification_history(medication_id, companion_id, type, sent_at);

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
-- COMMENT: Notification Type Descriptions
-- ============================================
COMMENT ON TABLE public.notification_history IS 'Tracks all notifications sent for medication alerts and reminders';
COMMENT ON COLUMN public.notification_history.type IS 
'Notification types:
- missed_medication: Legacy/generic missed medication alert
- missed_medication_push_first: First push notification (sent at 30 seconds)
- missed_medication_push_second: Second push notification (sent at 1 minute)
- missed_medication_email: Email notification (sent at 3 minutes)
- medication_reminder: Upcoming dose reminder sent to patient
- low_adherence: Low adherence warning
- daily_summary: Daily adherence summary report
- link_request: Patient-companion link request notification';

-- ============================================
-- VERIFICATION QUERY
-- ============================================
-- Run this to verify the table was created successfully:
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'notification_history';


