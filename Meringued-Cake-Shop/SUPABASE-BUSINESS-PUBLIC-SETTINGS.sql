-- Public business settings (shop phone, address, hours, etc.) for customer POS / site.
-- Run in Supabase SQL Editor once.
--
-- Admin write policy uses public.is_admin() (reads profiles.role), not JWT user_metadata.
-- That avoids Security Advisor: "RLS references user_metadata" and is safer: user_metadata
-- can be changed by the user via auth.updateUser; role should come from public.profiles.
--
-- Requires public.is_admin() from SUPABASE-PROFILES-ORDERS-RLS-FIX.sql. If you do not have it yet,
-- run that file first (or paste the is_admin() function from there), then re-run the policy block below.

CREATE TABLE IF NOT EXISTS business_public_settings (
  id int PRIMARY KEY DEFAULT 1,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_public_settings_single_row CHECK (id = 1)
);

INSERT INTO business_public_settings (id, settings)
VALUES (1, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE business_public_settings ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous customers) can read — needed for POS pickup phone.
CREATE POLICY "business_public_settings_select_anon"
  ON business_public_settings
  FOR SELECT
  USING (true);

-- Only admins (profiles.role via is_admin — not user_metadata) can insert/update/delete
DROP POLICY IF EXISTS "business_public_settings_admin_write" ON public.business_public_settings;
CREATE POLICY "business_public_settings_admin_write"
  ON public.business_public_settings
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
