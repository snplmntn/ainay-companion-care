-- ============================================
-- Add Telegram Support Migration
-- ============================================
-- Adds Telegram chat ID fields to profiles
-- and creates a table for temporary link codes

-- Add Telegram fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT,
ADD COLUMN IF NOT EXISTS telegram_username TEXT,
ADD COLUMN IF NOT EXISTS telegram_linked_at TIMESTAMPTZ;

-- Create index for faster lookups by chat ID
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_chat_id 
ON public.profiles(telegram_chat_id) 
WHERE telegram_chat_id IS NOT NULL;

-- ============================================
-- TELEGRAM LINK CODES TABLE
-- ============================================
-- Temporary codes for linking Telegram accounts
-- Codes expire after 10 minutes

CREATE TABLE IF NOT EXISTS public.telegram_link_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for code lookup
CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_code 
ON public.telegram_link_codes(code);

-- Index for cleanup of expired codes
CREATE INDEX IF NOT EXISTS idx_telegram_link_codes_expires 
ON public.telegram_link_codes(expires_at);

-- Enable RLS
ALTER TABLE public.telegram_link_codes ENABLE ROW LEVEL SECURITY;

-- Users can only see/manage their own link codes
DROP POLICY IF EXISTS "Users can manage their own link codes" ON public.telegram_link_codes;
CREATE POLICY "Users can manage their own link codes"
  ON public.telegram_link_codes
  FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- CLEANUP FUNCTION
-- ============================================
-- Function to clean up expired link codes

CREATE OR REPLACE FUNCTION public.cleanup_expired_telegram_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM public.telegram_link_codes
  WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- UPDATE NOTIFICATION HISTORY
-- ============================================
-- Ensure 'telegram' is a valid channel option
-- (Already exists in schema, but let's make sure the constraint is correct)

-- First, check if the constraint exists and update if needed
DO $$ 
BEGIN
  -- Drop old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'notification_history_channel_check'
    AND table_name = 'notification_history'
  ) THEN
    ALTER TABLE public.notification_history DROP CONSTRAINT notification_history_channel_check;
  END IF;
  
  -- Add updated constraint with all channels
  ALTER TABLE public.notification_history 
  ADD CONSTRAINT notification_history_channel_check 
  CHECK (channel IN ('email', 'telegram', 'discord', 'push', 'sms'));
EXCEPTION
  WHEN others THEN
    -- Constraint might not exist or already be correct
    NULL;
END $$;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

-- Grant execute on cleanup function
GRANT EXECUTE ON FUNCTION public.cleanup_expired_telegram_codes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_telegram_codes() TO service_role;


