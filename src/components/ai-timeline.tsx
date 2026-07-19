import { motion, AnimatePresence } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

export type AITimelineStep = {
  label: string;
  result: string;
  /** If already done, the row shows the result immediately without animating. */
  done?: boolean;
};

export function AITimeline({
  steps: stepsProp,
  onComplete,
}: {
  steps?: AITimelineStep[];
  onComplete?: () => void;
}) {
  const { t } = useTranslation();
  const fallback = useMemo<AITimelineStep[]>(
    () => [
      { label: t("ai.steps.readPassport"), result: t("ai.results.passportDetected") },
      { label: t("ai.steps.readEmployment"), result: t("ai.results.salaryVerified") },
      { label: t("ai.steps.readVisa"), result: t("ai.results.residencyVerified") },
      { label: t("ai.steps.checkInconsistencies"), result: t("ai.results.noIssues") },
    ],
    [t],
  );
  const steps = stepsProp && stepsProp.length > 0 ? stepsProp : fallback;
  const allPreDone = steps.every((s) => s.done);
  const [i, setI] = useState(allPreDone ? steps.length : 0);
  const [done, setDone] = useState(allPreDone);

  useEffect(() => {
    if (done) return;
    if (i >= steps.length) {
      setDone(true);
      onComplete?.();
      return;
    }
    const to = setTimeout(() => setI((v) => v + 1), 900);
    return () => clearTimeout(to);
  }, [i, done, onComplete, steps.length]);

  return (
    <div className="rounded-3xl border border-border/60 bg-card p-5 md:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: done ? 0 : 360 }}
            transition={{ duration: 2, repeat: done ? 0 : Infinity, ease: "linear" }}
            className="grid h-8 w-8 place-items-center rounded-xl gradient-primary text-primary-foreground shadow-glow"
          >
            <Sparkles className="h-4 w-4" />
          </motion.div>
          <div>
            <div className="text-sm font-semibold">{t("app.name")}</div>
            <div className="text-xs text-muted-foreground">
              {done ? t("ai.reviewComplete") : t("ai.reviewing")}
            </div>
          </div>
        </div>
        {done && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success"
          >
            {t("ai.confidenceBump")}
          </motion.div>
        )}
      </div>

      <ol className="space-y-2.5">
        {steps.map((s, idx) => {
          const state = s.done || idx < i ? "done" : idx === i ? "active" : "idle";
          return (
            <li
              key={s.label + idx}
              className={
                "rounded-2xl border p-3 transition-colors " +
                (state === "active"
                  ? "border-primary/40 bg-primary/[0.04]"
                  : state === "done"
                    ? "border-border/50 bg-background/50"
                    : "border-border/40 bg-background/30 opacity-60")
              }
            >
              <div className="flex items-center gap-3">
                <div
                  className={
                    "grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold " +
                    (state === "done"
                      ? "bg-success text-success-foreground"
                      : state === "active"
                        ? "gradient-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground")
                  }
                >
                  {state === "done" ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.span
                        key={state === "done" ? "d" : "l"}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.25 }}
                      >
                        {state === "done" ? s.result : s.label + (state === "active" ? "…" : "")}
                      </motion.span>
                    </AnimatePresence>
                  </div>
                  {state !== "idle" && (
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        key={state}
                        initial={{ width: state === "active" ? "0%" : "100%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: state === "active" ? 0.85 : 0.2, ease: "easeInOut" }}
                        className="h-full gradient-primary"
                      />
                    </div>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
