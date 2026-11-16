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

-- 2. ROW LEVEL SECURITY
-- Messages are readable/writable only by the two conversation participants.
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Client can read messages sent to them by admin (any order)
CREATE POLICY "client_reads_own_messages"
  ON public.messages FOR SELECT
  USING (
    sender_id = auth.uid()::text
    OR receiver_id = auth.uid()::text
  );

-- Client can send messages to admin as themselves
CREATE POLICY "client_sends_to_admin"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()::text
    AND receiver_id = 'usr_admin'
    AND sender_role = 'client'
  );

-- Admin can read all messages
CREATE POLICY "admin_reads_all"
  ON public.messages FOR SELECT
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin');

-- Admin can send to any client
CREATE POLICY "admin_sends_to_client"
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = 'usr_admin'
    AND sender_role = 'admin'
  );

-- Admin can mark messages as read
CREATE POLICY "admin_marks_read"
  ON public.messages FOR UPDATE
  USING (auth.jwt() -> 'app_metadata' ->> 'role' = 'admin')
  WITH CHECK (true);

-- Client can mark their own received messages as read
CREATE POLICY "client_marks_read"
  ON public.messages FOR UPDATE
  USING (receiver_id = auth.uid()::text)
  WITH CHECK (true);

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

-- 5. ADMIN ROLE HELPER
-- Set a user as admin in Supabase Auth:
--   UPDATE auth.users SET raw_app_meta_data = jsonb_set(
--     COALESCE(raw_app_meta_data, '{}'::jsonb),
--     '{role}', '"admin"'
--   ) WHERE email = 'admin@torqueline.ph';