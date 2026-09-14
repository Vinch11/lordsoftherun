import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Trap = {
  id: string;
  game_id: string;
  placed_by_team_id: string;
  lat: number;
  lng: number;
  penalty_m2: number;
};

/**
 * Places a hidden trap from a claimed "trap" landmark. Server-side (RPC):
 * verifies the caller is on the claiming team and pulls the penalty amount
 * from the landmark itself — the client never gets to pick its own penalty.
 */
export async function placeTrap(landmarkId: string, lat: number, lng: number): Promise<void> {
  const { error } = await supabase.rpc("place_trap", {
    _landmark_id: landmarkId,
    _lat: lat,
    _lng: lng,
  });
  if (error) throw error;
}

/**
 * Checks whether a position just walked over someone else's trap. The
 * distance check happens entirely server-side (RPC) so an unclaimed trap's
 * position is never sent to a team that hasn't triggered it — that's what
 * keeps it hidden. The first team to get within range wins the race; the
 * trap is consumed either way.
 */
export async function checkTrapTrigger(
  teamId: string,
  lat: number,
  lng: number,
): Promise<{ triggered: boolean; penaltyM2: number }> {
  const { data, error } = await supabase
    .rpc("check_trap_trigger", { _team_id: teamId, _lat: lat, _lng: lng })
    .maybeSingle();
  if (error) throw error;
  return { triggered: !!data?.triggered, penaltyM2: data?.penalty_m2 ?? 0 };
}

/** A team's own placed traps (RLS already scopes this to the caller's team + the game owner). */
export function useTraps(gameId: string | null) {
  const [traps, setTraps] = useState<Trap[]>([]);

  const refresh = useCallback(async () => {
    if (!gameId) return;
    const { data } = await supabase.from("traps").select("*").eq("game_id", gameId);
    setTraps((data ?? []) as unknown as Trap[]);
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;
    void refresh();
    const channel = supabase
      .channel(`traps-${gameId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "traps", filter: `game_id=eq.${gameId}` },
        () => void refresh(),
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [gameId, refresh]);

  return { traps, refresh };
}
