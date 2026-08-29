import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { recomputeScores } from "@/lib/capture";
import { DEFAULT_FORBIDDEN_PENALTY_M2, DEFAULT_FORBIDDEN_RADIUS_M } from "@/lib/conquete";

export type ForbiddenZone = {
  id: string;
  game_id: string;
  lat: number;
  lng: number;
  radius_m: number;
  penalty_m2: number;
};

export async function addForbiddenZone(
  gameId: string,
  lat: number,
  lng: number,
  radiusM: number = DEFAULT_FORBIDDEN_RADIUS_M,
  penaltyM2: number = DEFAULT_FORBIDDEN_PENALTY_M2,
) {
  const { error } = await supabase
    .from("forbidden_zones")
    .insert({ game_id: gameId, lat, lng, radius_m: radiusM, penalty_m2: penaltyM2 });
  if (error) throw error;
}

export async function removeForbiddenZone(id: string) {
  const { error } = await supabase.from("forbidden_zones").delete().eq("id", id);
  if (error) throw error;
}

/** Applies a penalty to a team for straying into a forbidden zone. */
export async function applyPenalty(zone: ForbiddenZone, teamId: string) {
  const { data: team } = await supabase
    .from("teams")
    .select("penalty_m2")
    .eq("id", teamId)
    .maybeSingle();
  await supabase
    .from("teams")
    .update({ penalty_m2: (team?.penalty_m2 ?? 0) + zone.penalty_m2 })
    .eq("id", teamId);
  await recomputeScores(zone.game_id);
}

export function useForbiddenZones(gameId: string | null) {
  const [zones, setZones] = useState<ForbiddenZone[]>([]);

  const refresh = useCallback(async () => {
    if (!gameId) return;
    const { data } = await supabase.from("forbidden_zones").select("*").eq("game_id", gameId);
    setZones((data ?? []) as unknown as ForbiddenZone[]);
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;
    void refresh();
    const channel = supabase
      .channel(`forbidden-zones-${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "forbidden_zones",
          filter: `game_id=eq.${gameId}`,
        },
        () => void refresh(),
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [gameId, refresh]);

  return { zones };
}
