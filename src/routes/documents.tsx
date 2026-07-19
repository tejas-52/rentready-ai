import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Circle,
  Clock,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { SectionHeader, Stagger, StaggerItem } from "@/components/ui-bits";
import type { DocStatus } from "@/lib/document-registry";
import { useAppState, emptyAppState, type DocumentUI } from "@/lib/app-queries";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getOrCreateApplication, registerDocument, runPipelineForDocument } from "@/lib/pipeline.client";

export const Route = createFileRoute("/documents")({
  head: () => ({
    meta: [
      { title: "Documents — RentReady AI" },
      {
        name: "description",
        content: "Upload rental documents and let AI verify them instantly.",
      },
    ],
  }),
  component: DocumentsPage,
});

function useStatusMeta(): Record<DocStatus, { label: string; className: string; icon: typeof CheckCircle2 }> {
  const { t } = useTranslation();
  return {
    verified: { label: t("common.verified"), className: "bg-success/15 text-success", icon: CheckCircle2 },
    pending: { label: t("common.pending"), className: "bg-muted text-muted-foreground", icon: Clock },
    issue: { label: t("common.needsAttention"), className: "bg-warning/15 text-warning-foreground", icon: AlertTriangle },
    missing: { label: t("common.notUploaded"), className: "bg-accent text-accent-foreground", icon: Circle },
  };
}

