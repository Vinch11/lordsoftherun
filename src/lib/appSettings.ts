import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/** App-wide feature toggles, controlled from the admin page — readable by
 * any signed-in account, writable only by an admin (enforced by RLS). */
export type AppSettings = {
  drapeauCircuitEnabled: boolean;
};

const DEFAULTS: AppSettings = {
  drapeauCircuitEnabled: false,
};

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("key, value")
      .eq("key", "drapeau_circuit_enabled")
      .maybeSingle();
    setSettings({ drapeauCircuitEnabled: data?.value ?? false });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { settings, refresh };
}

export async function setDrapeauCircuitEnabled(next: boolean): Promise<void> {
  const { error } = await supabase
    .from("app_settings")
    .update({ value: next })
    .eq("key", "drapeau_circuit_enabled");
  if (error) throw error;
}
