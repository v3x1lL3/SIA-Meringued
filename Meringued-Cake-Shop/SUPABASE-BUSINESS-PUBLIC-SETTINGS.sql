-- Public business settings (shop phone, address, hours, etc.) for customer POS / site.
-- Run in Supabase SQL Editor once.

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

-- Only admins (role in JWT user_metadata) can insert/update/delete
CREATE POLICY "business_public_settings_admin_write"
  ON business_public_settings
  FOR ALL
  USING (
    coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'admin'
  )
  WITH CHECK (
    coalesce((auth.jwt() -> 'user_metadata' ->> 'role'), '') = 'admin'
  );
