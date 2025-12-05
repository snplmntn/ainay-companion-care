-- ============================================
-- Add Notification Preferences to Profiles
-- ============================================

-- Add notification preference columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email_reminder_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS email_reminder_minutes INTEGER DEFAULT 5;

-- Comment for documentation
COMMENT ON COLUMN public.profiles.email_reminder_enabled IS 'Whether to send email reminders before medication intake';
COMMENT ON COLUMN public.profiles.email_reminder_minutes IS 'Minutes before scheduled medication time to send reminder (default: 5)';

