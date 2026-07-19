# ============================================================
# RentReady AI — Deployment Guide
# ============================================================
#
# PREREQUISITES:
# 1. Supabase project at https://awvicpkbxubjspufoxee.supabase.co
# 2. Node.js 18+ and npm
# 3. Supabase CLI: npm install -g supabase
#
# ============================================================

# STEP 1: Login to Supabase CLI
supabase login

# STEP 2: Link to the project
supabase link --project-ref awvicpkbxubjspufoxee

# STEP 3: Run database migrations
# Option A: Via Supabase Dashboard SQL Editor
#  - Go to https://supabase.com/dashboard/project/awvicpkbxubjspufoxee/sql/new
#  - Paste contents of supabase/migrations/001_initial_schema.sql
#  - Click "Run"
#  - Paste contents of supabase/migrations/002_storage_and_secrets.sql
#  - Click "Run"

# Option B: Via CLI (if db is linked)
# supabase db push

# STEP 4: Create the storage bucket
#  - Go to Dashboard → Storage → New Bucket
#  - Name: "documents"
#  - Check: "Private bucket"
#  - Click "Create bucket"

# STEP 5: Set Edge Function secrets
supabase secrets set OPENAI_API_KEY="sk-proj-..." --project-ref awvicpkbxubjspufoxee
supabase secrets set AGENT_ENCRYPTION_KEY="$(openssl rand -hex 32)" --project-ref awvicpkbxubjspufoxee

# STEP 6: Deploy Edge Functions
supabase functions deploy chat --project-ref awvicpkbxubjspufoxee
supabase functions deploy pipeline --project-ref awvicpkbxubjspufoxee
supabase functions deploy run-agent --project-ref awvicpkbxubjspufoxee
supabase functions deploy autopilot --project-ref awvicpkbxubjspufoxee

# STEP 7: Verify everything is working
# Start the dev server:
npm run dev
# Visit http://localhost:8080
# Sign up with a real email or click "Continue as Demo"
