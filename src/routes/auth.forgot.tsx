import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, MailCheck, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth-context";
import { LanguageSwitcher } from "@/components/language-switcher";

export const Route = createFileRoute("/auth/forgot")({
  head: () => ({ meta: [{ title: "Reset password — RentReady AI" }] }),
  component: ForgotPage,
});

function ForgotPage() {
  const { t } = useTranslation();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await resetPassword(email);
    setBusy(false);
    if (error) return toast.error(error);
    setSent(true);
    toast.success(t("auth.toasts.checkInbox"));
  };

  return (
    <div className="relative min-h-dvh bg-background">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10" style={{ background: "var(--gradient-glow)" }} />
      <div className="absolute right-4 top-4 z-10"><LanguageSwitcher /></div>
      <div className="mx-auto flex min-h-dvh w-full max-w-md items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full">
          <Link to="/auth" className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> {t("auth.backToSignIn")}
          </Link>
          <div className="mb-4 flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl gradient-primary text-primary-foreground shadow-glow">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="text-sm font-semibold tracking-tight">{t("app.name")}</div>
          </div>

          {sent ? (
            <div className="rounded-2xl border border-border/60 bg-card p-6 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-success/15 text-success">
                <MailCheck className="h-6 w-6" />
              </div>
              <h1 className="mt-4 text-lg font-semibold">{t("auth.checkEmail")}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{t("auth.resetSent", { email })}</p>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">{t("auth.resetPassword")}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{t("auth.resetHelp")}</p>
              <form onSubmit={onSubmit} className="mt-6 space-y-3">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="btn-primary-premium flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-70"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.sendResetLink")}
                </button>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
