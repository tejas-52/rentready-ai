/**
 * agent.client.ts
 *
 * Client-side wrapper for the run-agent Supabase Edge Function.
 * Replaces the old createServerFn-based agent.functions.ts.
 */
import { supabase } from "@/integrations/supabase/client";

export type AgentField = {
  label: string;
  value: string;
  status: "filled" | "review" | "missing";
  source?: string;
  note?: string;
};

export type AgentResult = {
  form_title: string;
  fields: AgentField[];
  summary: string;
};

export async function runApplicationAgent(params: {
  data: {
    fileDataUrl: string;
    fileName: string;
  };
}): Promise<AgentResult> {
  const { fileDataUrl, fileName } = params.data;
  if (!fileDataUrl.startsWith("data:")) {
    throw new Error("fileDataUrl must be a data: URL");
  }
  if (fileDataUrl.length > 20 * 1024 * 1024) {
    throw new Error("File too large (max ~15 MB).");
  }

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/run-agent`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: anonKey,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ fileDataUrl, fileName }),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error || `Agent error: ${res.status}`);
  }

  return json as AgentResult;
}
