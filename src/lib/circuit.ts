import { useCallback, useEffect, useState } from "react";
import { along, length, lineString } from "@turf/turf";
import { supabase } from "@/integrations/supabase/client";
import { CIRCUIT_ITEM_KINDS, type CircuitItemKind } from "@/lib/conquete";

export type Checkpoint = {
  id: string;
  game_id: string;
  seq_index: number;
  lat: number;
  lng: number;
};
export type CircuitBox = { id: string; game_id: string; lat: number; lng: number };
export type Banana = {
  id: string;
  game_id: string;
  team_id: string;
  lat: number;
  lng: number;
  created_at: string;
};

/**
 * Resamples a freehand-drawn stroke into `count` evenly spaced points along
 * its length — lets the organizer draw the circuit by hand while the game
 * still gets a clean, evenly paced checkpoint sequence. Point 0 is the
 * start/finish line.
 */
export function resampleToCheckpoints(path: [number, number][], count: number): [number, number][] {
  if (count < 2) return [];
  // Drop consecutive duplicates: a slow finger emits many identical points and
  // turf then reports a zero-length line even though the stroke is fine.
  const clean: [number, number][] = [];
  for (const p of path) {
    const last = clean[clean.length - 1];
    if (!last || Math.abs(last[0] - p[0]) > 1e-9 || Math.abs(last[1] - p[1]) > 1e-9) clean.push(p);
  }
  if (clean.length < 2) return [];
  const line = lineString(clean.map(([lat, lng]) => [lng, lat]));
  const totalKm = length(line, { units: "kilometers" });
  if (totalKm <= 0) return [];
  const points: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const pt = along(line, (totalKm * i) / count, { units: "kilometers" });
    const [lng, lat] = pt.geometry.coordinates as [number, number];
    points.push([lat, lng]);
  }
  return points;
}

