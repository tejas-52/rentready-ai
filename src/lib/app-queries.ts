import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { DOC_SLOTS, type DocSlot, type DocStatus } from "@/lib/document-registry";

// ---------- Row types ----------

type ApplicationRow = {
  id: string;
  user_id: string;
  status: string;
  confidence_score: number | null;
  summary: unknown;
  created_at: string;
  updated_at: string;
};

type DocumentRow = {
  id: string;
  application_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  doc_type: string | null;
  status: string;
  confidence: number | null;
  error: string | null;
  created_at: string;
};

type ExtractionRow = {
  id: string;
  document_id: string;
  data: Record<string, string | null> | null;
  confidence: number | null;
  created_at: string;
};

type ValidationIssue = { severity: "low" | "medium" | "high"; message: string };
type ValidationCheck = { name: string; passed: boolean; detail: string };

type ValidationRow = {
  id: string;
  checks: ValidationCheck[];
  issues: ValidationIssue[];
  created_at: string;
} | null;

type Recommendation = { title: string; detail?: string; impact: number; eta_seconds?: number };
type RecommendationRow = { id: string; items: Recommendation[]; created_at: string } | null;

type ReportRow = { id: string; content: any; created_at: string } | null;

// ---------- Derived UI shapes ----------

export interface DocumentUI extends DocSlot {
  status: DocStatus;
  confidence: number | null; // 0-100
  issue?: string;
  extracted?: { label: string; value: string }[];
  document?: DocumentRow;
  extraction?: ExtractionRow;
}

export interface AppState {
  application: ApplicationRow | null;
  documents: DocumentUI[]; // canonical slot list
  otherDocuments: DocumentUI[]; // uploaded docs that don't match a slot
  extractionsByDoc: Record<string, ExtractionRow>;
  validation: ValidationRow;
  recommendation: RecommendationRow;
  report: ReportRow;
  /** 0-100 */
  confidence: number;
  verifiedCount: number;
  totalSlots: number;
  profileSummary: {
    fullName: string | null;
    occupation: string | null;
    employer: string | null;
    monthlyIncome: string | null;
    address: string | null;
    nationality: string | null;
    visaStatus: string | null;
    dob: string | null;
  };
  journey: { id: string; name: string; done: boolean; active?: boolean; locked?: boolean }[];
  timeline: { name: string; date: string; done: boolean; iconKey: string }[];
  activityFeed: { text: string; meta?: string; tone: "success" | "warn"; iconKey: "check" | "zap" }[];
  smartChecklist: { name: string; eta: string; impact: number }[];
  improvements: { title: string; impact: number }[];
  insight: { title: string; body: string };
  radarAxes: { key: string; label: string; value: number }[];
  recentUploads: DocumentUI[];
}

// ---------- Helpers ----------

function firstNonEmpty<T>(vals: (T | null | undefined | "")[]): T | null {
  for (const v of vals) if (v) return v as T;
  return null;
}

