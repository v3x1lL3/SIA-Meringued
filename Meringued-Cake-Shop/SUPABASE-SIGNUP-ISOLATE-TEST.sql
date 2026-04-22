-- =============================================================================
-- ISOLATE: Is signup failing because of a trigger on auth.users?
--
-- IMPORTANT: Running ONLY the SELECT below does NOT fix or change signup.
--            It only lists triggers. You must also run the DROP (or use the
--            split files: SUPABASE-SIGNUP-ISOLATE-1-LIST-TRIGGERS.sql and
--            SUPABASE-SIGNUP-ISOLATE-2-DROP-MERINGUED-TRIGGER.sql).
-- =============================================================================

-- STEP A — Diagnostic only (no behavior change):
SELECT t.tgname AS trigger_name,
       pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'auth'
  AND c.relname = 'users'
  AND NOT t.tgisinternal
ORDER BY t.tgname;

-- STEP B — Actually removes our trigger so you can test signup:
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Now try Customer Sign Up in the browser ONCE with a NEW email.
--
-- • If signup SUCCEEDS and you see the new user under Authentication → Users:
--   the problem WAS this trigger (or a conflict with another trigger). Run
--   SUPABASE-SIGNUP-REPAIR-STANDALONE.sql again from the "CREATE OR REPLACE
--   FUNCTION handle_new_user" part downward — or paste the trigger block from
--   SUPABASE-PROFILES-ORDERS-RLS-FIX.sql section 4.
--
-- • If signup STILL FAILS the same way:
--   the problem is NOT this trigger. Stop changing SQL. In the dashboard open
--   Logs → Auth and Logs → Postgres, trigger one signup, and read the FIRST
--   error line (copy it). Also disable Authentication → Hooks completely.
--
-- STEP C — After a successful test WITHOUT trigger, you MUST put a working
-- trigger back or insert profiles manually; the app expects public.profiles.
-- Use SUPABASE-SIGNUP-REPAIR-STANDALONE.sql for that.
-- =============================================================================
