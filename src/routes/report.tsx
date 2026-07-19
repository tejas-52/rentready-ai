import { createFileRoute } from "@tanstack/react-router";
import {
  BadgeCheck,
  CheckCircle2,
  Circle,
  Download,
  Eye,
  FileText,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AppLayout } from "@/components/app-layout";
import { ConfidenceRing } from "@/components/confidence-ring";
import { ConfidenceRadar } from "@/components/confidence-radar";
import { SectionHeader, Stagger, StaggerItem } from "@/components/ui-bits";
import { useAppState, emptyAppState } from "@/lib/app-queries";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Rental Report — RentReady AI" },
      {
        name: "description",
        content: "A beautifully formatted rental application report, powered by AI.",
      },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const { t } = useTranslation();
  const { displayName } = useAuth();
  const { data } = useAppState();
  const state = data ?? emptyAppState;
  const {
    confidence,
    documents,
    profileSummary,
    timeline,
    improvements,
    radarAxes,
    report,
    validation,
  } = state;

  const verified = documents.filter((d) => d.status === "verified");
  const missing = documents.filter((d) => d.status !== "verified");
  const [landlord, setLandlord] = useState(false);

  const applicantName = profileSummary.fullName ?? displayName;
  const employmentLine = [profileSummary.employer, profileSummary.occupation]
    .filter(Boolean).join(" · ") || "—";
  const incomeLine = profileSummary.monthlyIncome ?? "—";

  const summarySentence =
    (report?.content as any)?.summary ??
    `${applicantName} — ${employmentLine} · ${incomeLine}.`;

  // "Before" = score without recommendations applied (subtract sum of impacts, floored at 30)
  const potentialGain = improvements.reduce((s, i) => s + i.impact, 0);
  const before = Math.max(30, confidence - potentialGain);

  return (
    <AppLayout>
      <SectionHeader
        eyebrow={t("nav.report")}
        title={landlord ? t("report.landlordTitle") : t("report.title")}
        subtitle={landlord ? t("report.landlordSubtitle") : t("report.subtitle")}
        action={
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => setLandlord((v) => !v)}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-5 py-3 text-sm font-semibold transition-colors hover:bg-accent"
            >
              <Eye className="h-4 w-4" />
              {landlord ? t("report.applicantView") : t("report.landlordPreview")}
            </button>
            <button className="inline-flex items-center gap-2 rounded-full gradient-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-glow">
              <Download className="h-4 w-4" /> {t("report.exportPdf")}
            </button>
          </div>
        }
      />

      <AnimatePresence>
        {landlord && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-primary/30 bg-primary/[0.05] px-4 py-3 text-sm"
          >
            <span className="font-medium text-primary">{t("report.readOnly")}</span>
            <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
              {t("report.readyReview")}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <Stagger className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
        <StaggerItem>
          <div className="rounded-3xl border border-border/60 bg-card p-6">
            <div className="flex items-center justify-center py-2">
              <ConfidenceRing value={confidence} size={200} />
            </div>
            <div className="mt-4 rounded-2xl bg-background/60 p-4 text-sm">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                <Sparkles className="h-3.5 w-3.5" /> {t("report.aiSummary")}
              </div>
              <p className="mt-2 text-muted-foreground">{summarySentence}</p>
            </div>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="h-full rounded-3xl border border-border/60 bg-card p-6">
            <h3 className="text-lg font-semibold tracking-tight">{t("report.timeline")}</h3>
            <ol className="relative mt-5 space-y-4 pl-6">
              <span className="absolute left-[10px] top-2 bottom-2 w-px bg-border" />
              {timeline.length === 0 ? (
                <li className="text-sm text-muted-foreground">
                  {t("report.emptyTimeline", { defaultValue: "Upload a document to begin the timeline." })}
                </li>
              ) : timeline.map((step, i) => (
                <motion.li
                  key={step.name + i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * i }}
                  className="relative"
                >
                  <span
                    className={
                      "absolute -left-6 top-0.5 grid h-5 w-5 place-items-center rounded-full " +
                      (step.done ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground")
                    }
                  >
                    {step.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3 w-3" />}
                  </span>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold">{step.name}</div>
                    <div className="text-xs text-muted-foreground">{step.date}</div>
                  </div>
                </motion.li>
              ))}
            </ol>
          </div>
        </StaggerItem>

        <StaggerItem className="md:col-span-2">
          <div className="grid gap-4 md:grid-cols-[1fr_1.2fr]">
            <div className="rounded-3xl border border-border/60 bg-card p-6">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                <Sparkles className="h-3.5 w-3.5" /> {t("report.radar")}
              </div>
              <ConfidenceRadar axes={radarAxes.map((a) => ({ ...a, label: a.label }))} />
            </div>
            <div className="rounded-3xl border border-border/60 bg-card p-6">
              <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                <Sparkles className="h-3.5 w-3.5" /> {t("report.beforeAfter")}
              </div>
              <div className="mt-4 space-y-5">
                {[
                  { label: t("report.before"), value: before, tone: "muted" },
                  { label: t("report.after"), value: confidence, tone: "primary" },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="mb-1.5 flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="font-semibold tabular-nums">{row.value}%</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${row.value}%` }}
                        transition={{ duration: 1.2, ease: [0.2, 0.8, 0.2, 1] }}
                        className={
                          "h-full rounded-full " +
                          (row.tone === "primary"
                            ? "gradient-primary shadow-glow"
                            : "bg-muted-foreground/30")
                        }
                      />
                    </div>
                  </div>
                ))}
                <div className="rounded-2xl bg-success/10 p-3 text-sm text-success">
                  <span className="font-semibold">+{Math.max(0, confidence - before)}%</span> {t("report.uplift")}
                </div>
              </div>
            </div>
          </div>
        </StaggerItem>

        <StaggerItem className="md:col-span-2">
          <div className="rounded-3xl border border-border/60 bg-card p-6">
            <h3 className="text-lg font-semibold tracking-tight">{t("report.summary")}</h3>
            <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                [t("report.fields.applicant"), applicantName],
                [t("report.fields.occupation"), profileSummary.occupation ?? "—"],
                [t("report.fields.monthlyIncome"), incomeLine],
                [t("report.fields.visa"), profileSummary.visaStatus ?? "—"],
                [t("report.fields.address"), profileSummary.address ?? "—"],
                [t("report.fields.nationality"), profileSummary.nationality ?? "—"],
                [t("report.fields.employment"), employmentLine],
                [t("report.fields.confidence"),
                  `${confidence}% · ${confidence >= 95 ? t("dashboard.excellentTier") : t("common.inProgress")}`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-background/60 p-3">
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    {k}
                  </dt>
                  <dd className="mt-1 text-sm font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            {validation?.issues && validation.issues.length > 0 && (
              <div className="mt-4 space-y-2">
                {validation.issues.map((iss, i) => (
                  <div key={i} className="rounded-2xl bg-warning/10 border border-warning/30 p-3 text-sm">
                    <span className="mr-2 rounded-full bg-warning/20 px-2 py-0.5 text-[11px] font-semibold uppercase text-warning-foreground">
                      {iss.severity}
                    </span>
                    {iss.message}
                  </div>
                ))}
              </div>
            )}
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="h-full rounded-3xl border border-border/60 bg-card p-6">
            <h3 className="text-lg font-semibold tracking-tight">{t("report.verifiedDocs")}</h3>
            <ul className="mt-4 space-y-2">
              {verified.length === 0 ? (
                <li className="rounded-2xl bg-background/60 p-3 text-sm text-muted-foreground">
                  {t("report.noVerified", { defaultValue: "No verified documents yet." })}
                </li>
              ) : verified.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center gap-3 rounded-2xl bg-background/60 p-3"
                >
                  <BadgeCheck className="h-5 w-5 text-success" />
                  <div className="min-w-0 flex-1 truncate text-sm font-medium">
                    {t(d.nameKey, { defaultValue: d.fallbackName })}
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {d.confidence ?? 0}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="h-full rounded-3xl border border-border/60 bg-card p-6">
            <h3 className="text-lg font-semibold tracking-tight">{t("report.recommendations")}</h3>
            <ul className="mt-4 space-y-2">
              {missing.length === 0 && improvements.length === 0 && (
                <li className="rounded-2xl bg-background/60 p-3 text-sm text-muted-foreground">
                  {t("dashboard.allCaughtUp", { defaultValue: "You're all caught up." })}
                </li>
              )}
              {missing.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center gap-3 rounded-2xl bg-background/60 p-3"
                >
                  <FileText className="h-5 w-5 text-primary" />
                  <div className="min-w-0 flex-1 truncate text-sm font-medium">
                    {t("report.add", { name: t(d.nameKey, { defaultValue: d.fallbackName }).toLowerCase() })}
                  </div>
                </li>
              ))}
              {improvements.map((i) => (
                <li
                  key={i.title}
                  className="flex items-center gap-3 rounded-2xl bg-background/60 p-3"
                >
                  <Sparkles className="h-5 w-5 text-primary" />
                  <div className="min-w-0 flex-1 truncate text-sm font-medium">
                    {i.title}
                  </div>
                  <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
                    +{i.impact}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </StaggerItem>

        <StaggerItem className="md:col-span-2 md:hidden">
          <button className="w-full inline-flex items-center justify-center gap-2 rounded-full gradient-primary px-5 py-4 text-sm font-semibold text-primary-foreground shadow-glow">
            <Download className="h-4 w-4" /> {t("report.exportPdf")}
          </button>
        </StaggerItem>
      </Stagger>
    </AppLayout>
  );
}