function toPct(x: number | null | undefined): number {
  if (x == null) return 0;
  const n = Number(x);
  if (!isFinite(n)) return 0;
  return n <= 1 ? Math.round(n * 100) : Math.round(n);
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function humanizeExtraction(data: Record<string, string | null> | null | undefined) {
  if (!data) return [];
  return Object.entries(data)
    .filter(([, v]) => v)
    .slice(0, 6)
    .map(([k, v]) => ({ label: k.replace(/_/g, " "), value: String(v) }));
}

const EMPTY_STATE: AppState = {
  application: null,
  documents: DOC_SLOTS.map((s) => ({ ...s, status: "missing", confidence: null })),
  otherDocuments: [],
  extractionsByDoc: {},
  validation: null,
  recommendation: null,
  report: null,
  confidence: 0,
  verifiedCount: 0,
  totalSlots: DOC_SLOTS.length,
  profileSummary: {
    fullName: null, occupation: null, employer: null, monthlyIncome: null,
    address: null, nationality: null, visaStatus: null, dob: null,
  },
  journey: [
    { id: "identity", name: "Identity", done: false, active: true },
    { id: "income", name: "Income", done: false },
    { id: "employment", name: "Employment", done: false },
    { id: "residence", name: "Residence", done: false },
    { id: "review", name: "Review", done: false, locked: true },
  ],
  timeline: [],
  activityFeed: [],
  smartChecklist: [],
  improvements: [],
  insight: {
    title: "Upload your first document",
    body: "Start with your passport — AI will read it and begin scoring your application.",
  },
  radarAxes: [
    { key: "identity", label: "Identity", value: 0 },
    { key: "income", label: "Income", value: 0 },
    { key: "employment", label: "Employment", value: 0 },
    { key: "residence", label: "Residence", value: 0 },
  ],
  recentUploads: [],
};

// ---------- Builder ----------

function buildState(
  app: ApplicationRow | null,
  docs: DocumentRow[],
  extractions: ExtractionRow[],
  validation: ValidationRow,
  recommendation: RecommendationRow,
  report: ReportRow,
): AppState {
  const extractionsByDoc: Record<string, ExtractionRow> = {};
  for (const e of extractions) extractionsByDoc[e.document_id] = e;

  // group uploaded docs by classified doc_type
  const bySlot: Record<string, DocumentRow[]> = {};
  const unmatched: DocumentRow[] = [];
  for (const d of docs) {
    const slot = DOC_SLOTS.find((s) => s.dbType === d.doc_type);
    if (slot) (bySlot[slot.id] ??= []).push(d);
    else unmatched.push(d);
  }

  const slotUI: DocumentUI[] = DOC_SLOTS.map((slot) => {
    const rows = (bySlot[slot.id] ?? []).sort(
      (a, b) => {
        // Prefer documents with confidence over ones without
        const aConf = a.confidence ?? 0;
        const bConf = b.confidence ?? 0;
        if (aConf !== bConf) return bConf - aConf;
        return +new Date(b.created_at) - +new Date(a.created_at);
      },
    );
    const best = rows[0];
    if (!best) return { ...slot, status: "missing", confidence: null };
    const ex = extractionsByDoc[best.id];
    const conf = toPct(best.confidence);
    let status: DocStatus = "pending";
    if (best.status === "verified") status = conf < 70 ? "issue" : "verified";
    else if (best.status === "error") status = "issue";
    else status = "pending";
    return {
      ...slot,
      status,
      confidence: conf,
      issue: best.error || (status === "issue" && conf < 70 ? "Low confidence — try a clearer scan." : undefined),
      extracted: humanizeExtraction(ex?.data),
      document: best,
      extraction: ex,
    };
  });

  const otherDocuments: DocumentUI[] = unmatched.map((d) => {
    const ex = extractionsByDoc[d.id];
    const conf = toPct(d.confidence);
    return {
      id: d.id, dbType: d.doc_type || "unknown", nameKey: "documents.names.unknown",
      fallbackName: d.file_name, icon: DOC_SLOTS[5].icon,
      status: d.status === "verified" ? "verified" : d.status === "error" ? "issue" : "pending",
      confidence: conf, extracted: humanizeExtraction(ex?.data), document: d, extraction: ex,
    };
  });

  const verifiedCount = slotUI.filter((s) => s.status === "verified").length;
  const confidence = toPct(app?.confidence_score);

  // Profile summary from best-of extractions
  const allData = extractions.map((e) => e.data || {});
  const pick = (key: string) => firstNonEmpty(allData.map((d) => (d as any)[key]));
  const profileSummary = {
    fullName: pick("full_name"),
    occupation: pick("job_title"),
    employer: pick("employer"),
    monthlyIncome: pick("monthly_income"),
    address: pick("address"),
    nationality: pick("nationality"),
    visaStatus: pick("visa_status"),
    dob: pick("date_of_birth"),
  };

  // Journey mapping
  const idOk = ["passport", "visa"].some((id) => slotUI.find((s) => s.id === id)?.status === "verified");
  const incomeOk = ["payslip", "bank"].some((id) => slotUI.find((s) => s.id === id)?.status === "verified");
  const employmentOk = slotUI.find((s) => s.id === "employment")?.status === "verified";
  const residenceOk = slotUI.find((s) => s.id === "utility")?.status === "verified";
  const reviewOk = !!report && idOk && incomeOk && employmentOk && residenceOk;
  const journeyRaw = [
    { id: "identity", done: idOk },
    { id: "income", done: incomeOk },
    { id: "employment", done: employmentOk },
    { id: "residence", done: residenceOk },
    { id: "review", done: reviewOk },
  ];
  const firstUndone = journeyRaw.findIndex((s) => !s.done);
  const journey = journeyRaw.map((s, i) => ({
    id: s.id,
    name: s.id.charAt(0).toUpperCase() + s.id.slice(1),
    done: s.done,
    active: !s.done && i === firstUndone,
    locked: !s.done && i > firstUndone,
  }));

  // Timeline (Report)
  const timeline: AppState["timeline"] = [];
  if (app) timeline.push({ name: "Application Created", date: formatDate(app.created_at), done: true, iconKey: "file" });
  const stageDefs: { name: string; iconKey: string; ok: boolean; when: string | null }[] = [
    { name: "Identity Verified",   iconKey: "badge", ok: idOk,
      when: slotUI.find((s) => s.id === "passport" && s.status === "verified")?.document?.created_at ?? null },
    { name: "Employment Verified", iconKey: "briefcase", ok: employmentOk,
      when: slotUI.find((s) => s.id === "employment" && s.status === "verified")?.document?.created_at ?? null },
    { name: "Income Verified",     iconKey: "banknote", ok: incomeOk,
      when: slotUI.find((s) => (s.id === "payslip" || s.id === "bank") && s.status === "verified")?.document?.created_at ?? null },
    { name: "Residence Verified",  iconKey: "home", ok: residenceOk,
      when: slotUI.find((s) => s.id === "utility" && s.status === "verified")?.document?.created_at ?? null },
    { name: "Application Ready",   iconKey: "badge", ok: reviewOk,
      when: report?.created_at ?? null },
  ];
  for (const s of stageDefs) {
    timeline.push({ name: s.name, done: s.ok, date: s.ok && s.when ? formatDate(s.when) : (s.ok ? "—" : "Pending"), iconKey: s.iconKey });
  }

  // Activity feed
  const activityFeed: AppState["activityFeed"] = [];
  const verifiedByDate = slotUI
    .filter((s) => s.status === "verified" && s.document && s.confidence != null)
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0));
  for (const s of verifiedByDate.slice(0, 4)) {
    activityFeed.push({
      text: `${s.fallbackName} verified`,
      meta: s.confidence != null ? `${s.confidence}%` : undefined,
      tone: "success",
      iconKey: "check",
    });
  }
  for (const iss of (validation?.issues ?? []).slice(0, 3)) {
    activityFeed.push({ text: iss.message, tone: "warn", iconKey: "zap" });
  }
  if (activityFeed.length === 0 && verifiedCount > 0) {
    activityFeed.push({ text: "No issues detected across your documents.", tone: "success", iconKey: "check" });
  }

  // Smart checklist / improvements from recommendations, fallback to missing slots
  const recos = recommendation?.items ?? [];
  const smartChecklist = recos.slice(0, 2).map((r) => ({
    name: r.title,
    eta: r.eta_seconds ? `${Math.max(5, Math.round(r.eta_seconds))} sec` : "—",
    impact: Math.max(1, Math.round(r.impact ?? 1)),
  }));
  const improvements = recos.slice(0, 3).map((r) => ({
    title: r.title,
    impact: Math.max(1, Math.round(r.impact ?? 1)),
  }));
  if (smartChecklist.length === 0) {
    for (const s of slotUI.filter((x) => x.status === "missing").slice(0, 2)) {
      smartChecklist.push({ name: `Upload ${s.fallbackName.toLowerCase()}`, eta: "20 sec", impact: 5 });
    }
  }
  if (improvements.length === 0) {
    for (const s of slotUI.filter((x) => x.status !== "verified").slice(0, 3)) {
      improvements.push({ title: `Add ${s.fallbackName.toLowerCase()}`, impact: 4 });
    }
  }

  // Insight
  let insight = EMPTY_STATE.insight;
  if (confidence >= 95) {
    insight = { title: "Your application is Excellent", body: "You're ready to submit with total confidence." };
  } else if (confidence > 0) {
    const gap = Math.max(1, 95 - confidence);
    const next = smartChecklist[0]?.name ?? "adding a fresh document";
    insight = {
      title: `You're ${gap}% away from Excellent`,
      body: `${next} will move your score into the highest tier.`,
    };
  }

  // Radar axes
  const radarAxes = [
    { key: "identity", label: "Identity",
      value: Math.max(
        slotUI.find((s) => s.id === "passport")?.confidence ?? 0,
        slotUI.find((s) => s.id === "visa")?.confidence ?? 0,
      ) },
    { key: "income", label: "Income",
      value: Math.max(
        slotUI.find((s) => s.id === "payslip")?.confidence ?? 0,
        slotUI.find((s) => s.id === "bank")?.confidence ?? 0,
      ) },
    { key: "employment", label: "Employment",
      value: slotUI.find((s) => s.id === "employment")?.confidence ?? 0 },
    { key: "residence", label: "Residence",
      value: slotUI.find((s) => s.id === "utility")?.confidence ?? 0 },
  ];

  // Recent uploads = latest 3 verified
  const recentUploads = [...slotUI]
    .filter((s) => s.status === "verified" && s.document && s.confidence != null)
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
    .slice(0, 3);

  return {
    application: app,
    documents: slotUI,
    otherDocuments,
    extractionsByDoc,
    validation,
    recommendation,
    report,
    confidence,
    verifiedCount,
    totalSlots: DOC_SLOTS.length,
    profileSummary,
    journey,
    timeline,
    activityFeed,
    smartChecklist,
    improvements,
    insight,
    radarAxes,
    recentUploads,
  };
}

