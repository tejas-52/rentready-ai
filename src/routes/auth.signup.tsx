import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";
import { LanguageSwitcher } from "@/components/language-switcher";

export const Route = createFileRoute("/auth/signup")({
  head: () => ({
    meta: [
      { title: "Create your account — RentReady AI" },
      { name: "description", content: "Sign up for RentReady AI in seconds." },
    ],
  }),
  component: SignupPage,
});

const COUNTRIES = ["United Kingdom", "Germany", "United States", "Canada", "India", "Other"];

function SignupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading, signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("United Kingdom");
  const [busy, setBusy] = useState(false);

  // Redirect when auth confirms the session after signup
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate({ to: "/welcome", replace: true });
    }
  }, [authLoading, isAuthenticated, navigate]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error(t("auth.errors.nameRequired"));
    if (!email.trim()) return toast.error(t("auth.errors.emailRequired"));
    if (password.length < 6) return toast.error(t("auth.errors.passwordShort"));
    setBusy(true);
    const { error } = await signUp(name, email, password, country);
    setBusy(false);
    if (error) return toast.error(error);
    toast.success(t("auth.toasts.created"));
    // useEffect will redirect once auth state confirms the session
  };

  return (
    <div className="relative min-h-dvh bg-background">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ background: "var(--gradient-glow)" }}
      />
      <div className="absolute right-4 top-4 z-10">
        <LanguageSwitcher />
      </div>
      <div className="mx-auto flex min-h-dvh w-full max-w-md items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full"
        >
          <div className="mb-6 flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl gradient-primary text-primary-foreground shadow-glow">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="text-sm font-semibold tracking-tight">{t("app.name")}</div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("auth.createAccount")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("auth.createSubtitle")}</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-3">
            <Field label={t("common.name")}>
              <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Alex Doe" />
            </Field>
            <Field label={t("common.email")}>
              <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="you@example.com" />
            </Field>
            <Field label={t("common.password")}>
              <input type="password" required autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="••••••••" />
            </Field>
            <Field label={t("common.country")}>
              <select value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls}>
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </Field>

            <button
              type="submit"
              disabled={busy}
              className="btn-primary-premium mt-2 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-70"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>{t("auth.createAccount")} <ArrowRight className="h-4 w-4" /></>)}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            {t("auth.alreadyHaveAccount")}{" "}
            <Link to="/auth" className="font-semibold text-primary hover:underline">
              {t("common.signIn")}
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

const inputCls =
  "mt-1 w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
