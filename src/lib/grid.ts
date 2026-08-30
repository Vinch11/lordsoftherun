import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type GridCell = {
  id: string;
  game_id: string;
  row: number;
  col: number;
  owner_team_id: string;
  updated_at: string;
};

const METERS_PER_DEG_LAT = 111320;

function metersPerDegLng(lat: number): number {
  return METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

/** Row/col of the grid cell (relative to `center`) that contains `point`. */
export function pointToCell(
  center: [number, number],
  cellSizeM: number,
  point: [number, number],
): { row: number; col: number } {
  const dy = (point[0] - center[0]) * METERS_PER_DEG_LAT;
  const dx = (point[1] - center[1]) * metersPerDegLng(center[0]);
  return { row: Math.floor(dy / cellSizeM), col: Math.floor(dx / cellSizeM) };
}

/** Center lat/lng of a grid cell, for rendering. */
export function cellCenter(
  center: [number, number],
  cellSizeM: number,
  row: number,
  col: number,
): [number, number] {
  const dy = (row + 0.5) * cellSizeM;
  const dx = (col + 0.5) * cellSizeM;
  return [center[0] + dy / METERS_PER_DEG_LAT, center[1] + dx / metersPerDegLng(center[0])];
}

/** Small lat/lng bounding box around a cell's own center point, for rendering it as a square. */
export function cellBounds(
  centerLat: number,
  centerLng: number,
  sizeM: number,
): [[number, number], [number, number]] {
  const dLat = sizeM / 2 / METERS_PER_DEG_LAT;
  const dLng = sizeM / 2 / metersPerDegLng(centerLat);
  return [
    [centerLat - dLat, centerLng - dLng],
    [centerLat + dLat, centerLng + dLng],
  ];
}

/** Colors a cell for `teamId`: the last team through always wins, no claim guard needed. */
export async function claimGridCell(gameId: string, teamId: string, row: number, col: number) {
  const { error } = await supabase
    .from("grid_cells")
    .upsert(
      { game_id: gameId, row, col, owner_team_id: teamId, updated_at: new Date().toISOString() },
      { onConflict: "game_id,row,col" },
    );
  if (error) throw error;
}

export function useGridCells(gameId: string | null) {
  const [cells, setCells] = useState<GridCell[]>([]);

  const refresh = useCallback(async () => {
    if (!gameId) return;
    const { data } = await supabase.from("grid_cells").select("*").eq("game_id", gameId);
    setCells((data ?? []) as unknown as GridCell[]);
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;
    void refresh();
    const channel = supabase
      .channel(`grid-cells-${gameId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "grid_cells", filter: `game_id=eq.${gameId}` },
        () => void refresh(),
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [gameId, refresh]);

  return { cells, refresh };
}
