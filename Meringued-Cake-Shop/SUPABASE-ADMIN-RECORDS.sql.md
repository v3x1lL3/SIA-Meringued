# Supabase: Admin Records (Audits/Expenses/Receipts)

This adds an optional table used by `adminrecords.html` so records sync across devices/users.

If you don't run this SQL, the page will still work using **localStorage**.

## Create table + RLS (admin-only)

Run in Supabase Dashboard → **SQL Editor**:

```sql
-- ========= ADMIN RECORDS =========
create table if not exists public.admin_records (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  record_date date not null,
  title text not null,
  amount numeric,
  ref text,
  notes text,
  created_at timestamptz default now()
);

create index if not exists admin_records_type_date_idx
  on public.admin_records (type, record_date desc);

alter table public.admin_records enable row level security;

-- Admin-only access (requires public.profiles.role = 'admin' like in your main setup SQL)
create policy "Admins can manage admin_records"
  on public.admin_records
  for all
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
```

## Notes

- The app uses the Supabase anon key on the client. **Security comes from RLS**, so keep RLS enabled.
- If you haven't created `public.profiles` / role logic yet, run your existing `SUPABASE-CONNECT-INVENTORY-AND-ORDERS.md` SQL first (it sets up `profiles` + role usage).

