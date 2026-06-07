-- Add flexible user settings JSONB column to profiles
-- Run once in Supabase SQL editor or via: supabase db push

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}';

-- Optional: index for fast reads (not strictly needed for single-user queries)
-- CREATE INDEX IF NOT EXISTS idx_profiles_settings ON public.profiles USING gin(settings);
