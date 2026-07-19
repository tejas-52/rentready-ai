import { createFileRoute } from "@tanstack/react-router";
import {
  BadgeCheck,
  Briefcase,
  Check,
  Globe2,
  Home,
  Loader2,
  MapPin,
  Pencil,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { AppLayout } from "@/components/app-layout";
import { SectionHeader, Stagger, StaggerItem } from "@/components/ui-bits";
import { useAuth } from "@/lib/auth-context";
import { useAppState, emptyAppState } from "@/lib/app-queries";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — RentReady AI" },
      { name: "description", content: "Your automatically generated rental profile." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { t } = useTranslation();
  const { displayName, initials, profile, user, isDemo, refreshProfile } = useAuth();
  const { data, refetch } = useAppState();
  const state = data ?? emptyAppState;
  const { profileSummary, confidence } = state;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const dash = "—";
  const fullName = profileSummary.fullName ?? displayName;

  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const fieldDefs = [
    { key: "fullName", label: t("profile.fields.name", { defaultValue: "Full Name" }), value: fullName, icon: BadgeCheck },
    { key: "occupation", label: t("profile.fields.occupation"), value: profileSummary.occupation ?? dash, icon: Briefcase },
    { key: "nationality", label: t("profile.fields.nationality"), value: profileSummary.nationality ?? profile?.country ?? dash, icon: Globe2 },
    { key: "monthlyIncome", label: t("profile.fields.monthlyIncome"), value: profileSummary.monthlyIncome ?? dash, icon: Wallet },
    { key: "address", label: t("profile.fields.address"), value: profileSummary.address ?? dash, icon: MapPin },
    { key: "employer", label: t("profile.fields.employer", { defaultValue: "Employer" }), value: profileSummary.employer ?? dash, icon: Briefcase },
    { key: "visaStatus", label: t("profile.fields.visa"), value: profileSummary.visaStatus ?? dash, icon: ShieldCheck },
  ];

  const startEdit = () => {
    const vals: Record<string, string> = {};
    fieldDefs.forEach(f => { vals[f.key] = f.value === dash ? "" : f.value; });
    setEditValues(vals);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditValues({});
  };

  const saveProfile = async () => {
    if (!user && !isDemo) return;
    setSaving(true);
    try {
      // Save to profiles table directly
      if (user) {
        const { error } = await supabase
          .from("profiles")
          .update({
            full_name: editValues.fullName || fullName,
            employment_status: editValues.occupation || profile?.employment_status,
            rental_country: editValues.address || profile?.rental_country,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);
        if (error) throw error;
      }
      toast.success("Profile updated");
      setEditing(false);
      await refreshProfile();
      await refetch();
    } catch (e) {
      console.error(e);
      toast.error("Failed to save: " + ((e as any)?.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <SectionHeader
        eyebrow={t("nav.profile")}
        title={t("profile.title")}
        subtitle={t("profile.subtitle")}
      />

      <div className="rounded-3xl border border-border/60 bg-card p-6 md:p-8">
        <div className="flex flex-col items-center gap-4 text-center md:flex-row md:items-center md:gap-6 md:text-left">
          <div className="relative">
            <div className="grid h-24 w-24 place-items-center rounded-3xl gradient-primary text-2xl font-semibold text-primary-foreground shadow-glow">
              {initials}
            </div>
            <div className="absolute -bottom-1.5 -right-1.5 grid h-7 w-7 place-items-center rounded-full border-4 border-card bg-success text-success-foreground">
              <BadgeCheck className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-semibold tracking-tight">{fullName}</h2>
            <p className="text-sm text-muted-foreground">
              {profileSummary.occupation ?? profile?.employment_status ?? t("profile.title")}
            </p>
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-xs font-semibold text-success">
              <Home className="h-3.5 w-3.5" /> {t("profile.rentalConfidence")} {confidence}%
            </div>
          </div>
          {!editing ? (
            <button onClick={startEdit} className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-accent">
              <Pencil className="h-4 w-4" /> {t("common.edit")}
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={saveProfile} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {t("common.save")}
              </button>
              <button onClick={cancelEdit} className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm font-semibold hover:bg-accent">
                <X className="h-4 w-4" /> {t("common.cancel")}
              </button>
            </div>
          )}
        </div>
      </div>

      <Stagger className="mt-6 grid gap-3 sm:grid-cols-2">
        {fieldDefs.map((f) => (
          <StaggerItem key={f.key}>
            <div className="group flex items-center gap-4 rounded-2xl border border-border/60 bg-card p-4 transition-colors hover:bg-accent/40">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{f.label}</div>
                {editing ? (
                  <input
                    value={editValues[f.key] || ""}
                    onChange={(e) => setEditValues(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={dash}
                    className="mt-0.5 w-full rounded-lg border border-border bg-background/70 px-2 py-1 text-sm font-semibold outline-none focus:border-primary/50"
                  />
                ) : (
                  <div className="truncate text-sm font-semibold">{f.value}</div>
                )}
              </div>
              {!editing && <Pencil className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />}
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </AppLayout>
  );
}
