-- =============================================================================
-- Miscellaneous inventory (Admin → Inventory → Miscellaneous)
-- Run this entire file in: Supabase Dashboard → SQL Editor → New query → Run
-- Requires: pgcrypto for gen_random_uuid() (enabled by default on Supabase)
-- =============================================================================

-- 1) Table
create table if not exists public.misc_inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  quantity numeric not null default 0,
  reorder_level numeric not null default 0,
  unit text not null default 'units',
  unit_cost numeric not null default 0,
  image_src text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2) Row Level Security
alter table public.misc_inventory_items enable row level security;

-- 3) Policies (drop first so you can re-run this script)
drop policy if exists "Allow read misc_inventory for authenticated" on public.misc_inventory_items;
drop policy if exists "Allow insert/update/delete misc_inventory for admin" on public.misc_inventory_items;
drop policy if exists "dev misc_inventory authenticated all" on public.misc_inventory_items;

-- Anyone signed in can read (same idea as inventory_items in your main guide)
create policy "Allow read misc_inventory for authenticated"
  on public.misc_inventory_items for select
  to authenticated
  using (true);

-- Only users with profiles.role = 'admin' can insert/update/delete
-- NOTE: If you do NOT have a public.profiles table, this policy will ERROR.
--       In that case, COMMENT OUT the block below and use the DEV block instead.
create policy "Allow insert/update/delete misc_inventory for admin"
  on public.misc_inventory_items for all
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Optional: if you created this table earlier with expiry_date, drop it (misc supplies don't use expiry)
alter table public.misc_inventory_items drop column if exists expiry_date;

-- ---------------------------------------------------------------------------
-- DEV ONLY (no profiles table): if the admin policy above failed, run this
-- instead — comment out the "Allow insert/update/delete misc_inventory for admin"
-- policy above, then uncomment and run:
--
-- create policy "dev misc_inventory authenticated all"
--   on public.misc_inventory_items for all
--   to authenticated
--   using (true)
--   with check (true);
-- ---------------------------------------------------------------------------
