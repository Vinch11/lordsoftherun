import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { addLandmark } from "@/lib/landmarks";
import { addForbiddenZone } from "@/lib/forbiddenZones";

export type SavedPoint = {
  id: string;
  owner_id: string;
  kind: "landmark" | "forbidden";
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  value_m2: number;
};

export async function saveSavedPoint(
  ownerId: string,
  kind: "landmark" | "forbidden",
  name: string,
  lat: number,
  lng: number,
  radiusM: number,
  valueM2: number,
) {
  const { error } = await supabase.from("saved_points").insert({
    owner_id: ownerId,
    kind,
    name,
    lat,
    lng,
    radius_m: radiusM,
    value_m2: valueM2,
  });
  if (error) throw error;
}

export async function deleteSavedPoint(id: string) {
  const { error } = await supabase.from("saved_points").delete().eq("id", id);
  if (error) throw error;
}

/** Re-creates a saved point as a live landmark or forbidden zone in `gameId`. */
export async function applySavedPoint(point: SavedPoint, gameId: string) {
  if (point.kind === "landmark") {
    await addLandmark(gameId, point.lat, point.lng, point.value_m2);
  } else {
    await addForbiddenZone(gameId, point.lat, point.lng, point.radius_m, point.value_m2);
  }
}

export function useSavedPoints(ownerId: string | null, kind: "landmark" | "forbidden") {
  const [points, setPoints] = useState<SavedPoint[]>([]);

  const refresh = useCallback(async () => {
    if (!ownerId) return;
    const { data } = await supabase
      .from("saved_points")
      .select("*")
      .eq("owner_id", ownerId)
      .eq("kind", kind)
      .order("name");
    setPoints((data ?? []) as unknown as SavedPoint[]);
  }, [ownerId, kind]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { points, refresh };
}
