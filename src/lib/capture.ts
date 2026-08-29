import { area, booleanIntersects, difference, featureCollection, polygon } from "@turf/turf";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import { supabase } from "@/integrations/supabase/client";
import { RUNNING_BONUS_MULTIPLIER, RUNNING_SPEED_MS } from "@/lib/conquete";

/** Build a closed GeoJSON polygon from a list of [lat, lng] track points. */
export function polygonFromTrack(track: [number, number][]): Feature<Polygon> | null {
  if (track.length < 4) return null;
  const ring = track.map(([lat, lng]) => [lng, lat] as [number, number]);
  const first = ring[0]!;
  const last = ring[ring.length - 1]!;
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]]);
  if (ring.length < 4) return null;
  try {
    const poly = polygon([ring]);
    return area(poly) > 50 ? poly : null;
  } catch {
    return null;
  }
}

/**
 * Registers a new territory for a team: the captured surface is subtracted from
 * every existing territory (last one to enclose it wins), then scores are recomputed.
 * `avgSpeedMs` is the average speed (m/s) at which the loop was run; closing it at
 * running pace earns a score bonus on top of the real captured area.
 */
export async function captureTerritory(
  gameId: string,
  teamId: string,
  captured: Feature<Polygon>,
  avgSpeedMs = 0,
) {
  const { data: existing } = await supabase.from("territories").select("*").eq("game_id", gameId);

  for (const row of existing ?? []) {
    const geom = row.geometry as unknown as Polygon | MultiPolygon;
    // Only touch territories the new loop actually overlaps: an untouched row keeps
    // its full existing area instead of being reduced to what it geometrically shares
    // with the capture (rule: a team only ever takes the overlapping portion it passes
    // through, never the rest of another team's territory).
    if (!booleanIntersects(geom, captured.geometry)) continue;
    try {
      const rest = difference(
        featureCollection([
          { type: "Feature", properties: {}, geometry: geom } as Feature<Polygon | MultiPolygon>,
          captured as Feature<Polygon | MultiPolygon>,
        ]),
      );
      if (!rest || area(rest) < 20) {
        await supabase.from("territories").delete().eq("id", row.id);
      } else {
        const restArea = area(rest);
        // Keep this row's existing score-per-area ratio (its own running bonus, if any).
        const ratio = row.area_m2 > 0 ? row.scored_m2 / row.area_m2 : 1;
        await supabase
          .from("territories")
          .update({
            geometry: rest.geometry as unknown as never,
            area_m2: restArea,
            scored_m2: restArea * ratio,
          })
          .eq("id", row.id);
      }
    } catch {
      /* geometries that can't be differenced are left untouched */
    }
  }

  const capturedArea = area(captured);
  const multiplier = avgSpeedMs >= RUNNING_SPEED_MS ? RUNNING_BONUS_MULTIPLIER : 1;
  await supabase.from("territories").insert({
    game_id: gameId,
    team_id: teamId,
    geometry: captured.geometry as unknown as never,
    area_m2: capturedArea,
    scored_m2: capturedArea * multiplier,
  });

  await recomputeScores(gameId);
  return { area: capturedArea, ran: multiplier > 1 };
}

export async function recomputeScores(gameId: string) {
  const [{ data: teams }, { data: territories }] = await Promise.all([
    supabase.from("teams").select("id, landmark_bonus_m2").eq("game_id", gameId),
    supabase.from("territories").select("team_id, scored_m2").eq("game_id", gameId),
  ]);
  const totals = new Map<string, number>();
  for (const t of territories ?? []) {
    totals.set(t.team_id, (totals.get(t.team_id) ?? 0) + (t.scored_m2 ?? 0));
  }
  await Promise.all(
    (teams ?? []).map((t) =>
      supabase
        .from("teams")
        .update({ score_m2: (totals.get(t.id) ?? 0) + (t.landmark_bonus_m2 ?? 0) })
        .eq("id", t.id),
    ),
  );
}
