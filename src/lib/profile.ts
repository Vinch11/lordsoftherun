import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  email: string | null;
  role: "teacher" | "admin";
  approved: boolean;
};

export function useProfile(userId: string | null | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    void supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        setProfile(data as Profile | null);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  return { profile, loading };
}
