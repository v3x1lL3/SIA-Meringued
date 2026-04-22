-- =============================================================================
-- Meringued: fix signup (auth → public.profiles) — run in Supabase SQL Editor.
--
-- Symptoms in the browser:
--   • "Database error saving new user"
--   • "Unexpected failure, please check server logs for more information"
--
-- If you see "Unexpected failure" after this script runs OK, almost always:
--   Dashboard → Authentication → Providers → Email → disable "Confirm email"
--   for local dev (or configure Custom SMTP). Auth tries to send mail and fails.
--
-- Add redirect URLs: Authentication → URL Configuration → Redirect URLs:
--   http://127.0.0.1:5500/Meringued-Cake-Shop/**
--   http://localhost:5500/Meringued-Cake-Shop/**
-- =============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer',
  updated_at timestamptz default now()
);

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Ensure the trigger function runs with superuser privileges (avoids RLS edge cases).
alter function public.handle_new_user() owner to postgres;

-- If your Postgres build rejects EXECUTE PROCEDURE, replace the trigger with:
--   for each row execute function public.handle_new_user();

-- If signup still fails: Table Editor → public.profiles → remove or relax any
-- NOT NULL columns that are not filled by the INSERT above (e.g. legacy email).
