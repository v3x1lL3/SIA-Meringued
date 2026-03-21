-- =============================================================================
-- Meringued: fix "only 1 order shows" — RLS needs profiles.role = 'admin' AND
-- you must be able to SELECT your own profiles row (for the EXISTS check).
-- Run once in Supabase: SQL Editor → New query → Paste → Run.
-- Then hard-refresh the admin Orders page (Ctrl+Shift+R).
-- =============================================================================

-- 1) Ensure profiles table exists (no-op if already there)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer',
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- 2) You MUST be able to read your own profile row — otherwise the policy
--    "Admins can read all orders" (which checks profiles) never sees role = admin.
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

-- (Do not add a second policy here that SELECTs from profiles using EXISTS on profiles —
--  it can cause "infinite recursion" in PostgreSQL RLS.)

-- 3) Sync role from auth metadata into profiles (backfill)
insert into public.profiles (id, role)
select id, coalesce(raw_user_meta_data->>'role', 'customer')
from auth.users
on conflict (id) do update
set role = coalesce(
  nullif(excluded.role, ''),
  nullif(public.profiles.role, ''),
  'customer'
);

-- 4) Recreate orders SELECT policies (idempotent names from project docs)
alter table public.orders enable row level security;

drop policy if exists "Users can read own orders" on public.orders;
drop policy if exists "Admins can read all orders" on public.orders;

create policy "Users can read own orders"
  on public.orders for select
  to authenticated
  using (customer_id = auth.uid());

create policy "Admins can read all orders"
  on public.orders for select
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- =============================================================================
-- 5) MANUAL STEP: set your staff account to admin (pick ONE method)
--
-- A) Table Editor → profiles → find row where id = your user UUID → role = admin
--
-- B) Or run (replace YOUR-USER-UUID):
--    update public.profiles set role = 'admin' where id = 'YOUR-USER-UUID';
--
-- Get UUID from: Authentication → Users → your account → User UID
-- =============================================================================
