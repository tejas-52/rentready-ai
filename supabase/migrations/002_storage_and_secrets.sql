-- ============================================================
-- STORAGE BUCKET SETUP
-- Run this in the Supabase SQL Editor AFTER running 001_initial_schema.sql
-- ============================================================

-- Storage bucket "rental-documents" already exists.
-- Run these RLS policies in the Supabase SQL Editor:

-- Storage RLS policies for rental-documents bucket
CREATE POLICY IF NOT EXISTS "Users can read own documents" ON storage.objects
  FOR SELECT
  USING (auth.uid()::text = owner);

CREATE POLICY IF NOT EXISTS "Users can upload documents" ON storage.objects
  FOR INSERT
  WITH CHECK (auth.uid()::text = owner);

CREATE POLICY IF NOT EXISTS "Users can delete own documents" ON storage.objects
  FOR DELETE
  USING (auth.uid()::text = owner);

-- ============================================================
-- EDGE FUNCTION SECRETS
-- Set these via Supabase CLI or Dashboard:
--   supabase secrets set OPENAI_API_KEY=sk-...
--   supabase secrets set AGENT_ENCRYPTION_KEY=<32-byte-hex>
-- ============================================================

-- Generate a random encryption key for agent credentials:
-- Run: openssl rand -hex 32
-- Then set: supabase secrets set AGENT_ENCRYPTION_KEY=<output>
