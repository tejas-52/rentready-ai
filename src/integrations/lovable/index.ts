// This file has been modified to redirect Lovable OAuth directly to Supabase OAuth
// and avoid dependency on @lovable.dev/cloud-auth-js.

import { supabase } from "../supabase/client";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: "google" | "apple" | "microsoft" | "lovable", opts?: SignInOptions) => {
      // Direct call to Supabase OAuth
      const realProvider = provider === "lovable" ? "google" : provider;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: realProvider as any,
        options: {
          redirectTo: opts?.redirect_uri || window.location.origin,
          queryParams: opts?.extraParams,
        },
      });

      if (error) {
        return { error, tokens: null, redirected: false };
      }

      // Supabase signInWithOAuth handles redirect automatically.
      return { error: null, tokens: null, redirected: true };
    },
  },
};
