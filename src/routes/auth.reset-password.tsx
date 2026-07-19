import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/reset-password")({
  head: () => ({ meta: [{ title: "Set a new password — RentReady AI" }] }),
  component: ResetPage,
});

function ResetPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < 6) return toast.error(t("auth.errors.passwordShort"));
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(t("auth.toasts.passwordUpdated"));
    navigate({ to: "/", replace: true });
  };

  return (
    <div className="relative min-h-dvh bg-background">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10" style={{ background: "var(--gradient-glow)" }} />
      <div className="mx-auto flex min-h-dvh w-full max-w-md items-center justify-center p-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full">
          <div className="mb-4 flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl gradient-primary text-primary-foreground shadow-glow">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="text-sm font-semibold tracking-tight">{t("app.name")}</div>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("auth.setNewPassword")}</h1>
          <form onSubmit={onSubmit} className="mt-6 space-y-3">
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("auth.newPassword")}
              className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="submit"
              disabled={busy}
              className="btn-primary-premium flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold disabled:opacity-70"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("auth.updatePassword")}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
