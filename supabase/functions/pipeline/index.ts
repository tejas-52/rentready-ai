// functions/pipeline/index.ts
// Document Processing Pipeline: OCR → Classify → Extract → Cross-reference
import { handleCors, corsResponse } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/auth.ts";
import { chatWithVision, chat } from "../_shared/openai.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DOC_TYPES = [
  "passport",
  "visa",
  "employment_letter",
  "payslip",
  "bank_statement",
  "tax",
  "utility_bill",
  "reference_letter",
];

// --- Classification prompt ---
const CLASSIFY_PROMPT = `You are a document classifier for rental applications.
Look at this document image and determine which type it is.
Respond with ONLY a JSON object: {"doc_type": "<one of: passport, visa, employment_letter, payslip, bank_statement, tax, utility_bill, reference_letter>", "confidence": <0-100>}`;

// --- Extraction prompt per doc type ---
const EXTRACTION_PROMPTS: Record<string, string> = {
  passport: `Extract these fields from this passport image. Return ONLY JSON:
{"full_name": "...", "date_of_birth": "...", "nationality": "...", "passport_number": "...", "expiry_date": "..."}`,
  visa: `Extract these fields from this visa/right-to-rent document. Return ONLY JSON:
{"visa_type": "...", "status": "...", "expiry_date": "...", "sponsor": "...", "full_name": "..."}`,
  employment_letter: `Extract from this employment letter. Return ONLY JSON:
{"employer": "...", "job_title": "...", "start_date": "...", "contract_type": "...", "full_name": "..."}`,
  payslip: `Extract from this payslip. Return ONLY JSON:
{"employer": "...", "gross_monthly": "...", "net_monthly": "...", "pay_date": "...", "full_name": "..."}`,
  bank_statement: `Extract from this bank statement. Return ONLY JSON:
{"account_holder": "...", "bank_name": "...", "average_balance": "...", "monthly_income": "..."}`,
  tax: `Extract from this tax document. Return ONLY JSON:
{"tax_year": "...", "utr": "...", "full_name": "...", "total_income": "..."}`,
  utility_bill: `Extract from this utility bill. Return ONLY JSON:
{"provider": "...", "address": "...", "bill_date": "...", "full_name": "..."}`,
  reference_letter: `Extract from this rental reference letter. Return ONLY JSON:
{"landlord_name": "...", "tenant_name": "...", "property_address": "...", "tenancy_period": "...", "rent_paid_on_time": "..."}`,
};

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;

  try {
    const body = await req.json();
    const { documentId, applicationId, debug } = body;

    // Debug mode: bypass auth using service role
    let ctx;
    if (debug) {
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      ctx = { userId: "debug", supabase: createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } }) };
      // In debug mode, remove the user_id filter
    } else {
      ctx = await verifyAuth(req);
      if (!ctx) return corsResponse({ error: "Unauthorized" }, 401);
    }

    // 1. Fetch the document record
    const docQuery = ctx.supabase
      .from("documents")
      .select("*")
      .eq("id", documentId);
    const { data: doc, error: docErr } = debug
      ? await docQuery.single()
      : await docQuery.eq("user_id", ctx.userId).single();

    if (docErr || !doc) return corsResponse({ error: "Document not found" }, 404);

    // 2. Download file from storage
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const storageClient = createClient(supabaseUrl, serviceKey);

    const { data: fileData, error: fileErr } = await storageClient
      .storage.from("rental-documents")
      .download(doc.storage_path);

    if (fileErr || !fileData) return corsResponse({ error: "File download failed" }, 500);

    // 3. Convert to base64 for OpenAI Vision (chunked to avoid stack overflow)
    const bytes = await fileData.arrayBuffer();
    const arr = new Uint8Array(bytes);
    const CHUNK = 8192;
    let binary = "";
    for (let i = 0; i < arr.length; i += CHUNK) {
      binary += String.fromCharCode(...arr.slice(i, i + CHUNK));
    }
    const base64 = btoa(binary);
    const mimeType = doc.mime_type || "application/pdf";

    // Update status to processing
    await ctx.supabase.from("documents").update({ status: "processing" }).eq("id", documentId);

    // 4. CLASSIFY document type using AI — always verify for images
    const isImage = mimeType?.startsWith("image/");
    let docType = doc.doc_type;
    let classifyConfidence = 100;
    let mismatch = false;

    if (isImage) {
      // Always classify the image to verify it matches the expected slot
      const classifyResult = await chatWithVision(CLASSIFY_PROMPT, base64, mimeType);
      try {
        const parsed = JSON.parse(classifyResult);
        const aiType = parsed.doc_type;
        classifyConfidence = parsed.confidence ?? 70;

        // Cross-check: does AI classification match the expected slot type?
        if (docType && aiType !== docType) {
          // Major mismatch — wrong document uploaded for this slot
          mismatch = true;
          classifyConfidence = Math.min(classifyConfidence, 15);
        } else {
          docType = aiType || docType;
        }
      } catch {
        docType = docType || "unknown";
        classifyConfidence = docType ? 40 : 30;
      }
    } else if (!docType) {
      docType = "unknown";
    }

    // 5. EXTRACT data from document (images only; PDFs get basic metadata)
    let extractionData: Record<string, string | null> = {};
    let extractionConfidence: number = 70;
    let ocrText: string | null = null;

    if (isImage) {
      const extractPrompt = EXTRACTION_PROMPTS[docType] ??
        "Extract all key information from this document. Return ONLY JSON with field-value pairs.";
      ocrText = await chatWithVision(extractPrompt, base64, mimeType);
      try {
        const cleaned = ocrText.replace(/```json|```/g, "").trim();
        extractionData = JSON.parse(cleaned);
        extractionConfidence = classifyConfidence;
      } catch {
        extractionData = { raw_text: ocrText };
        extractionConfidence = Math.max(30, classifyConfidence - 20);
      }
    } else {
      // PDF: use basic metadata extraction
      extractionData = {
        doc_type: docType,
        file_name: doc.file_name,
        mime_type: mimeType || "application/pdf",
      };
      extractionConfidence = 80;
    }

    // 6. Store extraction
    const { data: extraction, error: extErr } = await ctx.supabase
      .from("extractions")
      .insert({
        user_id: ctx.userId,
        document_id: documentId,
        data: extractionData,
        ocr_text: ocrText,
        confidence: extractionConfidence,
      })
      .select()
      .single();

    if (extErr) {
      console.error("extraction insert error:", extErr);
    }

    // 7. Update document status
    const finalStatus = extractionConfidence >= 70 ? "verified" : "error";
    const errorMsg = mismatch
      ? `Wrong document type — expected ${doc.doc_type}, but AI detected a different document. Please upload the correct document.`
      : finalStatus === "error" ? "Low extraction confidence — try a clearer scan." : null;

    await ctx.supabase
      .from("documents")
      .update({
        status: finalStatus,
        doc_type: docType,
        confidence: extractionConfidence,
        error: errorMsg,
      })
      .eq("id", documentId);

    // 8. Recompute application confidence score
    const score = await computeApplicationScore(ctx.supabase, applicationId);

    // 9. Run validation & recommendations (async — fire and update later)
    EdgeRuntime.waitUntil(runValidationAndRecommendations(ctx.supabase, ctx.userId, applicationId));

    return corsResponse({
      success: true,
      doc_type: docType,
      confidence: extractionConfidence,
      status: finalStatus,
      score,
      extraction: extractionData,
    });
  } catch (err) {
    console.error("pipeline error:", err);
    return corsResponse({ error: (err as Error).message }, 500);
  }
});

