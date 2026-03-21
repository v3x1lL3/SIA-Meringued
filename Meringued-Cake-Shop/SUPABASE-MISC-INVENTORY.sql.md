# Miscellaneous inventory table (`misc_inventory_items`)

Admin **Inventory → Miscellaneous** (boxes, bags, packaging, etc.) syncs to this **separate** table from baking ingredients (`inventory_items`). **No `expiry_date` column** — supplies are tracked without expiry.

## Run in Supabase SQL Editor

Paste and run once (additive — does not change `inventory_items`).

```sql
-- Miscellaneous supplies inventory (Admin → Inventory → Miscellaneous tab)
create table if not exists public.misc_inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  quantity numeric not null default 0,
  reorder_level numeric not null default 0,
  unit text not null default 'units',
  unit_cost numeric not null default 0,
  image_src text,
  expiry_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.misc_inventory_items enable row level security;

-- Match inventory_items access: read for any authenticated user; write for admins
create policy "Allow read misc_inventory for authenticated"
  on public.misc_inventory_items for select
  to authenticated using (true);

create policy "Allow insert/update/delete misc_inventory for admin"
  on public.misc_inventory_items for all
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- If you already had expiry_date on this table, remove it:
alter table public.misc_inventory_items drop column if exists expiry_date;
```

### If you do not use `profiles` / admin role

Use a simpler policy for development only, e.g.:

```sql
create policy "dev misc_inventory authenticated all"
  on public.misc_inventory_items for all
  to authenticated
  using (true)
  with check (true);
```

(Drop the stricter policies first if you already created them.)

### Optional: keep `updated_at` fresh

```sql
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists misc_inventory_items_updated_at on public.misc_inventory_items;
create trigger misc_inventory_items_updated_at
  before update on public.misc_inventory_items
  for each row execute function public.set_updated_at();
```

(If you already have `set_updated_at` for other tables, only the `create trigger` part is needed.)

## After running SQL

1. Ensure `admininventory.html` / `admindashboard.html` load `js/admin-misc-inventory-supabase.js` (already wired in the project).
2. Open **Admin → Inventory**, switch to **Miscellaneous**, add or edit items — rows should appear in **Table Editor → misc_inventory_items**.
