/**
 * autopilot.client.ts
 *
 * Client-side replacement for autopilot.functions.ts.
 * Calls direct Supabase client queries for simple DB operations
 * and invokes the "autopilot" Edge Function for encryption and browser automation.
 */
import { supabase } from "@/integrations/supabase/client";

export type SavedCredential = {
  id: string;
  host: string;
  label: string | null;
  username: string;
  created_at: string;
};

export type AgentRun = {
  id: string;
  target_url: string;
  status: string;
  live_view_url: string | null;
  log: Array<{ ts: string; message: string }>;
  created_at: string;
};

// -------- Credentials (direct client queries where possible) --------

export async function listCredentials(): Promise<SavedCredential[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("agent_credentials")
    .select("id, host, label, username, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as SavedCredential[];
}

async function invokeAutopilot<T = any>(body: Record<string, unknown>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/autopilot`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: anonKey,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error || `Autopilot error: ${res.status}`);
  return json as T;
}

export async function saveCredential(input: {
  data: {
    url: string;
    username: string;
    password: string;
    label?: string;
  };
}): Promise<SavedCredential> {
  return invokeAutopilot({ action: "save-credential", ...input.data });
}

export async function deleteCredential(input: { data: { id: string } }): Promise<{ ok: boolean }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("agent_credentials")
    .delete()
    .eq("id", input.data.id)
    .eq("user_id", user.id);

  if (error) throw error;
  return { ok: true };
}

// -------- Runs (calls edge function) --------

export async function startAutopilotRun(params: {
  data: { targetUrl: string; credentialId: string | null };
}): Promise<AgentRun> {
  return invokeAutopilot({
    action: "start-run",
    targetUrl: params.data.targetUrl,
    credentialId: params.data.credentialId,
  });
}

export async function stopAutopilotRun(params: {
  data: { id: string };
}): Promise<{ ok: boolean }> {
  return invokeAutopilot({
    action: "stop-run",
    id: params.data.id,
  });
}
