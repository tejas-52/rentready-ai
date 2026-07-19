import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";

/**
 * Client-side gate. Redirects unauthenticated users to /auth (unless demo mode).
 * Also nudges signed-in users through onboarding on first visit.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { loading, isAuthenticated, isDemo, profile, user } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      navigate({ to: "/auth", replace: true });
      return;
    }
    // Signed-in users (not demo) who haven't completed onboarding
    if (
      user &&
      !isDemo &&
      profile &&
      !profile.onboarding_completed &&
      pathname !== "/onboarding" &&
      pathname !== "/welcome"
    ) {
      navigate({ to: "/welcome", replace: true });
    }
  }, [loading, isAuthenticated, user, isDemo, profile, pathname, navigate]);

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) return null;
  return <>{children}</>;
}
