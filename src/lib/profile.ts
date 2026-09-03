import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  email: string | null;
  role: "teacher" | "admin";
  approved: boolean;
  terminology: "enseignant" | "organisateur";
};

export function useProfile(userId: string | null | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null);
  // The profile is only "settled" once we have fetched it for the *current*
  // user id. Without this, a component could observe loading === false with a
  // null profile during the render where the auth session has just resolved,
  // and wrongly conclude the user has no access.
  const [settledFor, setSettledFor] = useState<string | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setSettledFor(userId ?? null);
      return;
    }
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    setProfile(data as Profile | null);
    setSettledFor(userId);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loading = settledFor !== (userId ?? null);

  return { profile, loading, refresh };
}
