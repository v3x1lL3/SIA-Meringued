-- =============================================================================
-- Meringued: profiles + orders RLS (admin visibility, customer checkout, no recursion)
-- Run once in Supabase: SQL Editor → New query → Paste → Run.
--
-- Fixes common breaks:
-- 1) Customer "Order was not placed" — orders need INSERT (and UPDATE) policies, not SELECT only.
-- 2) "infinite recursion detected in policy for relation profiles" — never use EXISTS(subquery
--    on profiles) inside a policy ON profiles. Use public.is_admin() instead.
-- 3) Sign up shows "Database error saving new user" — usually a broken or missing trigger on
--    auth.users that inserts into public.profiles (section 4 below).
-- 4) Auth log: column "contact_number" (or similar) of relation "profiles" does not exist —
--    run SUPABASE-PROFILES-ADD-COLUMNS-FOR-SIGNUP.sql once, then retry signup.
-- =============================================================================

-- 0) Helper: read role without triggering RLS recursion (runs as definer, bypasses RLS inside)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.role = 'admin' from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

grant execute on function public.is_admin() to authenticated;

-- 1) profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer',
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- Remove recursive policy if you ran an older "sync" script that subqueried profiles from profiles
drop policy if exists "Admins can read all profiles" on public.profiles;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

-- Optional: admins see every profile row (uses is_admin, not EXISTS-on-profiles)
drop policy if exists "Admins can read all profiles v2" on public.profiles;
create policy "Admins can read all profiles v2"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

-- Customer Settings + triggers: each user can create/update their own row
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- 2) Backfill roles
insert into public.profiles (id, role)
select id, coalesce(raw_user_meta_data->>'role', 'customer')
from auth.users
on conflict (id) do update
set role = coalesce(
  nullif(excluded.role, ''),
  nullif(public.profiles.role, ''),
  'customer'
);

-- 3) orders — SELECT + INSERT + UPDATE (required for clientordering.html checkout)
alter table public.orders enable row level security;

drop policy if exists "Users can read own orders" on public.orders;
drop policy if exists "Admins can read all orders" on public.orders;
drop policy if exists "Users can insert own orders" on public.orders;
drop policy if exists "Users can update own orders" on public.orders;
drop policy if exists "Admins can update any order" on public.orders;

create policy "Users can read own orders"
  on public.orders for select
  to authenticated
  using (customer_id = auth.uid());

create policy "Admins can read all orders"
  on public.orders for select
  to authenticated
  using (public.is_admin());

-- Checkout: customer_id must match signed-in user (app sets this from Auth)
create policy "Users can insert own orders"
  on public.orders for insert
  to authenticated
  with check (customer_id = auth.uid());

create policy "Users can update own orders"
  on public.orders for update
  to authenticated
  using (customer_id = auth.uid())
  with check (customer_id = auth.uid());

create policy "Admins can update any order"
  on public.orders for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant usage on schema public to authenticated;
grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update on table public.orders to authenticated;

-- =============================================================================
-- 4) Auth signup → profiles row (customer-signup.html / admin-signup.html)
--
-- Supabase runs DB triggers when a row is inserted into auth.users. If your trigger inserts
-- into public.profiles without SECURITY DEFINER, without set search_path = public, or without
-- ON CONFLICT handling, signup fails with: "Database error saving new user".
--
-- If public.profiles has extra NOT NULL columns (from an old template), add defaults or include
-- them in the INSERT below, or drop those columns — otherwise inserts will still fail.
-- =============================================================================

-- Match Supabase docs: security definer + empty search_path (only qualified names like public.profiles).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'role'), ''),
      'customer'
    )
  )
  on conflict (id) do update
  set role = coalesce(
    nullif(excluded.role, ''),
    nullif(public.profiles.role, ''),
    'customer'
  ),
  updated_at = now();
  return new;
end;
$$;

-- Dashboard / older Postgres use PROCEDURE here; both invoke this trigger function.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter function public.handle_new_user() owner to postgres;

-- If signup still returns "Unexpected failure": Authentication → Providers → Email →
-- disable "Confirm email" for local dev, or configure Custom SMTP. Add Redirect URLs
-- for http://127.0.0.1:5500/Meringued-Cake-Shop/** if you use email confirmation.

-- =============================================================================
-- 5) MANUAL: set staff to admin
--    update public.profiles set role = 'admin' where id = 'YOUR-USER-UUID';
-- =============================================================================