// ---------- Hook ----------

export function useAppState() {
  const { user, isDemo } = useAuth();
  const key = user?.id ?? (isDemo ? "demo" : "anon");
  return useQuery<AppState>({
    queryKey: ["app-state", key],
    enabled: !!user || isDemo,
    staleTime: isDemo ? Infinity : 15_000,
    queryFn: async () => {
      // If user is authenticated (including demo), fetch real data
      if (user) {
        const { data: app } = await supabase
          .from("applications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!app) return { ...EMPTY_STATE, application: null };

        const [docsRes, exRes, valRes, recoRes, reportRes] = await Promise.all([
          supabase.from("documents").select("*").eq("application_id", app.id).order("created_at", { ascending: true }),
          supabase.from("extractions").select("*").eq("user_id", user.id),
          supabase.from("validations").select("*").eq("application_id", app.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("recommendations").select("*").eq("application_id", app.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("reports").select("*").eq("application_id", app.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        ]);

        return buildState(
          app as ApplicationRow,
          (docsRes.data ?? []) as DocumentRow[],
          (exRes.data ?? []) as ExtractionRow[],
          (valRes.data as ValidationRow) ?? null,
          (recoRes.data as RecommendationRow) ?? null,
          (reportRes.data as ReportRow) ?? null,
        );
      }

      // No authenticated user — use demo data if in demo mode
      if (isDemo) {
        const { DEMO_APP_STATE } = await import("@/lib/demo-data");
        return DEMO_APP_STATE;
      }
      return EMPTY_STATE;
    },
  });
}

export const emptyAppState: AppState = EMPTY_STATE;
