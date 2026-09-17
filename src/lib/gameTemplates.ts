import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { Game } from "@/lib/useGameState";

export type GameTemplate = {
  id: string;
  owner_id: string;
  name: string;
  settings: Record<string, unknown>;
  created_at: string;
};

/**
 * Fields a template must never carry: identity (id/code/owner/name),
 * live/runtime state (status, timers, the currently-sent quiz question),
 * and anything tied to a specific real-world spot (the return zone and
 * grid center are drawn on a map, not typed in). Everything else on
 * `games` is a portable setting, so this list only needs to grow when a
 * *new* identity/runtime/location field is added — a new plain setting
 * column is templated automatically with no change needed here.
 */
const EXCLUDED_FIELDS = [
  "id",
  "code",
  "name",
  "status",
  "created_at",
  "started_at",
  "ends_at",
  "owner_id",
  "return_lat",
  "return_lng",
  "photo_requested_at",
  "photo_deadline",
  "quiz_question",
  "quiz_sent_at",
  "grace_ends_at",
  "grid_center_lat",
  "grid_center_lng",
] as const;

export async function saveGameTemplate(ownerId: string, name: string, game: Game): Promise<void> {
  const settings: Record<string, unknown> = { ...game };
  for (const field of EXCLUDED_FIELDS) delete settings[field];
  const { error } = await supabase
    .from("game_templates")
    .insert({ owner_id: ownerId, name, settings: settings as unknown as Json });
  if (error) throw error;
}

export async function deleteGameTemplate(id: string): Promise<void> {
  const { error } = await supabase.from("game_templates").delete().eq("id", id);
  if (error) throw error;
}

/** Overwrites `gameId`'s configuration with a saved template's settings. */
export async function applyGameTemplate(gameId: string, template: GameTemplate): Promise<void> {
  const { error } = await supabase
    .from("games")
    .update(template.settings as unknown as never)
    .eq("id", gameId);
  if (error) throw error;
}

export function useGameTemplates(ownerId: string | null) {
  const [templates, setTemplates] = useState<GameTemplate[]>([]);

  const refresh = useCallback(async () => {
    if (!ownerId) return;
    const { data } = await supabase
      .from("game_templates")
      .select("*")
      .eq("owner_id", ownerId)
      .order("name");
    setTemplates((data ?? []) as unknown as GameTemplate[]);
  }, [ownerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { templates, refresh };
}
