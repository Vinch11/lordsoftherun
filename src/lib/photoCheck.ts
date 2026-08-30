import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PhotoSubmission = {
  id: string;
  game_id: string;
  team_id: string;
  storage_path: string;
  submitted_at: string;
};

const BUCKET = "team-photos";

/** Marks a new photo check-in: every team should send a picture within `delayMinutes`. */
export async function requestPhotoCheck(gameId: string, delayMinutes: number) {
  const now = new Date();
  const deadline = new Date(now.getTime() + delayMinutes * 60_000);
  const { error } = await supabase
    .from("games")
    .update({ photo_requested_at: now.toISOString(), photo_deadline: deadline.toISOString() })
    .eq("id", gameId);
  if (error) throw error;
}

/** Uploads a team's photo and records the submission. Returns the storage path. */
export async function uploadTeamPhoto(gameId: string, teamId: string, file: File) {
  const ext = file.type === "image/png" ? "png" : "jpg";
  const path = `${gameId}/${teamId}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "image/jpeg",
  });
  if (uploadError) throw uploadError;
  const { error: insertError } = await supabase
    .from("photo_submissions")
    .insert({ game_id: gameId, team_id: teamId, storage_path: path });
  if (insertError) throw insertError;
  return path;
}

export async function getPhotoUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error || !data) return null;
  return data.signedUrl;
}

/** For the teacher dashboard: live list of photos submitted for the current game. */
export function usePhotoSubmissions(gameId: string | null) {
  const [submissions, setSubmissions] = useState<PhotoSubmission[]>([]);

  const refresh = useCallback(async () => {
    if (!gameId) return;
    const { data } = await supabase
      .from("photo_submissions")
      .select("*")
      .eq("game_id", gameId)
      .order("submitted_at");
    setSubmissions((data ?? []) as unknown as PhotoSubmission[]);
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;
    void refresh();
    const channel = supabase
      .channel(`photos-${gameId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "photo_submissions",
          filter: `game_id=eq.${gameId}`,
        },
        () => void refresh(),
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [gameId, refresh]);

  return { submissions };
}
