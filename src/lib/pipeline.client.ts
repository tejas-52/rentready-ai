/**
 * pipeline.client.ts
 *
 * Client-side wrappers that call Supabase Edge Functions for all AI pipeline steps.
 * Replaces the old createServerFn-based pipeline.functions.ts.
 */
import { supabase } from "@/integrations/supabase/client";

async function invoke<T = any>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fn}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: anonKey,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const json = await res.json();

  if (!res.ok) {
    throw new Error(json?.error || `Pipeline error: ${res.status}`);
  }

  return json as T;
}

// ---------- 1. Ensure application ----------

export async function getOrCreateApplication() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Try to get existing application
  const { data: existing } = await supabase
    .from("applications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  // Create new application
  const { data, error } = await supabase
    .from("applications")
    .insert({ user_id: user.id, status: "draft" })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// ---------- 2. Register document ----------

export async function registerDocument(params: {
  data: {
    applicationId: string;
    storagePath: string;
    fileName: string;
    mimeType: string;
    docType?: string;
  };
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("documents")
    .insert({
      user_id: user.id,
      application_id: params.data.applicationId,
      storage_path: params.data.storagePath,
      file_name: params.data.fileName,
      name: params.data.fileName,
      mime_type: params.data.mimeType,
      doc_type: params.data.docType || null,
      category: "unknown",
      status: "uploaded",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}


// ---------- 3-9. Full pipeline (Edge Function) ----------

export async function runPipelineForDocument(params: {
  data: {
    documentId: string;
    applicationId: string;
  };
}) {
  return invoke<{ score: number; coverage: number; avgConfidence: number; penalty: number }>(
    "pipeline",
    params.data,
  );
}

// ---------- Standalone pipeline steps ----------

export async function runValidation(applicationId: string) {
  return invoke("run-validation", { applicationId });
}

export async function generateRecommendations(applicationId: string) {
  return invoke("generate-recommendations", { applicationId });
}

export async function generateReport(applicationId: string) {
  return invoke("generate-report", { applicationId });
}

export async function computeConfidence(applicationId: string) {
  const { data: docs } = await supabase
    .from("documents")
    .select("doc_type, confidence, status")
    .eq("application_id", applicationId);

  const { data: val } = await supabase
    .from("validations")
    .select("issues")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const required = ["passport", "employment_letter", "payslip", "utility_bill"];
  const present = new Set(
    (docs ?? []).filter((d: any) => d.status === "verified").map((d: any) => d.doc_type),
  );
  const coverage = required.filter((r) => present.has(r)).length / required.length;
  const avgConf =
    (docs ?? []).reduce((s: number, d: any) => s + (Number(d.confidence) || 0), 0) /
    Math.max(1, docs?.length ?? 1);
  const issues = (val?.issues ?? []) as Array<{ severity: string }>;
  const penalty = issues.reduce(
    (s, i) => s + (i.severity === "high" ? 15 : i.severity === "medium" ? 7 : 2),
    0,
  );
  const score = Math.max(0, Math.min(100, Math.round(coverage * 60 + avgConf * 40 - penalty)));

  await supabase
    .from("applications")
    .update({ confidence_score: score })
    .eq("id", applicationId);

  return { score, coverage, avgConfidence: avgConf, penalty };
}
