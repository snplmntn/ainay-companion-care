-- ============================================
-- Migration: Add Telegram Notification Type
-- Purpose: Add 'missed_medication_telegram' to allowed notification types
-- Run this SQL in your Supabase SQL Editor
-- ============================================

-- Drop the existing check constraint
ALTER TABLE public.notification_history 
DROP CONSTRAINT IF EXISTS notification_history_type_check;

-- Add the new check constraint with telegram type included
ALTER TABLE public.notification_history 
ADD CONSTRAINT notification_history_type_check 
CHECK (type IN (
  'missed_medication',              -- Legacy/generic missed medication
  'missed_medication_push_first',   -- First push notification (30 sec)
  'missed_medication_push_second',  -- Second push notification (1 min)
  'missed_medication_telegram',     -- Telegram notification (1.5 min)
  'missed_medication_email',        -- Email notification (3 min)
  'medication_reminder',            -- Upcoming dose reminder to patient
  'low_adherence',                  -- Low adherence warning
  'daily_summary',                  -- Daily adherence summary
  'link_request'                    -- Patient-companion link request
));

-- Update the column comment
COMMENT ON COLUMN public.notification_history.type IS 
'Notification types:
- missed_medication: Legacy/generic missed medication alert
- missed_medication_push_first: First push notification (sent at 30 seconds)
- missed_medication_push_second: Second push notification (sent at 1 minute)
- missed_medication_telegram: Telegram notification (sent at 1.5 minutes)
- missed_medication_email: Email notification (sent at 3 minutes)
- medication_reminder: Upcoming dose reminder sent to patient
- low_adherence: Low adherence warning
- daily_summary: Daily adherence summary report
- link_request: Patient-companion link request notification';

-- ============================================
-- VERIFICATION QUERY
-- ============================================
-- Run this to verify the constraint was updated:
-- SELECT conname, pg_get_constraintdef(oid) 
-- FROM pg_constraint 
-- WHERE conrelid = 'public.notification_history'::regclass 
-- AND contype = 'c';


