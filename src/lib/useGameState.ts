import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CaptureConsequence, GameMode } from "@/lib/conquete";

export type Game = {
  id: string;
  code: string;
  status: string;
  duration_minutes: number;
  started_at: string | null;
  ends_at: string | null;
  owner_id: string | null;
  return_lat: number | null;
  return_lng: number | null;
  return_radius_m: number;
  photo_requested_at: string | null;
  photo_deadline: string | null;
  map_style: string | null;
  running_bonus_enabled: boolean;
  running_bonus_speed_kmh: number;
  forbidden_zone_running_only: boolean;
  mode: GameMode;
  ctf_capture_consequence: CaptureConsequence;
  ctf_time_penalty_m2: number;
  ctf_capture_radius_m: number;
  grid_center_lat: number | null;
  grid_center_lng: number | null;
  grid_radius_m: number;
  grid_cell_size_m: number;
};

export type Team = {
  id: string;
  game_id: string;
  name: string;
  color: string;
  lat: number | null;
  lng: number | null;
  score_m2: number;
  total_captured_m2: number;
  landmark_bonus_m2: number;
  penalty_m2: number;
  validated: boolean;
  flags_captured: number;
  shield_until: string | null;
};

export type Territory = {
  id: string;
  game_id: string;
  team_id: string;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  area_m2: number;
  scored_m2: number;
};

export function useGameState(gameId: string | null) {
  const [game, setGame] = useState<Game | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!gameId) return;
    const [g, t, terr] = await Promise.all([
      supabase.from("games").select("*").eq("id", gameId).maybeSingle(),
      supabase.from("teams").select("*").eq("game_id", gameId).order("created_at"),
      supabase.from("territories").select("*").eq("game_id", gameId),
    ]);
    if (g.data) setGame(g.data as unknown as Game);
    setTeams((t.data ?? []) as unknown as Team[]);
    setTerritories((terr.data ?? []) as unknown as Territory[]);
    setLoading(false);
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;
    void refresh();
    const channel = supabase
      .channel(`game-${gameId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams", filter: `game_id=eq.${gameId}` },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "territories",
          filter: `game_id=eq.${gameId}`,
        },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        () => void refresh(),
      )
      .subscribe();

    const poll = setInterval(() => void refresh(), 8000);

    return () => {
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [gameId, refresh]);

  return { game, teams, territories, loading, refresh };
}
