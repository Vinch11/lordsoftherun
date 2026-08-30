import { supabase } from "@/integrations/supabase/client";

/**
 * Every player — including students who never create an account — needs a
 * Supabase session so row-level security can tell "someone taking part in this
 * game" apart from "any stranger on the internet". Teachers sign in with their
 * email; students get a silent anonymous session, which keeps the join flow
 * password-free while still giving each device a verifiable identity.
 */
let pending: Promise<boolean> | null = null;

async function bootstrap(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return true;
  const { error } = await supabase.auth.signInAnonymously();
  if (error) {
    // Most common cause: "Allow anonymous sign-ins" is disabled for this
    // Supabase project. Without a session, every read/write is rejected by
    // RLS, which otherwise surfaces as a confusing "no game with this code".
    console.error("Anonymous session failed", error);
    return false;
  }
  return true;
}

/** Resolves to false if no Supabase session could be established. */
export function ensureSession(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(true);
  pending ??= bootstrap().finally(() => {
    pending = null;
  });
  return pending;
}
