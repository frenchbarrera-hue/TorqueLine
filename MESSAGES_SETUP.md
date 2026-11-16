# TorqueLine Messaging Setup (Supabase)

Your messaging system now uses **Supabase** (hosted PostgreSQL + REST API) instead of a local Python server. This works on **GitHub Pages** and any static host.

## 1. Create Supabase Project

1. Go to https://supabase.com → Start your project
2. Create a new project (name: `torqueline`)
3. Wait for provisioning (~2 min)

## 2. Run the Schema

1. Open **SQL Editor** in Supabase dashboard
2. Copy the contents of `supabase_setup.sql`
3. Paste and click **Run**

This creates:
- `messages` table (with indexes + RLS policies)
- `orders` table (for order-linked chat)
- Realtime publication

## 3. Get Your Keys

1. Go to **Settings** → **API**
2. Copy the **Project URL** (e.g., `https://xolcoywvyonoueqbfxea.supabase.co`)
3. Copy the **anon public key**

## 4. Update config.js

Open `config.js` and set:

```js
SUPABASE_URL: 'https://xolcoywvyonoueqbfxea.supabase.co',
SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIs...',  // your anon key
```

## 5. Set Admin Role

Make your admin user an admin in Supabase Auth:

```sql
-- In SQL Editor
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(
  COALESCE(raw_app_meta_data, '{}'::jsonb),
  '{role}', '"admin"'
)
WHERE email = 'admin@torqueline.ph';
```

## 6. Test

1. Open `user-dashboard.html` → log in as client → open an order → send a message
2. Open `admin-dashboard.html` → log in as admin → click Messages → see conversation
3. Messages persist in Supabase (works on GitHub Pages too!)

## Files Changed

- `config.js` — Supabase URL + anon key
- `supabase.js` — Data layer (REST API calls)
- `messages.js` — Now uses Supabase instead of local server
- `supabase_setup.sql` — Database schema + RLS policies
- `user-dashboard.html` — Loads config.js + supabase.js
- `admin-dashboard.html` — Loads config.js + supabase.js

## Security (RLS)

Row Level Security is enabled. Messages are only accessible by:
- The sender and receiver of that conversation
- Admins (users with `role: admin` in JWT)

The anon key is safe to embed in client-side code (it's meant to be public). RLS enforces access control at the database level.