function DocCard({ doc, onOpen }: { doc: DocumentUI; onOpen: (d: DocumentUI) => void }) {
  const { t } = useTranslation();
  const s = useStatusMeta()[doc.status];
  const Icon = doc.icon;
  const SIcon = s.icon;
  const shell =
    doc.status === "missing"
      ? "border-2 border-dashed border-primary/40 bg-card/60 hover:border-primary/70"
      : doc.status === "issue"
        ? "border border-warning/50 bg-card hover:border-warning"
        : "border border-border/60 bg-card";
  const name = t(doc.nameKey, { defaultValue: doc.fallbackName });
  return (
    <button
      onClick={() => onOpen(doc)}
      className={`group card-lift card-lift-hover relative flex h-full min-h-[168px] w-full flex-col rounded-3xl p-5 text-left shadow-sm ${shell}`}
    >
      <div className="flex items-start justify-between">
        <div
          className={`grid h-12 w-12 place-items-center rounded-2xl transition-transform group-hover:scale-105 ${
            doc.status === "missing"
              ? "gradient-primary text-primary-foreground shadow-glow"
              : "bg-accent text-accent-foreground"
          }`}
        >
          {doc.status === "missing" ? <Upload className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
        </div>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.className} ${
            doc.status === "pending" ? "animate-pulse" : ""
          }`}
        >
          <SIcon className="h-3 w-3" /> {s.label}
        </span>
      </div>
      <div className="mt-auto pt-5">
        <div className="text-base font-semibold tracking-tight">{name}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {doc.status === "verified" && `${doc.confidence ?? 0}% ${t("common.confidence").toLowerCase()}`}
          {doc.status === "pending" && t("documents.analyzing")}
          {doc.status === "issue" && (doc.issue ?? t("common.needsAttention"))}
          {doc.status === "missing" && t("documents.tapToUpload")}
        </div>
      </div>
    </button>
  );
}


function UploadModal({ doc, onClose, onRefresh }: { doc: DocumentUI; onClose: () => void; onRefresh: () => void }) {
  const { t } = useTranslation();
  const readingSteps = useMemo(
    () => [
      t("documents.steps.reading"),
      t("documents.steps.extracting"),
      t("documents.steps.checking"),
      t("documents.steps.crossReferencing"),
      t("documents.steps.identityVerified"),
    ],
    [t],
  );
  const [phase, setPhase] = useState<"drop" | "reading" | "done">(
    doc.status === "missing" || doc.status === "pending" ? "drop" : "done",
  );
  const [step, setStep] = useState(0);
  const [extracted, setExtracted] = useState<{ label: string; value: string }[] | null>(
    doc.extracted && doc.extracted.length > 0 ? doc.extracted : null,
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const { user, isDemo } = useAuth();

  useEffect(() => {
    if (phase !== "reading") return;
    if (step >= readingSteps.length - 1) return;
    const to = setTimeout(() => setStep((s) => s + 1), 700);
    return () => clearTimeout(to);
  }, [phase, step, readingSteps.length]);

  useEffect(() => {
    if (phase === "reading" && step === readingSteps.length - 1 && !extracted) {
      const to = setTimeout(() => setPhase("done"), 700);
      return () => clearTimeout(to);
    }
  }, [phase, step, extracted, readingSteps.length]);

  async function handleFile(file: File) {
    setPhase("reading");
    setStep(0);
    if (!user) { toast.error("Please sign in to upload documents."); return; }

    try {
      const app = await getOrCreateApplication();
      const path = `${user.id}/${app.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("rental-documents")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const registered = await registerDocument({
        data: {
          applicationId: app.id,
          storagePath: path,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          docType: doc.dbType,
        },
      });

      // Try pipeline, but don't block on failure
      try {
        const res = await runPipelineForDocument({
          data: { documentId: registered.id, applicationId: app.id },
        });
        toast.success(t("documents.toasts.verified", { score: res.score }));
        const { data: ex } = await supabase
          .from("extractions")
          .select("data")
          .eq("document_id", registered.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (ex?.data) {
          setExtracted(
            Object.entries(ex.data as Record<string, unknown>)
              .filter(([, v]) => v)
              .slice(0, 6)
              .map(([k, v]) => ({ label: k.replace(/_/g, " "), value: String(v) })),
          );
        }
      } catch (pipelineErr: any) {
        console.error("Pipeline error:", pipelineErr);
        toast.warning(pipelineErr?.message || "Document uploaded but AI verification is processing...");
      }

      setPhase("done");
      onRefresh();
    } catch (e: any) {
      toast.error(e?.message ?? t("documents.toasts.uploadFailed"));
      setPhase("drop");
    }
  }

  const Icon = doc.icon;
  const name = t(doc.nameKey, { defaultValue: doc.fallbackName });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm md:items-center md:p-6">
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 28 }}
        className="w-full max-w-lg overflow-hidden rounded-t-3xl bg-card shadow-lg md:rounded-3xl"
      >
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-foreground">
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold">{name}</div>
              <div className="text-xs text-muted-foreground">
                {phase === "done" ? t("common.verifiedByAi") : t("documents.uploadSecurely")}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          <AnimatePresence mode="wait">
            {phase === "drop" && (
              <motion.div
                key="drop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <button
                  onClick={() => fileRef.current?.click()}
                  className="relative flex w-full flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-border bg-background/60 p-10 text-center transition-colors hover:border-primary/60 hover:bg-accent/40"
                >
                  <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="grid h-14 w-14 place-items-center rounded-2xl gradient-primary text-primary-foreground shadow-glow"
                  >
                    <Upload className="h-6 w-6" />
                  </motion.div>
                  <div>
                    <div className="text-base font-semibold">{t("documents.dropHere")}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {t("documents.fileHint")}
                    </div>
                  </div>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                  }}
                />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold hover:bg-accent"
                  >
                    <Camera className="h-4 w-4" /> {t("documents.useCamera")}
                  </button>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl gradient-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-glow"
                  >
                    {t("documents.chooseFile")}
                  </button>
                </div>
              </motion.div>
            )}

            {phase === "reading" && (
              <motion.div
                key="reading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-6"
              >
                <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl gradient-primary text-primary-foreground shadow-glow">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                  >
                    <Sparkles className="h-8 w-8" />
                  </motion.div>
                </div>
                <div className="mt-6 space-y-2">
                  {readingSteps.map((s, i) => (
                    <div
                      key={s}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${
                        i < step
                          ? "text-muted-foreground"
                          : i === step
                            ? "bg-accent text-foreground"
                            : "text-muted-foreground/60"
                      }`}
                    >
                      {i < step ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : i === step ? (
                        <motion.div
                          animate={{ scale: [1, 1.15, 1] }}
                          transition={{ duration: 1, repeat: Infinity }}
                          className="h-2 w-2 rounded-full bg-primary"
                        />
                      ) : (
                        <Circle className="h-4 w-4" />
                      )}
                      <span>{s}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {phase === "done" && (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <div className="mb-4 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <div className="text-sm font-semibold">{t("common.verifiedByAi")}</div>
                  {doc.confidence != null && (
                    <span className="ml-auto rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
                      {doc.confidence}% {t("common.confidence").toLowerCase()}
                    </span>
                  )}
                </div>
                {extracted && extracted.length > 0 ? (
                  <dl className="grid grid-cols-2 gap-3">
                    {extracted.map((e) => (
                      <div
                        key={e.label}
                        className="rounded-2xl bg-background/60 p-3"
                      >
                        <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          {e.label}
                        </dt>
                        <dd className="mt-1 text-sm font-semibold">{e.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t("documents.empty")}
                  </p>
                )}
                {doc.status === "issue" && doc.issue && (
                  <div className="mt-4 rounded-2xl border border-warning/40 bg-warning/10 p-4">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-4 w-4 text-warning-foreground" />
                      <div>
                        <div className="text-sm font-semibold">
                          {t("documents.suggestedImprovement")}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {doc.issue} {t("documents.improveHelp")}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button className="rounded-2xl border border-border bg-background px-4 py-3 text-sm font-semibold hover:bg-accent">
                    {t("common.preview")}
                  </button>
                  <button
                    onClick={() => {
                      setPhase("drop");
                      setStep(0);
                    }}
                    className="rounded-2xl gradient-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-glow"
                  >
                    {t("common.replace")}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}

function DocumentsPage() {
  const { t } = useTranslation();
  const [open, setOpen] = useState<DocumentUI | null>(null);
  const { data } = useAppState();
  const state = data ?? emptyAppState;
  const qc = useQueryClient();
  const documents = state.documents;
  const verified = documents.filter((d) => d.status === "verified").length;

  const refresh = () => qc.invalidateQueries({ queryKey: ["app-state"] });

  return (
    <AppLayout>
      <SectionHeader
        eyebrow={t("nav.documents")}
        title={t("documents.title")}
        subtitle={t("documents.subtitle", { verified, total: documents.length })}
      />

      <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {documents.map((d) => (
          <StaggerItem key={d.id}>
            <DocCard doc={d} onOpen={setOpen} />
          </StaggerItem>
        ))}
      </Stagger>

      <AnimatePresence>
        {open && <UploadModal doc={open} onClose={() => setOpen(null)} onRefresh={refresh} />}
      </AnimatePresence>
    </AppLayout>
  );
}
