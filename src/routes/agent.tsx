import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Sparkles,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AppLayout } from "@/components/app-layout";
import { SectionHeader } from "@/components/ui-bits";
import { AutopilotPanel } from "@/components/autopilot-panel";
import { runApplicationAgent, type AgentField, type AgentResult } from "@/lib/agent.client";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { Bot, FileText as FileTextIcon, Globe as GlobeIcon } from "lucide-react";

export const Route = createFileRoute("/agent")({
  head: () => ({
    meta: [
      { title: "Application Agent — RentReady AI" },
      {
        name: "description",
        content:
          "Upload any rental application form and let the RentReady agent auto-fill it from your verified profile.",
      },
    ],
  }),
  component: AgentPage,
});

const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp";
const MAX_BYTES = 12 * 1024 * 1024;

function AgentPage() {
  const { t } = useTranslation();
  const { isDemo } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"upload" | "autopilot">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AgentResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const readFileAsDataUrl = (f: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(f);
    });

  const acceptFile = useCallback((f: File) => {
    if (f.size > MAX_BYTES) {
      toast.error(t("agent.errors.tooLarge", { defaultValue: "File is too large (max 12 MB)." }));
      return;
    }
    setFile(f);
    setResult(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
  }, [previewUrl, t]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) acceptFile(f);
  };

  const runAgent = async () => {
    if (!file || busy) return;
    setBusy(true);
    try {
      if (isDemo) {
        // Demo mode: simulate agent result without calling Edge Function
        await new Promise((r) => setTimeout(r, 1500));
        const demoResult: AgentResult = {
          form_title: file.name || "Rental Application Form",
          fields: [
            { label: "Full Name", value: "John Carter", status: "filled", source: "passport", note: "Verified from passport" },
            { label: "Date of Birth", value: "12 Aug 1993", status: "filled", source: "passport", note: "Verified from passport" },
            { label: "Nationality", value: "British", status: "filled", source: "passport" },
            { label: "Current Address", value: "18 Redchurch St, London E2 7DP", status: "filled", source: "utility_bill" },
            { label: "Employer", value: "Northwind Labs", status: "filled", source: "employment_letter" },
            { label: "Job Title", value: "Senior Product Designer", status: "filled", source: "employment_letter" },
            { label: "Monthly Income", value: "£4,920", status: "filled", source: "payslip" },
            { label: "Visa Status", value: "Skilled Worker (valid until Mar 2027)", status: "filled", source: "visa" },
            { label: "Previous Landlord Phone", value: "", status: "review", note: "Not in your documents yet" },
            { label: "Emergency Contact", value: "", status: "missing" },
          ],
          summary: "9 of 11 fields filled from your verified profile. 1 field needs review, 1 is missing.",
        };
        setResult(demoResult);
        toast.success(t("agent.toasts.done", { defaultValue: "Form analyzed." }));
        setBusy(false);
        return;
      }
      const dataUrl = await readFileAsDataUrl(file);
      const r = await runApplicationAgent({
        data: { fileDataUrl: dataUrl, fileName: file.name },
      });
      setResult(r);
      toast.success(t("agent.toasts.done", { defaultValue: "Form analyzed." }));
    } catch (err) {
      console.error(err);
      toast.error(
        (err as Error)?.message ??
          t("agent.errors.failed", { defaultValue: "Agent failed. Please try again." }),
      );
    } finally {
      setBusy(false);
    }
  };

  const updateField = (i: number, patch: Partial<AgentField>) => {
    if (!result) return;
    setResult({
      ...result,
      fields: result.fields.map((f, idx) => (idx === i ? { ...f, ...patch } : f)),
    });
  };

  const [fillAllBusy, setFillAllBusy] = useState(false);

  const fillAllWithAI = async () => {
    if (!result || fillAllBusy) return;
    setFillAllBusy(true);
    try {
      const filled = result.fields.filter(f => f.value?.trim()).map(f => `${f.label}: ${f.value}`).join("\n");
      const unfilled = result.fields.filter(f => !f.value?.trim()).map(f => f.label).join(", ");
      const prompt = `I'm filling a rental application form. Already filled:\n${filled}\n\nPlease suggest values for these missing fields: ${unfilled}\n\nReturn ONLY a JSON object like: {"Field Name": "suggested value", ...}`;
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`, { method: "POST", headers, body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }) });
      const json = await res.json();
      const aiText = json?.text || "";
      try {
        const cleaned = aiText.replace(/```json|```/g, "").trim();
        const suggestions = JSON.parse(cleaned);
        setResult(prev => prev ? { ...prev, fields: prev.fields.map(f => { if (f.value?.trim()) return f; const s = suggestions[f.label]; return s ? { ...f, value: s, status: "review" as const, note: "AI suggested — please verify" } : f; }) } : prev);
        toast.success("AI filled remaining fields");
      } catch { toast.error("Could not parse AI suggestions"); }
    } catch (e) { toast.error("AI fill failed"); }
    finally { setFillAllBusy(false); }
  };

  const counts = useMemo(() => {
    const c = { filled: 0, review: 0, missing: 0 };
    result?.fields.forEach((f) => {
      c[f.status] += 1;
    });
    return c;
  }, [result]);

  const exportJson = () => {
    if (!result) return;
    const json = JSON.stringify(result, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(file?.name ?? "application").replace(/\.[^.]+$/, "")}-filled.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const exportPrintable = () => {
    if (!result) return;
    const rows = result.fields
      .map(
        (f) => `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;width:38%;font-weight:600;color:#111">${escapeHtml(f.label)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#111">${escapeHtml(f.value || "—")}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:12px;color:${statusColor(f.status)};text-transform:uppercase;letter-spacing:.08em">${f.status}</td>
        </tr>`,
      )
      .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(result.form_title)}</title></head>
    <body style="font-family:-apple-system,Inter,Segoe UI,sans-serif;background:#fff;color:#111;padding:32px;max-width:820px;margin:auto">
      <div style="font-size:12px;letter-spacing:.14em;color:#666;text-transform:uppercase">RentReady Autofill Preview</div>
      <h1 style="margin:6px 0 4px 0;font-size:26px">${escapeHtml(result.form_title)}</h1>
      <div style="color:#555;margin-bottom:20px">${escapeHtml(result.summary)}</div>
      <table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>
      <div style="margin-top:24px;font-size:12px;color:#888">Draft only — review and transfer to the official form before submitting.</div>
      <script>window.onload=()=>window.print()</script>
    </body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  return (
    <AppLayout>
      <SectionHeader
        eyebrow={t("nav.agent", { defaultValue: "Autofill" })}
        title={t("agent.title", { defaultValue: "Application Agent" })}
        subtitle={t("agent.subtitle", {
          defaultValue:
            "Upload any rental application form. The agent will read it, match every field with your verified data, and show you a color-coded preview before you submit.",
        })}
      />

      {/* Mode switcher */}
      <div className="mb-4 inline-flex rounded-2xl border border-border/60 bg-card p-1">
        {([
          { key: "upload", label: "Upload form", Icon: FileTextIcon },
          { key: "autopilot", label: "Autopilot (Live)", Icon: GlobeIcon },
        ] as const).map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={`relative flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-sm font-medium transition-colors ${
              mode === key ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {mode === key && (
              <motion.span
                layoutId="agent-mode"
                className="absolute inset-0 rounded-xl bg-background shadow-sm"
                transition={{ type: "spring", stiffness: 500, damping: 34 }}
              />
            )}
            <Icon className="relative h-3.5 w-3.5" />
            <span className="relative">{label}</span>
            {key === "autopilot" && (
              <span className="relative rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                BETA
              </span>
            )}
          </button>
        ))}
      </div>

      {mode === "autopilot" ? (
        <AutopilotPanel />
      ) : (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">

        {/* Left: upload + fields */}
        <div className="space-y-4">
          {!result && (
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`relative flex min-h-[280px] cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed p-8 text-center transition-colors ${
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border/70 bg-card hover:border-primary/40 hover:bg-primary/[0.02]"
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) acceptFile(f);
                }}
              />
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"
              >
                <UploadCloud className="h-6 w-6" />
              </motion.div>
              <div className="text-base font-semibold">
                {file
                  ? file.name
                  : t("agent.drop", { defaultValue: "Drop the application form here" })}
              </div>
              <div className="text-xs text-muted-foreground">
                {t("agent.hint", { defaultValue: "PDF, PNG, JPG · up to 12 MB · your data never leaves your session" })}
              </div>
              {file && (
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      void runAgent();
                    }}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-xl gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-60"
                  >
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {busy
                      ? t("agent.analyzing", { defaultValue: "Analyzing form…" })
                      : t("agent.analyze", { defaultValue: "Analyze & auto-fill" })}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setFile(null);
                      if (previewUrl) URL.revokeObjectURL(previewUrl);
                      setPreviewUrl(null);
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    {t("common.replace", { defaultValue: "Replace" })}
                  </button>
                </div>
              )}
            </label>
          )}

          <AnimatePresence>
            {busy && !result && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-3xl border border-border/60 bg-card p-5"
              >
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  {t("agent.reading", { defaultValue: "Reading form…" })}
                </div>
                <div className="mt-3 space-y-2">
                  {["Detecting fields", "Matching profile data", "Scoring confidence"].map((s, i) => (
                    <motion.div
                      key={s}
                      initial={{ opacity: 0.4 }}
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.25 }}
                      className="flex items-center gap-2 text-xs text-muted-foreground"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {s}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {result && (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3 rounded-3xl border border-border/60 bg-card p-5">
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {t("agent.detected", { defaultValue: "Detected form" })}
                  </div>
                  <div className="mt-1 truncate text-lg font-semibold">{result.form_title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{result.summary}</div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <StatusPill status="filled" count={counts.filled} />
                    <StatusPill status="review" count={counts.review} />
                    <StatusPill status="missing" count={counts.missing} />
                    {(counts.review + counts.missing) > 0 && (
                      <button
                        onClick={fillAllWithAI}
                        disabled={fillAllBusy}
                        className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
                      >
                        <Bot className="h-3.5 w-3.5" />
                        {fillAllBusy ? "Filling…" : `AI Fill All (${counts.review + counts.missing})`}
                      </button>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setResult(null);
                    setFile(null);
                    if (previewUrl) URL.revokeObjectURL(previewUrl);
                    setPreviewUrl(null);
                  }}
                  className="rounded-xl border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  {t("agent.newForm", { defaultValue: "New form" })}
                </button>
              </div>

              <div className="space-y-2">
                {result.fields.map((f, i) => (
                  <FieldRow key={i} field={f} index={i} allFields={result.fields} onChange={(patch) => updateField(i, patch)} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: preview / actions */}
        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-3xl border border-border/60 bg-card p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              {t("agent.preview", { defaultValue: "Preview" })}
            </div>
            <div className="mt-3 grid aspect-[3/4] place-items-center overflow-hidden rounded-2xl border border-border/60 bg-background/60">
              {previewUrl ? (
                <img src={previewUrl} alt="Form preview" className="h-full w-full object-contain" />
              ) : file ? (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <FileText className="h-10 w-10" />
                  <div className="text-xs">{file.name}</div>
                </div>
              ) : (
                <div className="text-center text-xs text-muted-foreground">
                  {t("agent.previewEmpty", { defaultValue: "Upload a form to see a preview" })}
                </div>
              )}
            </div>
          </div>

          {result && (
            <div className="rounded-3xl border border-border/60 bg-card p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("agent.export", { defaultValue: "Export" })}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {t("agent.exportHint", {
                  defaultValue:
                    "Review each field, then export a draft. RentReady never submits on your behalf — you always send the final application yourself.",
                })}
              </p>
              <div className="mt-3 grid gap-2">
                <button
                  onClick={exportPrintable}
                  className="flex items-center justify-center gap-2 rounded-xl gradient-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-glow"
                >
                  <Download className="h-4 w-4" />
                  {t("agent.exportPdf", { defaultValue: "Preview / print draft" })}
                </button>
                <button
                  onClick={exportJson}
                  className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
                >
                  <ArrowRight className="h-4 w-4" />
                  {t("agent.exportJson", { defaultValue: "Download field data (JSON)" })}
                </button>
              </div>
              <div className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300">
                {t("agent.noAutoSubmit", {
                  defaultValue: "Never submitted automatically. You always confirm.",
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      )}
    </AppLayout>
  );
}

function StatusPill({ status, count }: { status: AgentField["status"]; count: number }) {
  const meta = statusMeta(status);
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold"
      style={{
        background: `color-mix(in oklab, ${meta.color} 14%, transparent)`,
        color: meta.color,
      }}
    >
      <meta.Icon className="h-3 w-3" />
      {count} {meta.label}
    </span>
  );
}

function FieldRow({
  field,
  onChange,
}: {
  field: AgentField;
  index: number;
  onChange: (patch: Partial<AgentField>) => void;
  allFields: AgentField[];
}) {
  const meta = statusMeta(field.status);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border bg-card p-3 md:p-4"
      style={{
        borderColor: `color-mix(in oklab, ${meta.color} 40%, transparent)`,
        background: `color-mix(in oklab, ${meta.color} 5%, hsl(var(--card)))`,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">{field.label}</div>
          {field.source && (
            <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
              from · {field.source}
            </div>
          )}
        </div>
        <button
          onClick={() =>
            onChange({ status: field.status === "filled" ? "review" : "filled" })
          }
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold"
          style={{
            background: `color-mix(in oklab, ${meta.color} 16%, transparent)`,
            color: meta.color,
          }}
        >
          <meta.Icon className="h-3 w-3" />
          {meta.label}
        </button>
      </div>
      <input
        value={field.value}
        onChange={(e) => {
          const v = e.target.value;
          onChange({
            value: v,
            status: v.trim()
              ? field.status === "missing"
                ? "review"
                : field.status
              : "missing",
          });
        }}
        placeholder="—"
        className="mt-2 w-full rounded-xl border border-border/60 bg-background/70 px-3 py-2 text-sm outline-none focus:border-primary/50"
      />
      {field.note && (
        <div className="mt-1.5 text-[11px] text-muted-foreground">{field.note}</div>
      )}
    </motion.div>
  );
}

function statusMeta(status: AgentField["status"]) {
  if (status === "filled") return { color: "#16A34A", label: "Auto-filled", Icon: CheckCircle2 };
  if (status === "review") return { color: "#D97706", label: "Needs review", Icon: AlertTriangle };
  return { color: "#DC2626", label: "Missing", Icon: XCircle };
}

function statusColor(status: AgentField["status"]) {
  return statusMeta(status).color;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
