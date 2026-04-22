-- =============================================================================
-- Fix signup when Auth logs show:
--   ERROR: column "contact_number" of relation "profiles" does not exist
--
-- Your project has a trigger/function on auth.users (or elsewhere) that INSERTs
-- into public.profiles using columns that are not in the minimal table. Adding
-- these nullable columns satisfies that SQL without changing app behavior.
--
-- Run once in Supabase SQL Editor, then try sign up again.
-- =============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS contact_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- If logs mention another missing column, add it the same way, e.g.:
-- ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
