import { area, booleanIntersects, difference, featureCollection, polygon } from "@turf/turf";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import { supabase } from "@/integrations/supabase/client";

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
 */
export async function captureTerritory(gameId: string, teamId: string, captured: Feature<Polygon>) {
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
        await supabase
          .from("territories")
          .update({
            geometry: rest.geometry as unknown as never,
            area_m2: area(rest),
          })
          .eq("id", row.id);
      }
    } catch {
      /* geometries that can't be differenced are left untouched */
    }
  }

  await supabase.from("territories").insert({
    game_id: gameId,
    team_id: teamId,
    geometry: captured.geometry as unknown as never,
    area_m2: area(captured),
  });

  await recomputeScores(gameId);
  return area(captured);
}

export async function recomputeScores(gameId: string) {
  const [{ data: teams }, { data: territories }] = await Promise.all([
    supabase.from("teams").select("id").eq("game_id", gameId),
    supabase.from("territories").select("team_id, area_m2").eq("game_id", gameId),
  ]);
  const totals = new Map<string, number>();
  for (const t of territories ?? []) {
    totals.set(t.team_id, (totals.get(t.team_id) ?? 0) + (t.area_m2 ?? 0));
  }
  await Promise.all(
    (teams ?? []).map((t) =>
      supabase
        .from("teams")
        .update({ score_m2: totals.get(t.id) ?? 0 })
        .eq("id", t.id),
    ),
  );
}
