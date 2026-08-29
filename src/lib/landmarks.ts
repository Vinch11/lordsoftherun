import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { recomputeScores } from "@/lib/capture";
import { DEFAULT_LANDMARK_BONUS_M2, LANDMARK_CLAIM_RADIUS_M, haversine } from "@/lib/conquete";

export type Landmark = {
  id: string;
  game_id: string;
  lat: number;
  lng: number;
  bonus_m2: number;
  claimed_by_team_id: string | null;
  claimed_at: string | null;
};

export async function addLandmark(
  gameId: string,
  lat: number,
  lng: number,
  bonusM2: number = DEFAULT_LANDMARK_BONUS_M2,
) {
  const { error } = await supabase
    .from("landmarks")
    .insert({ game_id: gameId, lat, lng, bonus_m2: bonusM2 });
  if (error) throw error;
}

export async function removeLandmark(id: string) {
  const { error } = await supabase.from("landmarks").delete().eq("id", id);
  if (error) throw error;
}

/** Tries to be the first team to claim a landmark; returns true on success. */
export async function tryClaimLandmark(landmark: Landmark, teamId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("landmarks")
    .update({ claimed_by_team_id: teamId, claimed_at: new Date().toISOString() })
    .eq("id", landmark.id)
    .is("claimed_by_team_id", null)
    .select()
    .maybeSingle();
  if (error || !data) return false;

  const { data: team } = await supabase
    .from("teams")
    .select("landmark_bonus_m2")
    .eq("id", teamId)
    .maybeSingle();
  await supabase
    .from("teams")
    .update({ landmark_bonus_m2: (team?.landmark_bonus_m2 ?? 0) + landmark.bonus_m2 })
    .eq("id", teamId);
  await recomputeScores(landmark.game_id);
  return true;
}

/** Checks every unclaimed landmark against a position and claims any within range. */
export async function checkLandmarkClaims(
  landmarks: Landmark[],
  teamId: string,
  point: [number, number],
): Promise<Landmark | null> {
  for (const l of landmarks) {
    if (l.claimed_by_team_id) continue;
    if (haversine(point, [l.lat, l.lng]) <= LANDMARK_CLAIM_RADIUS_M) {
      if (await tryClaimLandmark(l, teamId)) return l;
    }
  }
  return null;
}

export function useLandmarks(gameId: string | null) {
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);

  const refresh = useCallback(async () => {
    if (!gameId) return;
    const { data } = await supabase.from("landmarks").select("*").eq("game_id", gameId);
    setLandmarks((data ?? []) as unknown as Landmark[]);
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;
    void refresh();
    const channel = supabase
      .channel(`landmarks-${gameId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "landmarks", filter: `game_id=eq.${gameId}` },
        () => void refresh(),
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [gameId, refresh]);

  return { landmarks };
}
