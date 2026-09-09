import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TeamTrail = { team_id: string; points: [number, number][] };

/**
 * Appends one point to a team's full-session trail, independent of
 * scoring — territory loops get trimmed/deleted by other teams' captures
 * and grid cells only remember the last owner, so neither can answer
 * "where did this team actually walk?" after the fact. Atomic on the
 * server (SQL append, not a client read-modify-write), so several devices
 * syncing the same team in multi-participant mode never race and drop points.
 */
export async function appendTeamTrailPoint(
  teamId: string,
  lat: number,
  lng: number,
): Promise<void> {
  const { error } = await supabase.rpc("append_team_trail_point", {
    _team_id: teamId,
    _lat: lat,
    _lng: lng,
  });
  if (error) throw error;
}

/** For the teacher dashboard: every team's full-session path, fetched once (post-game review, not live). */
export function useTeamTrails(gameId: string | null) {
  const [trails, setTrails] = useState<TeamTrail[]>([]);

  const refresh = useCallback(async () => {
    if (!gameId) return;
    const { data } = await supabase
      .from("team_trails")
      .select("team_id, points")
      .eq("game_id", gameId);
    setTrails((data ?? []) as unknown as TeamTrail[]);
  }, [gameId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { trails, refresh };
}
