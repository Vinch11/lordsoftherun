import { supabase } from "@/integrations/supabase/client";

/**
 * Every player — including students who never create an account — needs a
 * Supabase session so row-level security can tell "someone taking part in this
 * game" apart from "any stranger on the internet". Teachers sign in with their
 * email; students get a silent anonymous session, which keeps the join flow
 * password-free while still giving each device a verifiable identity.
 */
let pending: Promise<void> | null = null;

async function bootstrap(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return;
  const { error } = await supabase.auth.signInAnonymously();
  if (error) console.error("Anonymous session failed", error);
}

export function ensureSession(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  pending ??= bootstrap().finally(() => {
    pending = null;
  });
  return pending;
}
