-- Migration: Allow patients to view their linked companions' profiles
-- This fixes the bug where companion names would show as "Companion" instead of their actual name

-- Allow patients to view their linked companions' profiles
DROP POLICY IF EXISTS "Patients can view linked companion profiles" ON public.profiles;
CREATE POLICY "Patients can view linked companion profiles"
  ON public.profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.patient_companions pc
      WHERE pc.companion_id = profiles.id
      AND pc.patient_id = auth.uid()
      AND pc.status = 'accepted'
    )
  );