export function useCheckpoints(gameId: string | null) {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);

  const refresh = useCallback(async () => {
    if (!gameId) return;
    const { data } = await supabase
      .from("circuit_checkpoints")
      .select("*")
      .eq("game_id", gameId)
      .order("seq_index");
    setCheckpoints((data ?? []) as unknown as Checkpoint[]);
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;
    void refresh();
    const channel = supabase
      .channel(`circuit-checkpoints-${gameId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "circuit_checkpoints",
          filter: `game_id=eq.${gameId}`,
        },
        () => void refresh(),
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [gameId, refresh]);

  return { checkpoints, refresh };
}

/** Replaces the whole checkpoint sequence — redrawing the circuit starts clean. */
export async function setCheckpoints(gameId: string, points: [number, number][]): Promise<void> {
  await supabase.from("circuit_checkpoints").delete().eq("game_id", gameId);
  if (points.length === 0) return;
  const { error } = await supabase
    .from("circuit_checkpoints")
    .insert(points.map(([lat, lng], seq_index) => ({ game_id: gameId, seq_index, lat, lng })));
  if (error) throw error;
}

/** Adds one checkpoint at the end of the sequence (manual, precise placement). */
export async function appendCheckpoint(
  gameId: string,
  lat: number,
  lng: number,
  seqIndex: number,
): Promise<void> {
  const { error } = await supabase
    .from("circuit_checkpoints")
    .insert({ game_id: gameId, seq_index: seqIndex, lat, lng });
  if (error) throw error;
}

/** Deletes one checkpoint and renumbers the remaining ones to stay contiguous. */
export async function deleteCheckpoint(gameId: string, id: string): Promise<void> {
  await supabase.from("circuit_checkpoints").delete().eq("id", id);
  const { data } = await supabase
    .from("circuit_checkpoints")
    .select("id")
    .eq("game_id", gameId)
    .order("seq_index");
  const rows = (data ?? []) as { id: string }[];
  for (let i = 0; i < rows.length; i++) {
    await supabase.from("circuit_checkpoints").update({ seq_index: i }).eq("id", rows[i]!.id);
  }
}

export async function clearCheckpoints(gameId: string): Promise<void> {
  await supabase.from("circuit_checkpoints").delete().eq("game_id", gameId);
}

export function useCircuitBoxes(gameId: string | null) {
  const [boxes, setBoxes] = useState<CircuitBox[]>([]);

  const refresh = useCallback(async () => {
    if (!gameId) return;
    const { data } = await supabase.from("circuit_boxes").select("*").eq("game_id", gameId);
    setBoxes((data ?? []) as unknown as CircuitBox[]);
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;
    void refresh();
    const channel = supabase
      .channel(`circuit-boxes-${gameId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "circuit_boxes", filter: `game_id=eq.${gameId}` },
        () => void refresh(),
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [gameId, refresh]);

  return { boxes, refresh };
}

export async function addCircuitBox(gameId: string, lat: number, lng: number): Promise<void> {
  const { error } = await supabase.from("circuit_boxes").insert({ game_id: gameId, lat, lng });
  if (error) throw error;
}

export async function removeCircuitBox(id: string): Promise<void> {
  await supabase.from("circuit_boxes").delete().eq("id", id);
}

export function useBananas(gameId: string | null) {
  const [bananas, setBananas] = useState<Banana[]>([]);

  const refresh = useCallback(async () => {
    if (!gameId) return;
    const { data } = await supabase.from("circuit_bananas").select("*").eq("game_id", gameId);
    setBananas((data ?? []) as unknown as Banana[]);
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;
    void refresh();
    const channel = supabase
      .channel(`circuit-bananas-${gameId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "circuit_bananas", filter: `game_id=eq.${gameId}` },
        () => void refresh(),
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [gameId, refresh]);

  return { bananas, refresh };
}

export async function dropBanana(
  gameId: string,
  teamId: string,
  lat: number,
  lng: number,
): Promise<void> {
  const { error } = await supabase
    .from("circuit_bananas")
    .insert({ game_id: gameId, team_id: teamId, lat, lng });
  if (error) throw error;
}

/** Removes a triggered banana — single-use. */
export async function removeBanana(id: string): Promise<void> {
  await supabase.from("circuit_bananas").delete().eq("id", id);
}

/**
 * Checks whether `teamId` can trigger `boxId` again (its own cooldown, not
 * shared with other teams), and if so records the pickup. Returns a random
 * item on success, null if still cooling down.
 */
export async function tryTriggerBox(
  boxId: string,
  teamId: string,
  cooldownS: number,
): Promise<CircuitItemKind | null> {
  const { data: last } = await supabase
    .from("circuit_box_pickups")
    .select("picked_at")
    .eq("box_id", boxId)
    .eq("team_id", teamId)
    .order("picked_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last && Date.now() - new Date(last.picked_at).getTime() < cooldownS * 1000) return null;
  const { error } = await supabase
    .from("circuit_box_pickups")
    .insert({ box_id: boxId, team_id: teamId });
  if (error) return null;
  return CIRCUIT_ITEM_KINDS[Math.floor(Math.random() * CIRCUIT_ITEM_KINDS.length)]!;
}

export async function advanceCircuitProgress(
  teamId: string,
  nextCheckpoint: number,
  lap: number,
  finished: boolean,
): Promise<void> {
  await supabase
    .from("teams")
    .update({
      circuit_next_checkpoint: nextCheckpoint,
      circuit_lap: lap,
      ...(finished ? { circuit_finished_at: new Date().toISOString() } : {}),
    })
    .eq("id", teamId);
}

export async function applyCircuitTimeAdjustment(teamId: string, newTotal: number): Promise<void> {
  await supabase.from("teams").update({ circuit_time_adjustment_s: newTotal }).eq("id", teamId);
}

export async function setCircuitHeldItem(
  teamId: string,
  item: CircuitItemKind | null,
): Promise<void> {
  await supabase.from("teams").update({ circuit_held_item: item }).eq("id", teamId);
}

export async function setCircuitShielded(teamId: string, shielded: boolean): Promise<void> {
  await supabase.from("teams").update({ circuit_shielded: shielded }).eq("id", teamId);
}

/** Elapsed race time in seconds (adjustments included), or null while still racing. */
export function circuitFinishTimeS(
  team: { circuit_finished_at: string | null; circuit_time_adjustment_s: number },
  startedAt: string | null,
): number | null {
  if (!team.circuit_finished_at || !startedAt) return null;
  const raw = (new Date(team.circuit_finished_at).getTime() - new Date(startedAt).getTime()) / 1000;
  return Math.max(0, raw + team.circuit_time_adjustment_s);
}

/**
 * One sortable number for both finished and still-racing teams: finished
 * teams always outrank racing ones, fastest time first; racing teams rank
 * by lap+checkpoint progress. Decode with `circuitFormatRank` for display.
 */
const CIRCUIT_FINISHED_RANK_OFFSET = 1_000_000;

export function circuitRankMetric(
  team: {
    circuit_finished_at: string | null;
    circuit_time_adjustment_s: number;
    circuit_lap: number;
    circuit_next_checkpoint: number;
  },
  startedAt: string | null,
): number {
  const finishS = circuitFinishTimeS(team, startedAt);
  if (finishS != null) return CIRCUIT_FINISHED_RANK_OFFSET - finishS;
  return team.circuit_lap * 1000 + team.circuit_next_checkpoint;
}

export function circuitFormatRank(lapCount: number) {
  return (metric: number): string => {
    if (metric > 500_000) {
      const timeS = CIRCUIT_FINISHED_RANK_OFFSET - metric;
      const m = Math.floor(timeS / 60);
      const s = Math.floor(timeS % 60);
      return `🏁 ${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
    const lap = Math.floor(metric / 1000);
    return `Tour ${Math.min(lap + 1, lapCount)}/${lapCount}`;
  };
}
