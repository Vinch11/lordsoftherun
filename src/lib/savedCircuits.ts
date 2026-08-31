import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { setCheckpoints } from "@/lib/circuit";

export type SavedCircuit = {
  id: string;
  owner_id: string;
  name: string;
  points: [number, number][];
};

export async function saveSavedCircuit(ownerId: string, name: string, points: [number, number][]) {
  const { error } = await supabase.from("saved_circuits").insert({
    owner_id: ownerId,
    name,
    points,
  });
  if (error) throw error;
}

export async function deleteSavedCircuit(id: string) {
  const { error } = await supabase.from("saved_circuits").delete().eq("id", id);
  if (error) throw error;
}

/** Re-creates a saved circuit's checkpoints in `gameId` — replaces any existing ones. */
export async function applySavedCircuit(gameId: string, circuit: SavedCircuit) {
  await setCheckpoints(gameId, circuit.points);
}

export function useSavedCircuits(ownerId: string | null) {
  const [circuits, setCircuits] = useState<SavedCircuit[]>([]);

  const refresh = useCallback(async () => {
    if (!ownerId) return;
    const { data } = await supabase
      .from("saved_circuits")
      .select("*")
      .eq("owner_id", ownerId)
      .order("name");
    setCircuits((data ?? []) as unknown as SavedCircuit[]);
  }, [ownerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { circuits, refresh };
}
