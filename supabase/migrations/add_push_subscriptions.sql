-- ============================================
-- Push Subscriptions Table
-- Stores web push notification subscriptions for companions
-- ============================================

-- Create push_subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Each endpoint should be unique per user
  UNIQUE(user_id, endpoint)
);

-- Create index for faster lookups by user_id
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- Enable RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own subscriptions
CREATE POLICY "Users can manage their own push subscriptions"
  ON push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Service role can manage all subscriptions (for server-side operations)
CREATE POLICY "Service role can manage all push subscriptions"
  ON push_subscriptions
  FOR ALL
  USING (auth.role() = 'service_role');

-- Add comment
COMMENT ON TABLE push_subscriptions IS 'Stores web push notification subscriptions for browser notifications';


