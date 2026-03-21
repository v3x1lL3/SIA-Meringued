# Connect Inventory & Orders to Supabase

This guide sets up Supabase tables and RLS so the app can sync **inventory** and **orders** to the database. The app still uses localStorage as the primary store; Supabase is written to in parallel so you have a persistent copy and can later move fully to the database if you want.

---

## 1. Run this SQL in Supabase

In the Supabase Dashboard go to **SQL Editor**, create a new query, paste the following, and run it.

```sql
-- Optional: profiles table for admin role (used by RLS so admins can update any order)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer',
  updated_at timestamptz default now()
);

-- Create profile on signup (run once per new user)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'customer')
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill existing users (run once)
insert into public.profiles (id, role)
select id, coalesce(raw_user_meta_data->>'role', 'customer')
from auth.users
on conflict (id) do update set role = coalesce(excluded.role, profiles.role);

-- Inventory table (matches app: name, quantity, reorder_level, unit, image_src, expiry_date)
create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  quantity numeric not null default 0,
  reorder_level numeric not null default 0,
  unit text not null default 'units',
  image_src text,
  expiry_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.inventory_items enable row level security;

-- If inventory_items already existed without expiry_date, add it (run once):
alter table public.inventory_items add column if not exists expiry_date date;

create policy "Allow read for authenticated"
  on public.inventory_items for select
  to authenticated using (true);

create policy "Allow insert/update/delete for admin"
  on public.inventory_items for all
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Orders table (customer_id = auth user; details = jsonb for name, size, flavor, receipt, etc.)
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references auth.users(id) on delete set null,
  status text not null default 'Pending',
  total_amount numeric,
  delivery_address text,
  customer_phone text,
  owner_phone text,
  payment_method text,
  delivery_type text,
  date_needed date,
  details jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- If `orders` already exists without owner_phone (shop pickup contact), run:
-- alter table public.orders add column if not exists owner_phone text;

create index if not exists idx_orders_customer_id on public.orders(customer_id);
create index if not exists idx_orders_created_at on public.orders(created_at desc);

alter table public.orders enable row level security;

-- Customers see only their orders; admins see all
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

create policy "Users can insert own orders"
  on public.orders for insert
  to authenticated
  with check (customer_id = auth.uid());

create policy "Users can update own orders"
  on public.orders for update
  to authenticated
  using (customer_id = auth.uid());

create policy "Admins can update any order"
  on public.orders for update
  to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Optional: RPC for admin dashboard (if you use orders_admin_summary_today)
create or replace function public.orders_admin_summary_today()
returns json as $$
  select json_build_object(
    'total', count(*),
    'pending', count(*) filter (where status = 'Pending'),
    'completed', count(*) filter (where status = 'Completed')
  )
  from public.orders
  where created_at >= date_trunc('day', now());
$$ language sql security definer;
```

If you do **not** use a `profiles` table or admin role, you can simplify RLS: e.g. allow all authenticated users to read/write `inventory_items` and to update any `orders` row (less secure; only use for development).

---

## 2. What the app does (no design change)

- **Inventory (admin)**  
  - On load: tries to load from Supabase first; if successful, that list is shown and saved to localStorage so order–ingredient scripts still work.  
  - On add/edit/delete/stock in/out: updates localStorage, then syncs to Supabase when the table exists and RLS allows it.

- **Orders (client)**  
  - When a client places an order (single or cart), the order is saved to localStorage as before. In the background the app also calls Supabase to insert the same order. The returned Supabase `id` is stored on the order as `supabase_id` so the admin can update status in the DB.

- **Orders (admin)**  
  - When the admin changes an order’s status, the app updates localStorage and, if the order has a `supabase_id`, calls Supabase to update that order’s status.

- **POS (orders + stock levels)**  
  - When the admin **confirms** an order (status moves from Pending to Acknowledge/Baking/Ready/Completed), the app deducts ingredients from **localStorage** and now also from **Supabase** inventory (by ingredient name).  
  - When the admin **cancels** an order, the app restores ingredients in both localStorage and Supabase.  
  - So stock levels in Supabase stay in sync with sales: once something is ordered and confirmed, inventory goes down in the database.

---

## 3. Steps for you after running the SQL

1. **Run the SQL above** in the Supabase SQL Editor (Dashboard → SQL Editor → New query → Paste → Run).

2. **Set admin role** (if you use profiles):  
   In Supabase go to **Authentication → Users**, open your admin user, and set **User Metadata** to `{ "role": "admin" }`. Then run the “Backfill existing users” part of the SQL again so `profiles` has that role (or run:  
   `update public.profiles set role = 'admin' where id = '<your-admin-user-uuid>';`).

3. **Test as client**  
   - Log in as a customer, place an order (single and/or cart).  
   - In Supabase **Table Editor → orders** you should see new rows with `customer_id`, `status`, `total_amount`, `details`, etc.

4. **Test as admin**  
   - Open **Admin → Orders**, change an order’s status.  
   - In **Table Editor → orders** the same row’s `status` and `updated_at` should update (for orders that have a `supabase_id`).

