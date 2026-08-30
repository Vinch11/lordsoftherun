import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CaptureConsequence } from "@/lib/conquete";
import { CTF_CAPTURE_POINTS } from "@/lib/conquete";

export type FlagStatus = "home" | "carried" | "dropped" | "awaiting_placement";

export type Flag = {
  id: string;
  game_id: string;
  team_id: string;
  lat: number;
  lng: number;
  status: FlagStatus;
  carried_by_team_id: string | null;
};

/** Places (or re-places) a team's flag at its home base. */
export async function placeFlag(gameId: string, teamId: string, lat: number, lng: number) {
  const { error } = await supabase
    .from("flags")
    .upsert(
      { game_id: gameId, team_id: teamId, lat, lng, status: "home", carried_by_team_id: null },
      { onConflict: "game_id,team_id" },
    );
  if (error) throw error;
}

/**
 * Tries to interact with a flag at close range: recovers your own dropped
 * flag straight home, or picks up an enemy flag (home or dropped) to carry
 * it. Returns true if the interaction succeeded.
 */
export async function tryPickupFlag(flag: Flag, myTeamId: string): Promise<boolean> {
  if (flag.team_id === myTeamId) {
    if (flag.status !== "dropped") return false;
    const { data, error } = await supabase
      .from("flags")
      .update({ status: "home", carried_by_team_id: null })
      .eq("id", flag.id)
      .eq("status", "dropped")
      .select()
      .maybeSingle();
    return !error && !!data;
  }
  if (flag.status !== "home" && flag.status !== "dropped") return false;
  const { data, error } = await supabase
    .from("flags")
    .update({ status: "carried", carried_by_team_id: myTeamId })
    .eq("id", flag.id)
    .in("status", ["home", "dropped"])
    .select()
    .maybeSingle();
  return !error && !!data;
}

/** Delivers a carried enemy flag to the drop zone: scores a capture and sends it home. */
export async function deliverFlag(flag: Flag, myTeamId: string): Promise<boolean> {
  const { data: delivered, error } = await supabase
    .from("flags")
    .update({ status: "home", carried_by_team_id: null })
    .eq("id", flag.id)
    .eq("carried_by_team_id", myTeamId)
    .select()
    .maybeSingle();
  if (error || !delivered) return false;

  const { data: team } = await supabase
    .from("teams")
    .select("score_m2, flags_captured")
    .eq("id", myTeamId)
    .maybeSingle();
  await supabase
    .from("teams")
    .update({
      score_m2: (team?.score_m2 ?? 0) + CTF_CAPTURE_POINTS,
      flags_captured: (team?.flags_captured ?? 0) + 1,
    })
    .eq("id", myTeamId);
  return true;
}

/**
 * Applies the organizer-configured consequence when a flag carrier gets
 * tagged. Every update is conditioned on the flag still being carried by the
 * same team, so repeated calls for the same tag event (e.g. several GPS
 * ticks firing before realtime confirms the flag was already reset) only
 * ever take effect once — the second call finds no matching row and no-ops,
 * instead of double-applying a score penalty.
 */
export async function applyCapture(
  flag: Flag,
  consequence: CaptureConsequence,
  penaltyM2: number,
  dropPoint: [number, number],
): Promise<boolean> {
  const carrierTeamId = flag.carried_by_team_id;
  if (!carrierTeamId) return false;

  if (consequence === "flag_dropped") {
    const { data } = await supabase
      .from("flags")
      .update({
        status: "dropped",
        lat: dropPoint[0],
        lng: dropPoint[1],
        carried_by_team_id: null,
      })
      .eq("id", flag.id)
      .eq("carried_by_team_id", carrierTeamId)
      .select()
      .maybeSingle();
    return !!data;
  }
  if (consequence === "organizer_replaces") {
    const { data } = await supabase
      .from("flags")
      .update({ status: "awaiting_placement", carried_by_team_id: null })
      .eq("id", flag.id)
      .eq("carried_by_team_id", carrierTeamId)
      .select()
      .maybeSingle();
    return !!data;
  }

  // time_penalty and return_to_base both send the flag straight back home;
  // time_penalty additionally docks the carrying team some points.
  const { data } = await supabase
    .from("flags")
    .update({ status: "home", carried_by_team_id: null })
    .eq("id", flag.id)
    .eq("carried_by_team_id", carrierTeamId)
    .select()
    .maybeSingle();
  if (!data) return false;
  if (consequence === "time_penalty") {
    const { data: team } = await supabase
      .from("teams")
      .select("score_m2, penalty_m2")
      .eq("id", carrierTeamId)
      .maybeSingle();
    await supabase
      .from("teams")
      .update({
        score_m2: Math.max(0, (team?.score_m2 ?? 0) - penaltyM2),
        penalty_m2: (team?.penalty_m2 ?? 0) + penaltyM2,
      })
      .eq("id", carrierTeamId);
  }
  return true;
}

export function useFlags(gameId: string | null) {
  const [flags, setFlags] = useState<Flag[]>([]);

  const refresh = useCallback(async () => {
    if (!gameId) return;
    const { data } = await supabase.from("flags").select("*").eq("game_id", gameId);
    setFlags((data ?? []) as unknown as Flag[]);
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;
    void refresh();
    const channel = supabase
      .channel(`flags-${gameId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "flags", filter: `game_id=eq.${gameId}` },
        () => void refresh(),
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [gameId, refresh]);

  return { flags, refresh };
}
