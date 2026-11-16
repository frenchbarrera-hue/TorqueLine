-- ============================================================================
-- TorqueLine Supabase Setup
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard)
-- ============================================================================

-- 1. MESSAGES TABLE
-- Each order has its own conversation thread (same as local server.py)
CREATE TABLE IF NOT EXISTS public.messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('client', 'admin')),
  message TEXT NOT NULL CHECK (char_length(message) <= 2000),
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON public.messages (sender_id, receiver_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_order_id
  ON public.messages (order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_read
  ON public.messages (receiver_id, is_read);

-- 2. ROW LEVEL SECURITY - DISABLED
-- The frontend uses localStorage sessions (not Supabase Auth), so RLS
-- policies based on auth.uid() would block all requests.
-- Security is enforced at the app layer (auth.js + session checks).
-- If you later migrate to Supabase Auth, re-enable RLS with proper policies.
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;

-- 3. ORDERS TABLE (for order-linked chat)
-- Only if you don't already have an orders table; adjust column names to match.
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY,
  order_number TEXT,
  user_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  total_php NUMERIC(10, 2) NOT NULL DEFAULT 0,
  placed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. REALTIME (optional)
-- Enables live message updates without polling.
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- 5. GRANT PERMISSIONS
-- The anon role needs CRUD on messages (no RLS to block it)
GRANT ALL ON public.messages TO anon, authenticated;
GRANT ALL ON public.orders TO anon, authenticated;