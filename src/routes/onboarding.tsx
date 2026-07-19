import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";
import { AuthGate } from "@/components/auth-gate";
import { setAppLanguage, SUPPORTED_LANGS, type Lang } from "@/lib/i18n";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Onboarding — RentReady AI" }] }),
  component: () => (
    <AuthGate>
      <OnboardingPage />
    </AuthGate>
  ),
});

const COUNTRIES = ["Germany", "USA", "United Kingdom", "India", "Canada", "Other"];

function OnboardingPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { updateProfile } = useAuth();
  const [step, setStep] = useState(0);
  const [lang, setLang] = useState<Lang>((i18n.language?.split("-")[0] as Lang) || "en");
  const [rentalCountry, setRentalCountry] = useState<string | null>(null);
  const [employment, setEmployment] = useState<string | null>(null);
  const [docs, setDocs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const EMPLOYMENT_OPTS = [
    { id: "student", label: t("onboarding.employmentOptions.student") },
    { id: "employee", label: t("onboarding.employmentOptions.employee") },
    { id: "selfEmployed", label: t("onboarding.employmentOptions.selfEmployed") },
    { id: "freelancer", label: t("onboarding.employmentOptions.freelancer") },
    { id: "other", label: t("onboarding.employmentOptions.other") },
  ];
  const DOC_OPTS = [
    { id: "passport", label: t("onboarding.docsOptions.passport") },
    { id: "visa", label: t("onboarding.docsOptions.visa") },
    { id: "employment", label: t("onboarding.docsOptions.employment") },
    { id: "payslip", label: t("onboarding.docsOptions.payslip") },
    { id: "bank", label: t("onboarding.docsOptions.bank") },
    { id: "utility", label: t("onboarding.docsOptions.utility") },
    { id: "reference", label: t("onboarding.docsOptions.reference") },
  ];

  const steps = [
    {
      title: t("onboarding.language.title"),
      subtitle: t("onboarding.language.subtitle"),
      render: (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {SUPPORTED_LANGS.map((l) => {
            const active = lang === l;
            const label = l === "en" ? "🇬🇧 English" : l === "de" ? "🇩🇪 Deutsch" : "🇮🇳 हिन्दी";
            return (
              <button
                key={l}
                onClick={() => {
                  setLang(l);
                  void setAppLanguage(l);
                }}
                className={
                  "flex items-center justify-between rounded-2xl border px-4 py-3.5 text-left text-sm font-medium transition " +
                  (active
                    ? "border-primary bg-primary/[0.06] text-foreground shadow-glow"
                    : "border-border bg-card hover:border-primary/40 hover:bg-accent/40")
                }
              >
                {label}
                {active && (
                  <span className="grid h-5 w-5 place-items-center rounded-full gradient-primary text-primary-foreground">
                    <Check className="h-3 w-3" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ),
      canContinue: true,
    },
    {
      title: t("onboarding.location.title"),
      subtitle: t("onboarding.location.subtitle"),
      render: <OptionGrid options={COUNTRIES.map((c) => ({ id: c, label: c }))} value={rentalCountry} onChange={setRentalCountry} />,
      canContinue: !!rentalCountry,
    },
    {
      title: t("onboarding.employment.title"),
      subtitle: t("onboarding.employment.subtitle"),
      render: <OptionGrid options={EMPLOYMENT_OPTS} value={employment} onChange={setEmployment} />,
      canContinue: !!employment,
    },
    {
      title: t("onboarding.docs.title"),
      subtitle: t("onboarding.docs.subtitle"),
      render: <MultiGrid options={DOC_OPTS} values={docs} onChange={setDocs} />,
      canContinue: true,
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  const onNext = async () => {
    if (!current.canContinue) return;
    if (!isLast) return setStep((s) => s + 1);
    setBusy(true);
    const { error } = await updateProfile({
      rental_country: rentalCountry,
      employment_status: employment,
      preferred_language: lang,
      onboarding_completed: true,
    });
    setBusy(false);
    if (error) return toast.error(error);
    toast.success(t("onboarding.allSet"));
    navigate({ to: "/", replace: true });
  };

  return (
    <div className="relative min-h-dvh bg-background">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ background: "var(--gradient-glow)" }}
      />
      <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg gradient-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="text-sm font-semibold tracking-tight">{t("app.name")}</div>
          </div>
          <div className="text-xs font-medium text-muted-foreground">
            {t("onboarding.step", { current: step + 1, total: steps.length })}
          </div>
        </div>

        <div className="mt-6 flex gap-1.5">
          {steps.map((_, i) => (
            <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: i <= step ? "100%" : "0%" }}
                transition={{ duration: 0.4 }}
                className="h-full gradient-primary"
              />
            </div>
          ))}
        </div>

        <div className="mt-10 flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
            >
              <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                {current.title}
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">{current.subtitle}</p>
              <div className="mt-6">{current.render}</div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-8 flex items-center justify-between gap-3">
          <button
            onClick={() => (step === 0 ? navigate({ to: "/welcome" }) : setStep((s) => s - 1))}
            className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> {t("common.back")}
          </button>
          <button
            onClick={onNext}
            disabled={!current.canContinue || busy}
            className="btn-primary-premium flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                {isLast ? t("common.finish") : t("common.continue")} <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

type Opt = { id: string; label: string };

function OptionGrid({ options, value, onChange }: { options: Opt[]; value: string | null; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={
              "flex items-center justify-between rounded-2xl border px-4 py-3.5 text-left text-sm font-medium transition " +
              (active
                ? "border-primary bg-primary/[0.06] text-foreground shadow-glow"
                : "border-border bg-card hover:border-primary/40 hover:bg-accent/40")
            }
          >
            {o.label}
            {active && (
              <span className="grid h-5 w-5 place-items-center rounded-full gradient-primary text-primary-foreground">
                <Check className="h-3 w-3" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function MultiGrid({ options, values, onChange }: { options: Opt[]; values: string[]; onChange: (v: string[]) => void }) {
  const toggle = (o: string) =>
    onChange(values.includes(o) ? values.filter((v) => v !== o) : [...values, o]);
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {options.map((o) => {
        const active = values.includes(o.id);
        return (
          <button
            key={o.id}
            onClick={() => toggle(o.id)}
            className={
              "flex items-center justify-between rounded-2xl border px-4 py-3.5 text-left text-sm font-medium transition " +
              (active
                ? "border-primary bg-primary/[0.06] text-foreground"
                : "border-border bg-card hover:border-primary/40 hover:bg-accent/40")
            }
          >
            {o.label}
            <span
              className={
                "grid h-5 w-5 place-items-center rounded-md border " +
                (active ? "border-primary bg-primary text-primary-foreground" : "border-border")
              }
            >
              {active && <Check className="h-3 w-3" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
