-- ============================================
-- GAMIFICATION TRACKING MIGRATION
-- ============================================
-- Adds streak and achievement tracking for gamification

-- Add gamification columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS best_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_victories INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_perfect_date DATE,
ADD COLUMN IF NOT EXISTS streak_updated_at TIMESTAMPTZ;

-- Create index for leaderboard queries (optional future feature)
CREATE INDEX IF NOT EXISTS idx_profiles_streak ON public.profiles(current_streak DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_best_streak ON public.profiles(best_streak DESC);

-- ============================================
-- DAILY ADHERENCE LOG TABLE
-- ============================================
-- Tracks daily adherence for accurate streak calculation

CREATE TABLE IF NOT EXISTS public.daily_adherence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_doses INTEGER NOT NULL DEFAULT 0,
  taken_doses INTEGER NOT NULL DEFAULT 0,
  adherence_rate INTEGER NOT NULL DEFAULT 0,
  is_perfect BOOLEAN NOT NULL DEFAULT FALSE, -- 100% adherence
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_adherence_user ON public.daily_adherence(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_adherence_date ON public.daily_adherence(date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_adherence_perfect ON public.daily_adherence(user_id, is_perfect, date DESC);

ALTER TABLE public.daily_adherence ENABLE ROW LEVEL SECURITY;

-- Users can manage their own adherence data
DROP POLICY IF EXISTS "Users can manage their adherence" ON public.daily_adherence;
CREATE POLICY "Users can manage their adherence"
  ON public.daily_adherence
  FOR ALL
  USING (auth.uid() = user_id);

-- Companions can view linked patient adherence
DROP POLICY IF EXISTS "Companions can view patient adherence" ON public.daily_adherence;
CREATE POLICY "Companions can view patient adherence"
  ON public.daily_adherence
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.patient_companions pc
      WHERE pc.patient_id = daily_adherence.user_id
      AND pc.companion_id = auth.uid()
      AND pc.status = 'accepted'
    )
  );

-- Trigger for updated_at
DROP TRIGGER IF EXISTS set_daily_adherence_updated_at ON public.daily_adherence;
CREATE TRIGGER set_daily_adherence_updated_at
  BEFORE UPDATE ON public.daily_adherence
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- FUNCTION: Update streak on adherence change
-- ============================================
CREATE OR REPLACE FUNCTION public.update_user_streak(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_streak INTEGER := 0;
  v_prev_date DATE;
  v_curr_date DATE;
  rec RECORD;
BEGIN
  -- Calculate current streak by looking at consecutive perfect days
  FOR rec IN 
    SELECT date, is_perfect
    FROM public.daily_adherence
    WHERE user_id = p_user_id
    ORDER BY date DESC
  LOOP
    IF rec.is_perfect THEN
      IF v_prev_date IS NULL OR (v_prev_date - rec.date) = 1 THEN
        v_streak := v_streak + 1;
        v_prev_date := rec.date;
      ELSE
        EXIT; -- Gap in dates, streak broken
      END IF;
    ELSE
      EXIT; -- Non-perfect day, streak broken
    END IF;
  END LOOP;

  -- Update profile with streak info
  UPDATE public.profiles
  SET 
    current_streak = v_streak,
    best_streak = GREATEST(COALESCE(best_streak, 0), v_streak),
    last_perfect_date = v_prev_date,
    streak_updated_at = NOW()
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION: Record daily adherence and update streak
-- ============================================
CREATE OR REPLACE FUNCTION public.record_daily_adherence(
  p_user_id UUID,
  p_date DATE,
  p_total_doses INTEGER,
  p_taken_doses INTEGER
)
RETURNS void AS $$
DECLARE
  v_adherence_rate INTEGER;
  v_is_perfect BOOLEAN;
BEGIN
  -- Calculate adherence rate
  IF p_total_doses > 0 THEN
    v_adherence_rate := ROUND((p_taken_doses::NUMERIC / p_total_doses::NUMERIC) * 100);
  ELSE
    v_adherence_rate := 100; -- No doses = perfect day
  END IF;
  
  v_is_perfect := v_adherence_rate = 100;

  -- Upsert daily adherence record
  INSERT INTO public.daily_adherence (user_id, date, total_doses, taken_doses, adherence_rate, is_perfect)
  VALUES (p_user_id, p_date, p_total_doses, p_taken_doses, v_adherence_rate, v_is_perfect)
  ON CONFLICT (user_id, date) 
  DO UPDATE SET
    total_doses = p_total_doses,
    taken_doses = p_taken_doses,
    adherence_rate = v_adherence_rate,
    is_perfect = v_is_perfect,
    updated_at = NOW();

  -- Update streak if this was a perfect day
  IF v_is_perfect THEN
    -- Increment total victories
    UPDATE public.profiles
    SET total_victories = COALESCE(total_victories, 0) + 1
    WHERE id = p_user_id 
    AND NOT EXISTS (
      SELECT 1 FROM public.daily_adherence 
      WHERE user_id = p_user_id AND date = p_date AND is_perfect = TRUE
    );
  END IF;

  -- Recalculate streak
  PERFORM public.update_user_streak(p_user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.update_user_streak(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_daily_adherence(UUID, DATE, INTEGER, INTEGER) TO authenticated;