5. **Test inventory**  
   - Open **Admin → Inventory** (or the inventory section on the dashboard).  
   - Load the page: if Supabase returns rows, the table shows them.  
   - Add/edit/delete or use stock in/out: check **Table Editor → inventory_items** to see changes.

6. **Test POS (stock on order confirm/cancel)**  
   - In **Admin → Orders**, confirm an order (e.g. Pending → Acknowledge).  
   - In **Table Editor → inventory_items** the quantities for ingredients used by that cake (Flour, Sugar, etc.) should decrease.  
   - Cancel the same order: those quantities should go back up.

7. **Optional**  
   - Use **Dashboard** stats from Supabase (e.g. `orders_admin_summary_today`) if you wire the dashboard to use that RPC.

---

## 4. What’s connected to Supabase vs what you might be missing

Use this as a checklist so you know what’s already wired and what might still be local-only or need tables.

| Area | Status | Notes |
|------|--------|------|
| **Orders** | ✅ Connected | Checkout **waits** for Supabase insert (like Records). Admin Orders page shows **Source: Supabase** when cloud load succeeds. |
| **Inventory** | ✅ Connected | Admin load/add/edit/delete/stock in/out sync to `inventory_items`. Expiry/Extended dates use `expiry_date` column. |
| **Miscellaneous inventory** | ✅ Optional table | Admin **Inventory → Miscellaneous** syncs to `misc_inventory_items` when you run the SQL in `SUPABASE-MISC-INVENTORY.sql.md`. Separate from baking ingredients and POS deductions. |
| **POS (stock on order)** | ✅ Connected | Confirm order → deduct ingredients in Supabase; cancel → restore. |
| **Purchase orders** | ✅ Optional (Section 6) | Run the optional SQL in Section 6 to create `purchase_orders` and `purchase_order_items`; the app already uses them. |
| **Customers** | ✅ Optional (Section 6) | Run the optional SQL in Section 6 to create `customers`; Admin → Customers and dashboard will use it when the table exists. |
| **Products** | ⚠️ Model only | Product model exists; if you have a products/catalog table, create it and wire the app. |
| **Payments** | ⚠️ Model only | Payment model exists; create a `payments` table if you want to store payment records in Supabase. |
| **Suppliers** | ⚠️ Model only | Supplier model exists; create a `suppliers` table if you use supplier management. |
| **Auth / profiles** | ✅ In SQL | `profiles` and trigger for role; used by RLS for admin. |
| **Feedback** | ❓ Local / custom | If admin feedback page uses localStorage or another store, add a Supabase table and wire it if you want persistence. |
| **Settings** | ❓ Local / custom | Admin/client settings are often localStorage; add tables only if you need them in Supabase. |

**Crucial for stock and sales:** orders, inventory, and POS (order–ingredient deduction/restore) are all connected so you get correct stock levels in Supabase when orders are confirmed or cancelled.

---

## 5. Troubleshooting

- **Use profiles + roles only (recommended fix script)**  
  The app’s admin checks use **`public.profiles.role = 'admin'`** (not JWT-only policies). If you tried JWT policies or **`profiles` has RLS enabled without a SELECT policy**, the `orders` policies can silently fail. Run **`SUPABASE-PROFILES-ORDERS-RLS-FIX.sql`** once in the SQL Editor: it syncs `profiles` from Auth, adds **“read own profile”** on `profiles`, drops the JWT order policy if present, and recreates **profiles-based** `orders` policies. Then set **`role = admin`** in **Table Editor → `profiles`** for each staff user (or set **User metadata** `role` in **Authentication → Users** and run the script’s sync block again).

- **Orders show in the admin panel but `orders` in Supabase is empty (or badge “Local only · not in cloud”)**  
  - The row was saved in **localStorage** only; **`insert` into Supabase failed** (often silent before). Check **browser console (F12)** for `[OrderModel] insertOrder failed`.  
  - **Fix:** Customer must be **signed in** so `customer_id` matches `auth.uid()` (policy **“Users can insert own orders”**). Confirm **`js/core/supabaseClient.js`** URL/key match the project you open in the dashboard.  
  - **Large receipt / design image:** the app retries **without** base64 blobs in `details` so a row can still be created; receipt may stay on the device only until you use **Supabase Storage** for files.

- **Table Editor shows orders but Admin / dashboard list is empty (no error)**  
  - This is **normal with RLS on**: the dashboard uses the **anon key + your logged-in user’s JWT**. Supabase only returns rows allowed by **policies**. The Table Editor uses elevated access and **ignores RLS**, so you can see 14 rows in the dashboard UI while `select('*')` from the app returns `[]` — **not a bug in the app**.  
  - **Fix:**  
    1. In the shop, **sign in** with the admin account (not “guest” / not a different browser profile).  
    2. In Supabase go to **Authentication → Users**, copy your admin user’s **UUID**.  
    3. In **SQL Editor** run (replace the UUID):  
       ```sql
       insert into public.profiles (id, role) values ('PASTE-YOUR-ADMIN-USER-UUID-HERE', 'admin')
       on conflict (id) do update set role = 'admin';
       ```  
    4. If the **RLS policies** indicator on `orders` shows a warning, open **Authentication → Policies** for `public.orders` and ensure the policies from **section 1** exist — especially **`Admins can read all orders`** (`SELECT` for `authenticated` using `profiles.role = 'admin'`).  
    5. Reload the admin page. Open DevTools → Console: if you still see 0 orders, look for `[OrderModel] listOrdersForAdmin` hints added by the app.

