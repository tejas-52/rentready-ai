import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  Lock,
  Sparkles,
  Upload,
  Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppLayout } from "@/components/app-layout";
import { useAuth } from "@/lib/auth-context";
import { AITimeline } from "@/components/ai-timeline";
import { ConfidenceRing } from "@/components/confidence-ring";
import { FadeIn, SectionHeader, Stagger, StaggerItem } from "@/components/ui-bits";
import { useAppState, emptyAppState } from "@/lib/app-queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RentReady AI — Your rental application copilot" },
      {
        name: "description",
        content:
          "RentReady AI prepares complete, verified rental applications so you apply with total confidence.",
      },
      { property: "og:title", content: "RentReady AI — Your rental application copilot" },
      {
        property: "og:description",
        content: "RentReady AI prepares complete, verified rental applications so you apply with total confidence.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { t } = useTranslation();
  const { firstName } = useAuth();
  const { data } = useAppState();
  const empty = emptyAppState;
  const state = data ?? empty;

  const {
    confidence,
    documents,
    journey,
    activityFeed,
    smartChecklist,
    improvements,
    insight,
    recentUploads,
  } = state;

  const greet = () => {
    const h = new Date().getHours();
    if (h < 12) return t("dashboard.goodMorning");
    if (h < 18) return t("dashboard.goodAfternoon");
    return t("dashboard.goodEvening");
  };

  // Checklist derived from journey (first 4 categories)
  const heroChecklist = journey.slice(0, 4).map((j) => ({
    name: t(`dashboard.checklist.${j.id}`, { defaultValue: j.name }),
    done: j.done,
  }));

  const stepLabels = journey.map((j) =>
    t(`dashboard.steps.${j.id}`, { defaultValue: j.name }),
  );

  const excellent = confidence >= 95;
  const gap = Math.max(0, 95 - confidence);

  return (
    <AppLayout>
      <Stagger className="space-y-6 pb-6">
        {/* Greeting */}
        <StaggerItem>
          <div className="flex items-end justify-between gap-4">
            <div>
              <div className="text-sm text-muted-foreground">
                {greet()}, {firstName} 👋
              </div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-[32px]">
                {t("dashboard.letsGetReady")}
              </h1>
            </div>
          </div>
        </StaggerItem>

        {/* Hero confidence card */}
        <StaggerItem>
          <div className="relative overflow-hidden rounded-[28px] border border-border/60 gradient-hero shadow-lg">
            <div
              aria-hidden
              className="absolute inset-0 opacity-70"
              style={{
                background:
                  "radial-gradient(600px circle at 90% -10%, color-mix(in oklab, #3B82F6 20%, transparent), transparent 60%)",
              }}
            />
            <div className="relative grid gap-6 p-6 md:grid-cols-[auto_1fr] md:items-center md:gap-10 md:p-10">
              <ConfidenceRing value={confidence} />
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
                  <Sparkles className="h-3.5 w-3.5" /> {t("common.aiVerified")}
                </div>
                <h2 className="mt-3 text-xl font-semibold tracking-tight md:text-[26px]">
                  {excellent ? t("dashboard.excellentTier") : t("dashboard.almostReady")}
                </h2>
                <p className="mt-1.5 text-sm text-muted-foreground md:text-base">
                  {excellent ? insight.body : (
                    <>
                      {t("dashboard.oneLeft")}
                      <span className="font-medium text-foreground"> {t("dashboard.excellentTier")}</span>
                      {gap > 0 ? ` · +${gap}%` : ""}.
                    </>
                  )}
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <motion.span
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.8, repeat: Infinity }}
                    className="h-1.5 w-1.5 rounded-full bg-success"
                  />
                  {t("dashboard.estCompletion")}
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl border border-border/50 bg-background/60 p-3 sm:grid-cols-4">
                  {heroChecklist.map((c) => (
                    <div key={c.name} className="flex items-center gap-2 text-xs">
                      {c.done ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : (
                        <motion.span
                          animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
                          transition={{ duration: 1.6, repeat: Infinity }}
                          className="h-2 w-2 rounded-full bg-primary"
                        />
                      )}
                      <span className={c.done ? "text-foreground" : "text-primary font-semibold"}>
                        {c.name}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Link
                    to="/documents"
                    className="group inline-flex items-center gap-2 rounded-full btn-primary-premium px-6 py-3.5 text-sm font-semibold"
                  >
                    {t("dashboard.continueApp")}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  <Link
                    to="/report"
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-5 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
                  >
                    {t("dashboard.viewReport")}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </StaggerItem>

        {/* Signature: AI processing timeline */}
        <StaggerItem>
          <AITimeline
            steps={documents
              .filter((d) => d.status === "verified" || d.status === "pending")
              .slice(0, 4)
              .map((d) => ({
                label: `Reading ${d.fallbackName.toLowerCase()}`,
                result:
                  d.status === "verified"
                    ? `${d.fallbackName} verified · ${d.confidence ?? 0}%`
                    : `${d.fallbackName} processing…`,
                done: d.status === "verified",
              }))}
          />
        </StaggerItem>

        {/* Journey */}
        <StaggerItem>
          <SectionHeader
            eyebrow={t("dashboard.journey")}
            title={t("dashboard.yourProgress")}
            subtitle={t("dashboard.journeySubtitle")}
          />
          <div className="rounded-3xl border border-border/60 bg-card p-4 md:p-6">
            <ol className="grid gap-3 md:grid-cols-5">
              {journey.map((step, i) => {
                const state = step.done
                  ? "done"
                  : step.active
                    ? "active"
                    : step.locked
                      ? "locked"
                      : "idle";
                return (
                  <motion.li
                    key={step.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.08 }}
                    className="flex items-center gap-3 rounded-2xl border border-border/60 bg-background/60 p-3 md:flex-col md:items-start md:gap-2 md:p-4"
                  >
                    <div
                      className={
                        "grid h-9 w-9 place-items-center rounded-xl text-sm font-semibold " +
                        (state === "done"
                          ? "bg-success/15 text-success"
                          : state === "active"
                            ? "gradient-primary text-primary-foreground"
                            : state === "locked"
                              ? "bg-muted text-muted-foreground"
                              : "bg-accent text-accent-foreground")
                      }
                    >
                      {state === "done" ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : state === "locked" ? (
                        <Lock className="h-4 w-4" />
                      ) : (
                        i + 1
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{stepLabels[i] ?? step.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {state === "done"
                          ? t("common.complete")
                          : state === "active"
                            ? t("common.inProgress")
                            : state === "locked"
                              ? t("common.locked")
                              : t("common.upNext")}
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </ol>
          </div>
        </StaggerItem>

        {/* Two column: insight + smart checklist */}
        <div className="grid gap-4 md:grid-cols-2">
          <StaggerItem>
            <div className="h-full rounded-3xl border border-border/60 bg-card p-6">
              <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-primary">
                <Sparkles className="h-3.5 w-3.5" /> {t("dashboard.todayInsight")}
              </div>
              <h3 className="text-lg font-semibold tracking-tight">
                {insight.title}
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{insight.body}</p>

              <div className="mt-5 space-y-2">
                {improvements.length === 0 ? (
                  <div className="rounded-2xl bg-background/60 p-3 text-sm text-muted-foreground">
                    {t("dashboard.noSuggestions", { defaultValue: "No suggestions yet — upload a document to get started." })}
                  </div>
                ) : improvements.map((imp) => (
                  <div
                    key={imp.title}
                    className="flex items-center justify-between rounded-2xl bg-background/60 p-3"
                  >
                    <span className="text-sm">{imp.title}</span>
                    <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
                      +{imp.impact}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </StaggerItem>

          <StaggerItem>
            <div className="h-full rounded-3xl border border-border/60 bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold tracking-tight">
                  {t("dashboard.smartChecklist")}
                </h3>
                <Link
                  to="/documents"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
                >
                  {t("common.seeAll")} <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <div className="space-y-2">
                {smartChecklist.length === 0 ? (
                  <div className="rounded-2xl bg-background/60 p-3 text-sm text-muted-foreground">
                    {t("dashboard.allCaughtUp", { defaultValue: "You're all caught up." })}
                  </div>
                ) : smartChecklist.map((s) => (
                  <Link
                    to="/documents"
                    key={s.name}
                    className="group flex items-center gap-3 rounded-2xl border border-dashed border-primary/30 bg-primary/[0.03] p-3 transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:bg-primary/[0.06]"
                  >
                    <div className="grid h-10 w-10 place-items-center rounded-xl gradient-primary text-primary-foreground shadow-glow">
                      <Upload className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{s.name}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> {s.eta}
                      </div>
                    </div>
                    <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
                      +{s.impact}%
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </StaggerItem>
        </div>

        {/* AI activity feed */}
        <StaggerItem>
          <div className="rounded-3xl border border-border/60 bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="text-lg font-semibold tracking-tight">{t("dashboard.aiActivity")}</h3>
              </div>
              <span className="text-xs text-muted-foreground">{t("common.live")}</span>
            </div>
            <ul className="space-y-1.5">
              {activityFeed.length === 0 ? (
                <li className="rounded-xl px-2 py-2 text-sm text-muted-foreground">
                  {t("dashboard.noActivity", { defaultValue: "No AI activity yet." })}
                </li>
              ) : activityFeed.map((a, i) => {
                const Icon = a.iconKey === "check" ? CheckCircle2 : Zap;
                return (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.08 * i, ease: [0.2, 0.8, 0.2, 1] }}
                    className="flex items-center gap-3 rounded-xl px-2 py-2"
                  >
                    <Icon
                      className={
                        "h-4 w-4 " +
                        (a.tone === "success" ? "text-success" : "text-amber-500")
                      }
                    />
                    <span className="flex-1 text-sm">{a.text}</span>
                    {a.meta && (
                      <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                        {a.meta}
                      </span>
                    )}
                  </motion.li>
                );
              })}
            </ul>
          </div>
        </StaggerItem>

        {/* Recent activity */}
        <StaggerItem>
          <FadeIn>
            <div className="rounded-3xl border border-border/60 bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold tracking-tight">{t("dashboard.recentUploads")}</h3>
                <Link
                  to="/documents"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
                >
                  {t("dashboard.allDocuments")} <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              {recentUploads.length === 0 ? (
                <div className="rounded-2xl bg-background/60 p-4 text-sm text-muted-foreground">
                  {t("dashboard.noUploads", { defaultValue: "No uploads yet — start with your passport." })}
                </div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {recentUploads.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 py-3">
                      <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                        <d.icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">
                          {t(d.nameKey, { defaultValue: d.fallbackName })}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t("common.verifiedByAi")} · {d.confidence ?? 0}% {t("common.confidence").toLowerCase()}
                        </div>
                      </div>
                      <CheckCircle2 className="h-5 w-5 text-success" />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </FadeIn>
        </StaggerItem>
      </Stagger>
    </AppLayout>
  );
}
