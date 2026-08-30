import { supabase } from "@/integrations/supabase/client";
import { haversine } from "@/lib/conquete";
import type { Game, Team } from "@/lib/useGameState";

/** Records a team's arrival in the return zone; a no-op once already set. */
export async function markReturned(teamId: string) {
  await supabase
    .from("teams")
    .update({ returned_at: new Date().toISOString() })
    .eq("id", teamId)
    .is("returned_at", null);
}

export type GraceStatus = {
  /** Whether this team counts for the final ranking right now. */
  validated: boolean;
  /** Points/cells to dock for a late return (per_second mode only; 0 otherwise). */
  penalty: number;
  /** Seconds left to return, while the window is still open; null once resolved. */
  remainingS: number | null;
};

/**
 * Resolves what a team's end-of-game return counts for, at instant `nowMs`.
 * A pure function of two stored timestamps (`grace_ends_at`, `returned_at`)
 * plus the current clock, so every client — dashboard and every team's own
 * screen — computes the exact same outcome without any server-side sweep
 * once the window elapses.
 */
export function resolveGraceStatus(
  game: Pick<Game, "grace_ends_at" | "grace_penalty_mode" | "grace_penalty_per_second_m2">,
  team: Pick<Team, "returned_at">,
  nowMs: number,
): GraceStatus {
  if (!game.grace_ends_at) return { validated: true, penalty: 0, remainingS: null };
  const deadline = new Date(game.grace_ends_at).getTime();

  if (team.returned_at != null) {
    const arrivedAt = new Date(team.returned_at).getTime();
    if (arrivedAt <= deadline) return { validated: true, penalty: 0, remainingS: null };
    if (game.grace_penalty_mode === "cancel")
      return { validated: false, penalty: 0, remainingS: null };
    const lateS = (arrivedAt - deadline) / 1000;
    return { validated: true, penalty: lateS * game.grace_penalty_per_second_m2, remainingS: null };
  }

  if (nowMs < deadline) {
    return { validated: true, penalty: 0, remainingS: (deadline - nowMs) / 1000 };
  }
  if (game.grace_penalty_mode === "cancel")
    return { validated: false, penalty: 0, remainingS: null };
  const lateS = (nowMs - deadline) / 1000;
  return { validated: true, penalty: lateS * game.grace_penalty_per_second_m2, remainingS: null };
}

/** Checks a live position against the return zone and records arrival, once. */
export function checkGraceArrival(
  game: Pick<Game, "grace_ends_at" | "return_lat" | "return_lng" | "return_radius_m">,
  teamId: string,
  alreadyReturned: boolean,
  point: [number, number],
) {
  if (!game.grace_ends_at || alreadyReturned) return;
  if (game.return_lat == null || game.return_lng == null) return;
  if (haversine(point, [game.return_lat, game.return_lng]) > game.return_radius_m) return;
  void markReturned(teamId);
}
