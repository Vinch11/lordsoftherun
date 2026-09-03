import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { haversine } from "@/lib/conquete";
import { cellCenter, pointToCell } from "@/lib/grid";

export type GridBonus = {
  id: string;
  game_id: string;
  lat: number;
  lng: number;
  radius_m: number;
  expires_at: string;
  claimed_by_team_id: string | null;
  claimed_at: string | null;
  created_at: string;
};

/** A bonus is live once claimed by nobody and while its lifetime hasn't run out. */
export function isGridBonusActive(bonus: GridBonus, nowMs: number): boolean {
  return bonus.claimed_by_team_id == null && new Date(bonus.expires_at).getTime() > nowMs;
}

export async function addGridBonus(
  gameId: string,
  lat: number,
  lng: number,
  radiusM: number,
  lifetimeS: number,
): Promise<void> {
  const { error } = await supabase.from("grid_bonuses").insert({
    game_id: gameId,
    lat,
    lng,
    radius_m: radiusM,
    expires_at: new Date(Date.now() + lifetimeS * 1000).toISOString(),
  });
  if (error) throw error;
}

export async function removeGridBonus(id: string): Promise<void> {
  const { error } = await supabase.from("grid_bonuses").delete().eq("id", id);
  if (error) throw error;
}

/** Every grid cell whose center falls within `radiusM` of `center`. */
function cellsWithinRadius(
  gridCenter: [number, number],
  cellSizeM: number,
  center: [number, number],
  radiusM: number,
): { row: number; col: number }[] {
  const { row: originRow, col: originCol } = pointToCell(gridCenter, cellSizeM, center);
  const span = Math.ceil(radiusM / cellSizeM) + 1;
  const cells: { row: number; col: number }[] = [];
  for (let dr = -span; dr <= span; dr++) {
    for (let dc = -span; dc <= span; dc++) {
      const row = originRow + dr;
      const col = originCol + dc;
      if (haversine(cellCenter(gridCenter, cellSizeM, row, col), center) <= radiusM) {
        cells.push({ row, col });
      }
    }
  }
  return cells;
}

/**
 * Tries to be the first team to explode a bonus; on success, colors every
 * grid cell within its radius for that team in one batched upsert. Returns
 * the number of cells claimed, or null if it already expired or another
 * team's device won the same race (first update with claimed_by_team_id
 * still null wins — same atomic-claim pattern as landmarks).
 */
export async function tryClaimGridBonus(
  bonus: GridBonus,
  teamId: string,
  gridCenter: [number, number],
  cellSizeM: number,
): Promise<number | null> {
  if (new Date(bonus.expires_at).getTime() <= Date.now()) return null;
  const { data, error } = await supabase
    .from("grid_bonuses")
    .update({ claimed_by_team_id: teamId, claimed_at: new Date().toISOString() })
    .eq("id", bonus.id)
    .is("claimed_by_team_id", null)
    .select()
    .maybeSingle();
  if (error || !data) return null;

  const cells = cellsWithinRadius(gridCenter, cellSizeM, [bonus.lat, bonus.lng], bonus.radius_m);
  if (cells.length === 0) return 0;
  const { error: upsertError } = await supabase.from("grid_cells").upsert(
    cells.map((c) => ({
      game_id: bonus.game_id,
      row: c.row,
      col: c.col,
      owner_team_id: teamId,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "game_id,row,col" },
  );
  if (upsertError) throw upsertError;
  return cells.length;
}

/** Checks every currently-active bonus against a position and explodes the first in range. */
export async function checkGridBonusClaims(
  bonuses: GridBonus[],
  teamId: string,
  point: [number, number],
  claimRadiusM: number,
  gridCenter: [number, number],
  cellSizeM: number,
): Promise<{ bonus: GridBonus; cellsClaimed: number } | null> {
  for (const b of bonuses) {
    if (!isGridBonusActive(b, Date.now())) continue;
    if (haversine(point, [b.lat, b.lng]) <= claimRadiusM) {
      const cellsClaimed = await tryClaimGridBonus(b, teamId, gridCenter, cellSizeM);
      if (cellsClaimed != null) return { bonus: b, cellsClaimed };
    }
  }
  return null;
}

export function useGridBonuses(gameId: string | null) {
  const [bonuses, setBonuses] = useState<GridBonus[]>([]);

  const refresh = useCallback(async () => {
    if (!gameId) return;
    const { data } = await supabase.from("grid_bonuses").select("*").eq("game_id", gameId);
    setBonuses((data ?? []) as unknown as GridBonus[]);
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;
    void refresh();
    const channel = supabase
      .channel(`grid-bonuses-${gameId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "grid_bonuses", filter: `game_id=eq.${gameId}` },
        () => void refresh(),
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [gameId, refresh]);

  return { bonuses, refresh };
}
