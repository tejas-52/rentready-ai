-- ============================================================
-- RentReady AI — Initial Database Schema
-- ============================================================

-- 1. PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  country TEXT,
  rental_country TEXT,
  employment_status TEXT,
  photo_url TEXT,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  preferred_language TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger to create a profile row automatically on sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. APPLICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft',  -- draft, in_progress, ready, submitted
  confidence_score NUMERIC(5,2),
  summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_applications_user_id ON public.applications(user_id);

-- 3. DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  name TEXT NOT NULL,
  mime_type TEXT,
  category TEXT NOT NULL DEFAULT 'unknown',
  doc_type TEXT,             -- passport, visa, employment_letter, payslip, bank_statement, tax, utility_bill, reference_letter
  status TEXT NOT NULL DEFAULT 'uploaded',  -- uploaded, processing, verified, error
  confidence NUMERIC(5,2),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_application ON public.documents(application_id);
CREATE INDEX idx_documents_user_id ON public.documents(user_id);
CREATE INDEX idx_documents_doc_type ON public.documents(doc_type);

-- 4. EXTRACTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  data JSONB,                -- extracted key-value pairs
  ocr_text TEXT,             -- raw OCR output
  confidence NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_extractions_document ON public.extractions(document_id);

-- 5. VALIDATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  checks JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- checks: [{ name: string, passed: boolean, detail: string }]
  issues JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- issues: [{ severity: "low"|"medium"|"high", message: string }]
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_validations_application ON public.validations(application_id);

-- 6. RECOMMENDATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- items: [{ title: string, detail?: string, impact: number, eta_seconds?: number }]
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recommendations_application ON public.recommendations(application_id);

-- 7. REPORTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reports_application ON public.reports(application_id);

-- 8. AGENT CREDENTIALS (encrypted portal passwords)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agent_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  host TEXT NOT NULL,
  label TEXT,
  username TEXT NOT NULL,
  password_ciphertext TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_creds_user ON public.agent_credentials(user_id);

-- 9. AGENT RUNS (browser automation sessions)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id UUID REFERENCES public.agent_credentials(id) ON DELETE SET NULL,
  target_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, running, completed, failed
  live_view_url TEXT,
  bb_session_id TEXT,       -- Browserbase session ID
  log JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- log: [{ ts: string, message: string }]
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_runs_user ON public.agent_runs(user_id);

-- 10. CHAT MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  application_id UUID REFERENCES public.applications(id) ON DELETE SET NULL,
  role TEXT NOT NULL,        -- user, assistant
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_user ON public.chat_messages(user_id);
CREATE INDEX idx_chat_application ON public.chat_messages(application_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Profiles: users can read/update only their own
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Applications: users can read/insert/update/delete only their own
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own applications" ON public.applications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own applications" ON public.applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own applications" ON public.applications
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own applications" ON public.applications
  FOR DELETE USING (auth.uid() = user_id);

-- Documents
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own documents" ON public.documents
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own documents" ON public.documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own documents" ON public.documents
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own documents" ON public.documents
  FOR DELETE USING (auth.uid() = user_id);

-- Extractions
ALTER TABLE public.extractions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own extractions" ON public.extractions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own extractions" ON public.extractions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Validations
ALTER TABLE public.validations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own validations" ON public.validations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own validations" ON public.validations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Recommendations
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own recommendations" ON public.recommendations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recommendations" ON public.recommendations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Reports
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own reports" ON public.reports
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reports" ON public.reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Agent Credentials
ALTER TABLE public.agent_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own credentials" ON public.agent_credentials
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own credentials" ON public.agent_credentials
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own credentials" ON public.agent_credentials
  FOR DELETE USING (auth.uid() = user_id);

-- Agent Runs
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own runs" ON public.agent_runs
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own runs" ON public.agent_runs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own runs" ON public.agent_runs
  FOR UPDATE USING (auth.uid() = user_id);

-- Chat Messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own messages" ON public.chat_messages
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own messages" ON public.chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- STORAGE BUCKET (run in Supabase SQL Editor)
-- ============================================================
-- Note: Storage buckets can only be created via the Dashboard or Management API.
-- Use this SQL AFTER creating the 'documents' bucket in the Supabase Dashboard:
--
-- CREATE POLICY "Users can read own documents" ON storage.objects
--   FOR SELECT USING (auth.uid() = owner);
-- CREATE POLICY "Users can upload documents" ON storage.objects
--   FOR INSERT WITH CHECK (auth.uid() = owner);
-- CREATE POLICY "Users can delete own documents" ON storage.objects
--   FOR DELETE USING (auth.uid() = owner);

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables that have updated_at
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_applications
  BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_agent_credentials
  BEFORE UPDATE ON public.agent_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_updated_at_agent_runs
  BEFORE UPDATE ON public.agent_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
