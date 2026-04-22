-- =============================================================================
-- Meringued: STANDALONE signup repair (run when Confirm email is OFF but sign up
-- still returns unexpected_failure / Database error saving new user).
--
-- This file does NOT touch `orders` — safe if SUPABASE-PROFILES-ORDERS-RLS-FIX.sql
-- failed partway because `orders` was missing.
--
-- BEFORE running: Dashboard → Authentication → Hooks — disable ALL hooks temporarily
-- (a failing "Before user created" / email hook blocks signup with generic errors).
-- =============================================================================

-- 1) See triggers on auth.users (should be only one "after insert" for profiles, or none)
SELECT t.tgname AS trigger_name,
       pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'auth'
  AND c.relname = 'users'
  AND NOT t.tgisinternal
ORDER BY t.tgname;

-- 2) See profiles columns (if any NOT NULL has no default, trigger INSERT will fail)
SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- 3) Minimal profiles table (adds only what this repo expects)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'customer',
  updated_at timestamptz DEFAULT now()
);

-- Columns some dashboards/triggers expect (avoids "contact_number does not exist" on signup)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS contact_number text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4) is_admin() — required if you use other RLS policies; safe to (re)define here
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.role = 'admin' FROM public.profiles p WHERE p.id = auth.uid()),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- 5) Trigger function: idempotent insert into profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'role'), ''),
      'customer'
    )
  )
  ON CONFLICT (id) DO UPDATE
  SET role = COALESCE(
    NULLIF(EXCLUDED.role, ''),
    NULLIF(public.profiles.role, ''),
    'customer'
  ),
  updated_at = now();
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- 6) Single trigger name used by this project — drop stray duplicates manually if step 1 listed more
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Postgres 14+ prefers FUNCTION; if this line errors, use PROCEDURE instead (see comment below).
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- If you get a syntax error on EXECUTE FUNCTION, comment the block above and use:
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW
--   EXECUTE PROCEDURE public.handle_new_user();

-- 7) RLS: user can read/insert/update own profile (signup + settings)
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Admins can read all profiles v2" ON public.profiles;
CREATE POLICY "Admins can read all profiles v2"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_admin());

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profiles TO authenticated;

-- =============================================================================
-- After running: try sign up again. If it still fails:
-- • Step 1: drop any EXTRA trigger on auth.users (keep only on_auth_user_created).
-- • Step 2: fix or drop NOT NULL columns on profiles that the INSERT doesn't supply.
-- • Logs → Postgres (not only Auth) during a failed signup — copy the exact error.
-- =============================================================================