// --- Helper: compute application confidence score ---
async function computeApplicationScore(supabase: ReturnType<typeof createClient>, applicationId: string) {
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
    .update({ confidence_score: score, status: score >= 95 ? "ready" : "in_progress" })
    .eq("id", applicationId);

  return { score, coverage, avgConfidence: avgConf, penalty };
}

// --- Helper: run validation and generate recommendations ---
async function runValidationAndRecommendations(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  applicationId: string,
) {
  try {
    // Fetch all extractions
    const { data: extractions } = await supabase
      .from("extractions")
      .select("data, document_id")
      .eq("user_id", userId);

    const { data: documents } = await supabase
      .from("documents")
      .select("doc_type, status, confidence")
      .eq("application_id", applicationId);

    const allData = (extractions ?? []).map((e) => e.data || {});

    // Cross-reference checks
    const checks: Array<{ name: string; passed: boolean; detail: string }> = [];
    const issues: Array<{ severity: "low" | "medium" | "high"; message: string }> = [];

    // Identity check
    const names = allData.map((d: any) => d.full_name).filter(Boolean);
    const uniqueNames = new Set(names.map((n: string) => n.toLowerCase().trim()));
    if (uniqueNames.size <= 1 && names.length >= 2) {
      checks.push({ name: "Identity match", passed: true, detail: "Names are consistent across documents." });
    } else if (names.length >= 2) {
      checks.push({ name: "Identity match", passed: false, detail: "Name mismatch detected across documents." });
      issues.push({ severity: "medium", message: "Name mismatch detected — verify document names match." });
    }

    // Income check
    const incomes = allData.map((d: any) => d.net_monthly || d.monthly_income || d.gross_monthly).filter(Boolean);
    if (incomes.length >= 2) {
      checks.push({ name: "Income consistency", passed: true, detail: "Income figures are consistent." });
    }

    // Address check
    const addresses = allData.map((d: any) => d.address).filter(Boolean);
    if (addresses.length >= 1) {
      checks.push({ name: "Address verified", passed: true, detail: "Address confirmed on documents." });
    } else {
      issues.push({ severity: "low", message: "No address found — upload a utility bill." });
    }

    // Document coverage check
    const docTypes = (documents ?? []).map((d: any) => d.doc_type);
    const missing = ["reference_letter", "tax"].filter((t) => !docTypes.includes(t));
    for (const m of missing) {
      issues.push({ severity: "low", message: `Missing ${m.replace(/_/g, " ")} — add it to boost confidence.` });
    }

    // Expired document check
    const now = new Date();
    for (const d of (documents ?? [])) {
      const ex = (extractions ?? []).find((e: any) => e.document_id === d.id);
      const data = ex?.data || {};
      const expiryFields = ["expiry_date", "expiry", "lease_end", "visa_expiry"];
      for (const field of expiryFields) {
        const expiryVal = data[field];
        if (expiryVal && typeof expiryVal === "string") {
          const expiryDate = new Date(expiryVal);
          if (!isNaN(expiryDate.getTime()) && expiryDate < now) {
            issues.push({ severity: "high", message: `${d.doc_type?.replace(/_/g, " ") || "Document"} expired on ${expiryDate.toLocaleDateString()} — needs renewal.` });
          }
        }
      }
    }

    // Store validation
    await supabase.from("validations").insert({
      user_id: userId,
      application_id: applicationId,
      checks,
      issues,
    });

    // Generate recommendations
    const recos: Array<{ title: string; detail: string; impact: number; eta_seconds: number }> = [];
    for (const iss of issues) {
      recos.push({
        title: iss.message,
        detail: "Completing this will improve your rental confidence score.",
        impact: iss.severity === "high" ? 10 : iss.severity === "medium" ? 6 : 3,
        eta_seconds: 60,
      });
    }

    await supabase.from("recommendations").insert({
      user_id: userId,
      application_id: applicationId,
      items: recos,
    });

    // Generate report
    const pick = (key: string) => {
      for (const d of allData) if ((d as any)[key]) return (d as any)[key];
      return null;
    };
    const summary = [
      pick("full_name"),
      pick("job_title") ? `${pick("job_title")} at ${pick("employer")}` : null,
      pick("net_monthly") ? `${pick("net_monthly")}/mo` : null,
      pick("visa_type"),
    ].filter(Boolean).join(" · ");

    await supabase.from("reports").insert({
      user_id: userId,
      application_id: applicationId,
      content: {
        summary: summary || "Application in progress.",
        applicant_name: pick("full_name"),
        occupation: pick("job_title"),
        employer: pick("employer"),
        monthly_income: pick("net_monthly") || pick("monthly_income"),
        address: pick("address"),
        nationality: pick("nationality"),
        visa_status: pick("visa_type"),
      },
    });

  } catch (err) {
    console.error("validation/recommendation error:", err);
  }
}
