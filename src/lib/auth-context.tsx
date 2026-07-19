import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { setAppLanguage } from "@/lib/i18n";

export type Profile = {
  id: string;
  full_name: string | null;
  email: string | null;
  country: string | null;
  rental_country: string | null;
  employment_status: string | null;
  photo_url: string | null;
  onboarding_completed: boolean;
  preferred_language?: string;
};

const DEMO_PROFILE: Profile = {
  id: "demo-user",
  full_name: "John Carter",
  email: "demo@rentready.ai",
  country: "United Kingdom",
  rental_country: "United Kingdom",
  employment_status: "Employee",
  photo_url: null,
  onboarding_completed: true,
  preferred_language: "en",
};

type AuthCtx = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isDemo: boolean;
  isAuthenticated: boolean;
  loading: boolean;
  displayName: string;
  firstName: string;
  initials: string;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (
    name: string,
    email: string,
    password: string,
    country: string,
  ) => Promise<{ error?: string }>;
  signInWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  enableDemo: () => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<{ error?: string }>;
};

const AuthContext = createContext<AuthCtx | null>(null);

const DEMO_KEY = "rentready:demo-mode";

function makeInitials(name: string | null | undefined, fallback = "U") {
  if (!name) return fallback;
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (uid: string) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
    if (data) {
      setProfile(data as Profile);
      const lang = (data as any).preferred_language;
      if (lang) void setAppLanguage(lang);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const demoFlag = window.localStorage.getItem(DEMO_KEY) === "1";

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setIsDemo(false);
        window.localStorage.removeItem(DEMO_KEY);
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setProfile(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        loadProfile(s.user.id);
      } else if (demoFlag) {
        setIsDemo(true);
        setProfile(DEMO_PROFILE);
      }
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const enableDemo = async () => {
    if (typeof window !== "undefined") window.localStorage.setItem(DEMO_KEY, "1");
    // Sign in as demo user so all Supabase operations work with real auth
    const { data } = await supabase.auth.signInWithPassword({
      email: "demo@rentready.ai",
      password: "Demo123456!",
    });
    if (data.user) {
      setIsDemo(true);
      setUser(data.user);
      setSession(data.session);
      setProfile({ ...DEMO_PROFILE, id: data.user.id, email: data.user.email || DEMO_PROFILE.email });
    } else {
      setIsDemo(true);
      setProfile(DEMO_PROFILE);
    }
  };

  const signIn: AuthCtx["signIn"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  };

  const signUp: AuthCtx["signUp"] = async (name, email, password, country) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        data: { full_name: name, country },
      },
    });
    if (error) return { error: error.message };
    if (data.user) {
      // ensure profile row has country/name (trigger may have set defaults)
      await supabase.from("profiles").upsert(
        { id: data.user.id, email, full_name: name, country },
        { onConflict: "id" },
      );
    }
    return {};
  };

  const signInWithGoogle: AuthCtx["signInWithGoogle"] = async () => {
    if (typeof window === "undefined") return;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
  };

  const resetPassword: AuthCtx["resetPassword"] = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo:
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/reset-password`
          : undefined,
    });
    return error ? { error: error.message } : {};
  };

  const signOut = async () => {
    if (typeof window !== "undefined") window.localStorage.removeItem(DEMO_KEY);
    setIsDemo(false);
    setProfile(null);
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id);
  };

  const updateProfile: AuthCtx["updateProfile"] = async (patch) => {
    if (isDemo) {
      setProfile((p) => (p ? { ...p, ...patch } : p));
      return {};
    }
    if (!user) return { error: "Not signed in" };
    const { error, data } = await supabase
      .from("profiles")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", user.id)
      .select()
      .maybeSingle();
    if (error) return { error: error.message };
    if (data) setProfile(data as Profile);
    return {};
  };

  const displayName = profile?.full_name || user?.email?.split("@")[0] || "there";
  const firstName = displayName.split(" ")[0] || "there";
  const initials = makeInitials(profile?.full_name || user?.email || "U");

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isDemo,
        isAuthenticated: !!user || isDemo,
        loading,
        displayName,
        firstName,
        initials,
        signIn,
        signUp,
        signInWithGoogle,
        resetPassword,
        enableDemo,
        signOut,
        refreshProfile,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
