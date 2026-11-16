-- ============================================================================
-- TorqueLine Supabase Setup v2 - Adds edit/delete, reactions, image support
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard)
-- ============================================================================

-- 1. MESSAGES TABLE (with new columns)
CREATE TABLE IF NOT EXISTS public.messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('client', 'admin')),
  message TEXT NOT NULL CHECK (char_length(message) <= 2000),
  is_read INTEGER NOT NULL DEFAULT 0 CHECK (is_read IN (0, 1)),
  image_url TEXT,
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  reactions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Migration: add columns if table already exists
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reactions JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON public.messages (sender_id, receiver_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_order_id
  ON public.messages (order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_read
  ON public.messages (receiver_id, is_read);

-- 2. ROW LEVEL SECURITY - DISABLED
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;

-- 3. ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.orders (
  id TEXT PRIMARY KEY,
  order_number TEXT,
  user_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  total_php NUMERIC(10, 2) NOT NULL DEFAULT 0,
  placed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- 5. GRANT PERMISSIONS
GRANT ALL ON public.messages TO anon, authenticated;
GRANT ALL ON public.orders TO anon, authenticated;

-- 6. STORAGE BUCKET FOR CHAT IMAGES
-- Run this in Supabase Dashboard → Storage → New bucket:
--   Name: chat-images
--   Public: ON
-- Or run in SQL Editor:
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-images', 'chat-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anon to upload/read chat images
CREATE POLICY "chat_images_select" ON storage.objects FOR SELECT USING (bucket_id = 'chat-images');
CREATE POLICY "chat_images_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat-images');
CREATE POLICY "chat_images_delete" ON storage.objects FOR DELETE USING (bucket_id = 'chat-images');

-- 7. DELETE FOR ME (hides message for one user, others still see it)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_for JSONB NOT NULL DEFAULT '[]'::jsonb;