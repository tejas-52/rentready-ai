// _shared/auth.ts — Verify JWT and return authenticated user context
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuthContext {
  userId: string;
  supabase: ReturnType<typeof createClient>;
}

export async function verifyAuth(req: Request): Promise<AuthContext | null> {
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7).trim();
  if (!token || token.split(".").length !== 3) return null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  if (!supabaseKey) throw new Error("Missing SUPABASE_ANON_KEY");

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;

  // Recreate client with service_role for DB writes
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return { userId: data.user.id, supabase: adminClient };
}
