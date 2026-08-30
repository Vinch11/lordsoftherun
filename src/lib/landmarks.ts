import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { recomputeScores } from "@/lib/capture";
import {
  DEFAULT_LANDMARK_BONUS_M2,
  DEFAULT_LANDMARK_ICON,
  LANDMARK_CLAIM_RADIUS_M,
  haversine,
} from "@/lib/conquete";

export type LandmarkKind = "points" | "shield";

export type Landmark = {
  id: string;
  game_id: string;
  lat: number;
  lng: number;
  bonus_m2: number;
  icon: string;
  kind: LandmarkKind;
  shield_duration_s: number;
  active_after_minutes: number;
  active_until_minutes: number | null;
  claimed_by_team_id: string | null;
  claimed_at: string | null;
};

export async function addLandmark(
  gameId: string,
  lat: number,
  lng: number,
  bonusM2: number = DEFAULT_LANDMARK_BONUS_M2,
  icon: string = DEFAULT_LANDMARK_ICON,
  activeAfterMinutes = 0,
  activeUntilMinutes: number | null = null,
  kind: LandmarkKind = "points",
  shieldDurationS = 30,
) {
  const { error } = await supabase.from("landmarks").insert({
    game_id: gameId,
    lat,
    lng,
    bonus_m2: bonusM2,
    icon,
    active_after_minutes: activeAfterMinutes,
    active_until_minutes: activeUntilMinutes,
    kind,
    shield_duration_s: shieldDurationS,
  });
  if (error) throw error;
}

export async function updateLandmark(
  id: string,
  patch: Partial<
    Pick<
      Landmark,
      | "bonus_m2"
      | "icon"
      | "active_after_minutes"
      | "active_until_minutes"
      | "kind"
      | "shield_duration_s"
    >
  >,
) {
  const { error } = await supabase.from("landmarks").update(patch).eq("id", id);
  if (error) throw error;
}

export async function removeLandmark(id: string) {
  const { error } = await supabase.from("landmarks").delete().eq("id", id);
  if (error) throw error;
}

/**
 * A landmark is live on the map once it has been claimed (never shown again),
 * and while elapsed game time sits within its [active_after, active_until]
 * window (no started_at yet — e.g. still in the lobby — counts as 0 elapsed).
 */
export function isLandmarkActive(
  landmark: Landmark,
  startedAt: string | null,
  nowMs: number,
): boolean {
  if (landmark.claimed_by_team_id) return false;
  const elapsedMinutes = startedAt ? (nowMs - new Date(startedAt).getTime()) / 60000 : 0;
  if (elapsedMinutes < landmark.active_after_minutes) return false;
  if (landmark.active_until_minutes != null && elapsedMinutes > landmark.active_until_minutes) {
    return false;
  }
  return true;
}

/**
 * Tries to be the first team to claim a landmark; returns true on success.
 * `ctfMode` skips the territory-oriented recomputeScores (which would zero
 * out a capture-the-flag team's score, since it has no territories) and
 * instead applies the "points" bonus straight to score_m2. A "shield"
 * landmark never touches score_m2 either way — it just grants tag immunity.
 */
export async function tryClaimLandmark(
  landmark: Landmark,
  teamId: string,
  ctfMode = false,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("landmarks")
    .update({ claimed_by_team_id: teamId, claimed_at: new Date().toISOString() })
    .eq("id", landmark.id)
    .is("claimed_by_team_id", null)
    .select()
    .maybeSingle();
  if (error || !data) return false;

  if (landmark.kind === "shield") {
    const shieldUntil = new Date(Date.now() + landmark.shield_duration_s * 1000).toISOString();
    await supabase.from("teams").update({ shield_until: shieldUntil }).eq("id", teamId);
    return true;
  }

  const { data: team } = await supabase
    .from("teams")
    .select("landmark_bonus_m2, score_m2")
    .eq("id", teamId)
    .maybeSingle();
  await supabase
    .from("teams")
    .update({
      landmark_bonus_m2: (team?.landmark_bonus_m2 ?? 0) + landmark.bonus_m2,
      ...(ctfMode ? { score_m2: (team?.score_m2 ?? 0) + landmark.bonus_m2 } : {}),
    })
    .eq("id", teamId);
  if (!ctfMode) await recomputeScores(landmark.game_id);
  return true;
}

/** Checks every currently-active landmark against a position and claims any within range. */
export async function checkLandmarkClaims(
  landmarks: Landmark[],
  teamId: string,
  point: [number, number],
  startedAt: string | null,
  ctfMode = false,
): Promise<Landmark | null> {
  for (const l of landmarks) {
    if (!isLandmarkActive(l, startedAt, Date.now())) continue;
    if (haversine(point, [l.lat, l.lng]) <= LANDMARK_CLAIM_RADIUS_M) {
      if (await tryClaimLandmark(l, teamId, ctfMode)) return l;
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