- **Orders or inventory not appearing in Supabase**  
  - Check the browser console for errors (e.g. RLS or missing columns).  
  - Confirm the anon key and URL in `js/core/supabaseClient.js` match your project.

- **Inventory expiry date not saving after navigating away**  
  - Ensure `inventory_items` has an `expiry_date` column. In Supabase **SQL Editor** run:  
    `alter table public.inventory_items add column if not exists expiry_date date;`

- **“Permission denied” or RLS errors**  
  - Ensure the user is signed in (Supabase Auth).  
  - For admin-only actions, ensure `profiles.role = 'admin'` for that user and that the RLS policies use `profiles` as in the SQL above.

- **Old orders have no `supabase_id`**  
  - They were created before sync; only new orders get a `supabase_id`. Admin status updates will still work in localStorage; Supabase will only be updated for orders that have `supabase_id`.

- **Stock not changing in Supabase when you confirm/cancel an order**  
  - Ensure the **Admin → Orders** page loads `js/order-ingredients-supabase.js` (it’s included).  
  - Ingredient names in `inventory_items` (e.g. "Flour", "Sugar") must match the names used in the cake recipes in `admin-order-ingredients.js` (case-insensitive).

---

## 6. Optional: Purchase orders and Customers (additive only – does not change existing tables)

Run this **in a separate query** if you want the **purchase orders** and **customers** features to use Supabase. It only **creates new tables** and their RLS. It does **not** alter, drop, or touch `profiles`, `inventory_items`, or `orders`.

```sql
-- ========== CUSTOMERS (optional) ==========
-- Used by Admin → Customers and dashboard when listCustomers() is called.
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  role text not null default 'customer',
  orders_count int default 0,
  last_order_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.customers enable row level security;

create policy "Admins can do all on customers"
  on public.customers for all
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Allow read for authenticated (e.g. dashboard)
create policy "Authenticated can read customers"
  on public.customers for select
  to authenticated using (true);

-- ========== PURCHASE ORDERS (optional) ==========
-- Used by purchase order controller/view (listPurchaseOrders, createPurchaseOrder).
create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'Pending',
  total_amount numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  name text,
  quantity numeric not null default 0,
  unit_price numeric default 0,
  created_at timestamptz default now()
);

create index if not exists idx_po_items_po_id on public.purchase_order_items(purchase_order_id);

alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;

create policy "Admins can do all on purchase_orders"
  on public.purchase_orders for all
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Authenticated can read purchase_orders"
  on public.purchase_orders for select
  to authenticated using (true);

create policy "Admins can do all on purchase_order_items"
  on public.purchase_order_items for all
  to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Authenticated can read purchase_order_items"
  on public.purchase_order_items for select
  to authenticated using (true);
```

**What this does (and does not do):**

- **Creates only:** `customers`, `purchase_orders`, `purchase_order_items` (if they don’t already exist).
- **Does not change:** `profiles`, `inventory_items`, `orders`, or any existing data.
- **App behavior:**  
  - **Customers:** Admin → Customers already calls `listCustomers()`. With this table in place, that page can show rows from Supabase. If the table is empty, the app falls back to profiles or localStorage as it does now.  
  - **Purchase orders:** Any page that calls `loadPurchaseOrders()` will show rows from `purchase_orders` once you add data (via future UI or Supabase Table Editor). Creating POs from the app uses `createPurchaseOrder(payload, items)`; payload can include `status`, `total_amount`, and items can include `name`, `quantity`, `unit_price`.

---

## Admin orders: live updates (Realtime)

The admin **Orders** page loads `js/admin-orders-realtime.js`, which subscribes to `postgres_changes` on `public.orders`. When a row is inserted, updated, or deleted, the list reloads from Supabase (merged with local).

1. In Supabase Dashboard, open **`orders`** → **Enable Realtime** (or **Database → Publications** and include `orders` in `supabase_realtime`).
2. Realtime **does not bypass RLS**: you still only receive events for rows your policies allow. Fix admin `SELECT` policies and `profiles.role = 'admin'` if counts don’t match Table Editor.

---

## Why Table Editor shows more rows than the website

The Table Editor uses the **service role** / dashboard context and **does not apply RLS** the same way as the browser with the **anon key + user JWT**. If the site shows fewer orders, check **RLS policies** on `orders` and that the signed-in user’s **`profiles.role`** is **`admin`** where your policies expect it.
