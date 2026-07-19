import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Bell,
  Globe,
  Lock,
  LogOut,
  Moon,
  Trash2,
  User as UserIcon,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { SectionHeader } from "@/components/ui-bits";
import { useAuth } from "@/lib/auth-context";
import { setAppLanguage, SUPPORTED_LANGS, type Lang } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [{ title: "Settings — RentReady AI" }],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { profile, displayName, isDemo, signOut, updateProfile, user } = useAuth();
  const [deleting, setDeleting] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    toast.success(t("auth.toasts.signedOut"));
    navigate({ to: "/auth", replace: true });
  };

  const deleteAllData = async () => {
    if (!user || isDemo || !confirm("This will permanently delete all your documents, extractions, reports, and chat history. This cannot be undone. Continue?")) return;
    setDeleting(true);
    try {
      // Delete all user data via the REST API
      const tables = ["chat_messages", "agent_runs", "agent_credentials", "reports", "recommendations", "validations", "extractions", "documents", "applications"] as const;
      for (const table of tables) {
        await (supabase.from(table) as any).delete().eq("user_id" as any, user.id);
      }
      toast.success("All your data has been deleted.");
      await signOut();
      navigate({ to: "/auth", replace: true });
    } catch (e) {
      toast.error("Deletion failed. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const notImplemented = () =>
    toast(t("settings.comingSoon"), { description: t("settings.comingSoonDetail") });

  const current = (i18n.language?.split("-")[0] ?? "en") as Lang;

  const onLangChange = async (l: Lang) => {
    await setAppLanguage(l);
    if (!isDemo) await updateProfile({ preferred_language: l });
    toast.success(t("settings.languageUpdated"));
  };

  return (
    <AppLayout>
      <SectionHeader
        eyebrow={t("nav.settings")}
        title={t("settings.title")}
        subtitle={t("settings.subtitle")}
      />

      <div className="space-y-4 pb-8">
        {/* Account */}
        <Section icon={UserIcon} title={t("settings.account")}>
          <div className="space-y-3">
            <Row label={t("common.name")} value={displayName} />
            <Row label={t("common.email")} value={profile?.email ?? (isDemo ? t("auth.continueAsDemo") : "—")} />
            <Row label={t("common.country")} value={profile?.country ?? "—"} />
            <button
              onClick={() => navigate({ to: "/profile" })}
              className="mt-2 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-accent/50"
            >
              {t("settings.editProfile")}
            </button>
          </div>
        </Section>

        {/* Language & Region */}
        <Section icon={Globe} title={t("language.sectionTitle")}>
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              {t("language.preferred")}
            </label>
            <select
              value={current}
              onChange={(e) => void onLangChange(e.target.value as Lang)}
              className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
            >
              {SUPPORTED_LANGS.map((l) => (
                <option key={l} value={l}>
                  {l === "en" ? "🇬🇧 English" : l === "de" ? "🇩🇪 Deutsch" : "🇮🇳 हिन्दी"}
                </option>
              ))}
            </select>
          </div>
        </Section>

        <Section icon={Bell} title={t("settings.notifications")}>
          <Toggle label={t("settings.notifEmail")} defaultChecked onChange={notImplemented} />
        </Section>

        <Section icon={Moon} title={t("settings.theme")}>
          <Toggle
            label={t("settings.darkMode")}
            onChange={(v) => {
              if (typeof document !== "undefined") {
                document.documentElement.classList.toggle("dark", v);
              }
              toast.success(t("settings.themeSwitched", { mode: v ? t("settings.dark") : t("settings.light") }));
            }}
          />
        </Section>

        <Section icon={Lock} title={t("settings.privacy")}>
          <Toggle label={t("settings.shareData")} onChange={notImplemented} />
        </Section>

        <div className="rounded-3xl border border-destructive/30 bg-card p-5 md:p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-destructive/10 text-destructive">
              <Trash2 className="h-4 w-4" />
            </div>
            <div className="text-sm font-semibold">{t("settings.dangerZone")}</div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold hover:bg-accent/50"
            >
              <LogOut className="h-4 w-4" /> {t("common.signOut")}
            </button>
            <button
              onClick={deleteAllData}
              disabled={deleting || isDemo}
              className="flex items-center gap-2 rounded-xl border border-destructive/40 px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {deleting ? "Deleting…" : (isDemo ? "Sign in to delete" : t("settings.deleteAccount"))}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-border/60 bg-card p-5 md:p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="text-sm font-semibold">{title}</div>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border/60 bg-background/60 px-3.5 py-2.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function Toggle({ label, defaultChecked, onChange }: { label: string; defaultChecked?: boolean; onChange?: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-border/60 bg-background/60 px-3.5 py-3">
      <span className="text-sm">{label}</span>
      <input
        type="checkbox"
        defaultChecked={defaultChecked}
        onChange={(e) => onChange?.(e.target.checked)}
        className="h-5 w-9 cursor-pointer appearance-none rounded-full bg-muted transition-all checked:bg-primary relative after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] checked:after:left-[18px]"
      />
    </label>
  );
}
