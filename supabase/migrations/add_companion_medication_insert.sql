-- ============================================
-- Add RLS policies for companions to add medications for their linked patients
-- ============================================

-- Allow companions to insert medications for their linked patients
DROP POLICY IF EXISTS "Companions can insert medications for linked patients" ON public.medications;
CREATE POLICY "Companions can insert medications for linked patients"
  ON public.medications
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.patient_companions pc
      WHERE pc.patient_id = user_id
      AND pc.companion_id = auth.uid()
      AND pc.status = 'accepted'
    )
  );

-- Allow companions to update medications for their linked patients
DROP POLICY IF EXISTS "Companions can update medications for linked patients" ON public.medications;
CREATE POLICY "Companions can update medications for linked patients"
  ON public.medications
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.patient_companions pc
      WHERE pc.patient_id = medications.user_id
      AND pc.companion_id = auth.uid()
      AND pc.status = 'accepted'
    )
  );

-- Allow companions to insert schedule_doses for their linked patients' medications
DROP POLICY IF EXISTS "Companions can insert doses for linked patients" ON public.schedule_doses;
CREATE POLICY "Companions can insert doses for linked patients"
  ON public.schedule_doses
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.medications m
      JOIN public.patient_companions pc ON pc.patient_id = m.user_id
      WHERE m.id = medication_id
      AND pc.companion_id = auth.uid()
      AND pc.status = 'accepted'
    )
  );

-- Allow companions to update schedule_doses for their linked patients' medications
DROP POLICY IF EXISTS "Companions can update doses for linked patients" ON public.schedule_doses;
CREATE POLICY "Companions can update doses for linked patients"
  ON public.schedule_doses
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.medications m
      JOIN public.patient_companions pc ON pc.patient_id = m.user_id
      WHERE m.id = schedule_doses.medication_id
      AND pc.companion_id = auth.uid()
      AND pc.status = 'accepted'
    )
  );


