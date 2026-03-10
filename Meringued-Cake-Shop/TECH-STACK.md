# Meringued Cake Shop — Tech Stack

Reference for frontend, backend, and database used in this project.

## Frontend
- **HTML5** — Markup for all pages (landing, admin, client).
- **Tailwind CSS** — Via CDN (`cdn.tailwindcss.com`) for layout and styling.
- **Font Awesome 6.4** — Icons (CDN).
- **Google Fonts** — Playfair Display (headings), Inter (body).
- **Vanilla JavaScript (ES modules)** — No React/Vue; modular JS with `import`/`export` (e.g. `supabaseClient.js`, models, controllers, views).
- **Browser APIs** — `localStorage` for cart, orders, settings, and inventory when not using Supabase.

## Backend
- **No custom backend server** — No Node, Express, or other server in the repo.
- **Supabase (Backend-as-a-Service)** — Auth (login/signup) and Data API (CRUD). Supabase client: `@supabase/supabase-js` (loaded via `esm.sh`).

## Database
- **Supabase (PostgreSQL)** — Main persistence for orders, inventory, and other app data.
- **Browser `localStorage`** — Fallback / offline: orders, cart, admin inventory, client settings when Supabase is not used or unavailable.

---

| Layer     | Technologies |
|----------|------------------------------------------------------------------|
| Frontend | HTML5, Tailwind CSS, Font Awesome, Google Fonts, Vanilla JS (ES modules) |
| Backend  | Supabase (Auth + Data API); no custom server |
| Database | Supabase (PostgreSQL) + localStorage (client-side fallback) |
