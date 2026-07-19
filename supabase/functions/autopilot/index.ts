// functions/autopilot/index.ts
// Autopilot: Credential encryption + browser automation management
import { handleCors, corsResponse } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";

// Simple AES-GCM encryption using Web Crypto API
const ENCRYPTION_KEY_HEX = Deno.env.get("AGENT_ENCRYPTION_KEY") ?? "";

async function getCryptoKey(): Promise<CryptoKey> {
  const keyBytes = new Uint8Array(
    ENCRYPTION_KEY_HEX.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
  );
  return await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encrypt(plaintext: string): Promise<string> {
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded,
  );
  // Return iv + ciphertext as hex
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return Array.from(combined).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function decrypt(hexCiphertext: string): Promise<string> {
  const key = await getCryptoKey();
  const bytes = new Uint8Array(
    hexCiphertext.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
  );
  const iv = bytes.slice(0, 12);
  const ciphertext = bytes.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(decrypted);
}

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const ctx = await verifyAuth(req);
    if (!ctx) return corsResponse({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { action } = body;

    switch (action) {
      // ----- SAVE CREDENTIAL -----
      case "save-credential": {
        const { url, username, password, label } = body;
        if (!url || !username || !password) {
          return corsResponse({ error: "url, username, and password are required" }, 400);
        }

        const ciphertext = await encrypt(password);
        const host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;

        const { data, error } = await ctx.supabase
          .from("agent_credentials")
          .insert({
            user_id: ctx.userId,
            host,
            label: label || host,
            username,
            password_ciphertext: ciphertext,
          })
          .select("id, host, label, username, created_at")
          .single();

        if (error) throw new Error(error.message);
        return corsResponse(data);
      }

      // ----- START RUN -----
      case "start-run": {
        const { targetUrl, credentialId } = body;
        if (!targetUrl) {
          return corsResponse({ error: "targetUrl is required" }, 400);
        }

        // Create the run record
        const { data: run, error: runErr } = await ctx.supabase
          .from("agent_runs")
          .insert({
            user_id: ctx.userId,
            target_url: targetUrl,
            credential_id: credentialId || null,
            status: "running",
            log: [{ ts: new Date().toISOString(), message: "Browser session starting..." }],
          })
          .select("*")
          .single();

        if (runErr) throw new Error(runErr.message);

        // If we had Browserbase/Playwright integration, we'd launch it here.
        // For now, simulate the run completing.
        const liveViewUrl = `https://supabase.com/dashboard/project/awvicpkbxubjspufoxee`;

        // If a credential was specified, fetch and decrypt it
        let decryptedPassword: string | null = null;
        if (credentialId) {
          const { data: cred } = await ctx.supabase
            .from("agent_credentials")
            .select("password_ciphertext")
            .eq("id", credentialId)
            .eq("user_id", ctx.userId)
            .single();

          if (cred?.password_ciphertext) {
            try {
              decryptedPassword = await decrypt(cred.password_ciphertext);
            } catch {
              // Decryption failed — log but continue
              console.error("Failed to decrypt credential");
            }
          }
        }

        // Simulate browser automation steps
        const log = [
          { ts: new Date().toISOString(), message: "Browser session starting..." },
          { ts: new Date().toISOString(), message: `Navigating to ${targetUrl}...` },
          { ts: new Date().toISOString(), message: "Page loaded successfully." },
          { ts: new Date().toISOString(), message: cred?.password_ciphertext
            ? "Credentials available for auto-fill."
            : "No credentials — manual login required." },
          { ts: new Date().toISOString(), message: "Ready for interaction." },
        ];

        await ctx.supabase
          .from("agent_runs")
          .update({ log, live_view_url: liveViewUrl })
          .eq("id", run.id);

        return corsResponse({
          ...run,
          live_view_url: liveViewUrl,
          log,
          _note: "Browserbase/Playwright integration not yet configured. This is a simulated run.",
        });
      }

      // ----- STOP RUN -----
      case "stop-run": {
        const { id } = body;
        if (!id) return corsResponse({ error: "id is required" }, 400);

        const { error } = await ctx.supabase
          .from("agent_runs")
          .update({ status: "completed" })
          .eq("id", id)
          .eq("user_id", ctx.userId);

        if (error) throw new Error(error.message);
        return corsResponse({ ok: true });
      }

      default:
        return corsResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error("autopilot error:", err);
    return corsResponse({ error: (err as Error).message }, 500);
  }
});
