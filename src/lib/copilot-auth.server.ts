import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function isNewKey(v: string) {
  return v.startsWith("sb_publishable_") || v.startsWith("sb_secret_");
}

function makeFetch(key: string): typeof fetch {
  return (input, init) => {
    const h = new Headers(init?.headers);
    if (isNewKey(key) && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
    h.set("apikey", key);
    return fetch(input, { ...init, headers: h });
  };
}

export type AuthedContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
};

export async function verifyBearer(request: Request): Promise<AuthedContext | null> {
  const auth = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token || token.split(".").length !== 3) return null;

  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  if (!url || !key) return null;

  const supabase = createClient<Database>(url, key, {
    global: { fetch: makeFetch(key), headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  return { supabase, userId: data.claims.sub as string };
}
