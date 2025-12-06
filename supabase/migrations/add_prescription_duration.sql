-- ============================================
-- Migration: Add Prescription Duration Fields
-- ============================================
-- This migration adds start_date and end_date columns to the medications table
-- to support prescription duration tracking.
-- 
-- Run this SQL in your Supabase SQL Editor if you have an existing database.
-- New databases using schema.sql will already have these fields.

-- Add start_date column (defaults to current date)
ALTER TABLE public.medications 
ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT CURRENT_DATE;

-- Add end_date column (nullable for ongoing prescriptions)
ALTER TABLE public.medications 
ADD COLUMN IF NOT EXISTS end_date DATE;

-- Update comment on time_period to clarify the expected values
COMMENT ON COLUMN public.medications.time_period IS 'Duration in days (e.g., "7", "14", "30") or "ongoing" for no end date';
COMMENT ON COLUMN public.medications.start_date IS 'When the prescription starts (defaults to creation date)';
COMMENT ON COLUMN public.medications.end_date IS 'When the prescription ends (NULL for ongoing prescriptions)';

-- Optional: Backfill existing medications with start_date based on created_at
-- Uncomment the following if you want to set start_date for existing records:
-- UPDATE public.medications 
-- SET start_date = created_at::date 
-- WHERE start_date IS NULL;

-- Create an index on end_date for faster queries on expiring prescriptions
CREATE INDEX IF NOT EXISTS idx_medications_end_date ON public.medications(end_date) WHERE end_date IS NOT NULL;

-- Create an index on is_active and end_date for finding active medications that are expiring
CREATE INDEX IF NOT EXISTS idx_medications_active_end_date ON public.medications(is_active, end_date) 
WHERE is_active = TRUE AND end_date IS NOT NULL;


