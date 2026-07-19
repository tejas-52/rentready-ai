/**
 * setup.mjs — One-command setup for RentReady AI
 * 
 * Usage: node setup.mjs <DB_PASSWORD>
 * 
 * This script:
 * 1. Connects to Supabase PostgreSQL and runs migrations
 * 2. Creates the storage bucket
 * 3. Sets Edge Function secrets
 * 4. Provides deploy command
 */

import pg from "pg";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const PROJECT_REF = "awvicpkbxubjspufoxee";
const DB_PASSWORD = process.argv[2];

if (!DB_PASSWORD) {
  console.error("Usage: node setup.mjs <DB_PASSWORD>");
  console.error("");
  console.error("Get your DB password from:");
  console.error("  Supabase Dashboard → Project Settings → Database → Connection String");
  console.error("  Look for: postgresql://postgres:[THIS_PASSWORD]@db...");
  process.exit(1);
}

// ---- Step 1: Run SQL Migrations ----
async function runMigrations() {
  console.log("\n📦 Step 1/3: Running database migrations...\n");

  const pool = new pg.Pool({
    host: `db.${PROJECT_REF}.supabase.co`,
    port: 5432,
    database: "postgres",
    user: "postgres",
    password: DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    max: 1,
  });

  try {
    const sql = readFileSync(
      resolve(__dirname, "supabase", "migrations", "001_initial_schema.sql"),
      "utf-8"
    );

    await pool.query(sql);
    console.log("✅ Database tables created successfully!");
    console.log("   - profiles (with auto-create trigger)");
    console.log("   - applications");
    console.log("   - documents");
    console.log("   - extractions");
    console.log("   - validations");
    console.log("   - recommendations");
    console.log("   - reports");
    console.log("   - agent_credentials");
    console.log("   - agent_runs");
    console.log("   - chat_messages");
    console.log("   - RLS policies enabled on all tables\n");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    if (err.message.includes("already exists")) {
      console.log("   (Tables may already exist — continuing...)");
    } else {
      throw err;
    }
  } finally {
    await pool.end();
  }
}

// ---- Step 2: Storage Bucket ----
async function setupStorage() {
  console.log("📦 Step 2/3: Setting up storage bucket...\n");
  
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3dmljcGtieHVianNwdWZveGVlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDQxMDY3NCwiZXhwIjoyMDk5OTg2Njc0fQ.kuAgSj_7lF-helVAPk4M-PHMvo_lU6tQec3A4sUcL7E";

  // Create bucket via REST API
  const res = await fetch(
    `https://${PROJECT_REF}.supabase.co/storage/v1/bucket`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
        "apikey": serviceKey,
      },
      body: JSON.stringify({
        name: "documents",
        public: false,
        file_size_limit: 10485760, // 10MB
        allowed_mime_types: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
      }),
    }
  );

  if (res.ok || res.status === 409) {
    console.log("✅ Storage bucket 'documents' ready!");
    if (res.status === 409) console.log("   (Bucket already existed)");
  } else {
    const err = await res.text();
    console.log(`⚠️  Storage bucket creation returned ${res.status}: ${err}`);
    console.log("   You can create it manually: Dashboard → Storage → New Bucket → 'documents'");
  }

  // Run storage policies via pg
  const pool = new pg.Pool({
    host: `db.${PROJECT_REF}.supabase.co`,
    port: 5432,
    database: "postgres",
    user: "postgres",
    password: DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    max: 1,
  });

  try {
    const storageSql = readFileSync(
      resolve(__dirname, "supabase", "migrations", "002_storage_and_secrets.sql"),
      "utf-8"
    );
    // Only run the policy parts (skip the comments)
    const policySql = storageSql
      .split("\n")
      .filter(line => !line.trim().startsWith("--") && line.trim())
      .join("\n");
    
    if (policySql) {
      await pool.query(policySql);
      console.log("✅ Storage RLS policies applied!\n");
    }
  } catch (err) {
    if (!err.message.includes("already exists")) {
      console.log(`⚠️  Storage policies: ${err.message}`);
    }
  } finally {
    await pool.end();
  }
}

// ---- Step 3: Instructions ----
function printNextSteps() {
  console.log("📦 Step 3/3: Edge Function deployment\n");
  console.log("The SQL and storage are set up. Now deploy the Edge Functions:\n");
  console.log("  # Login to Supabase CLI (opens browser)");
  console.log("  npx supabase login\n");
  console.log("  # Set secrets");
  console.log(`  npx supabase secrets set OPENAI_API_KEY="sk-proj-..." --project-ref ${PROJECT_REF}`);
  console.log(`  npx supabase secrets set AGENT_ENCRYPTION_KEY="$(openssl rand -hex 32)" --project-ref ${PROJECT_REF}\n`);
  console.log("  # Deploy all functions");
  console.log(`  npx supabase functions deploy chat --project-ref ${PROJECT_REF}`);
  console.log(`  npx supabase functions deploy pipeline --project-ref ${PROJECT_REF}`);
  console.log(`  npx supabase functions deploy run-agent --project-ref ${PROJECT_REF}`);
  console.log(`  npx supabase functions deploy autopilot --project-ref ${PROJECT_REF}\n`);
  console.log("  # Start the dev server");
  console.log("  npm run dev\n");
  console.log("═══════════════════════════════════════════════════");
  console.log("✅ Setup complete! Visit http://localhost:8080");
  console.log("═══════════════════════════════════════════════════\n");
}

// ---- Main ----
async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  RentReady AI — Project Setup");
  console.log("═══════════════════════════════════════════════════");

  await runMigrations();
  await setupStorage();
  printNextSteps();
}

main().catch((err) => {
  console.error("\n❌ Setup failed:", err.message);
  process.exit(1);
});
