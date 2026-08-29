import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type GameMessage = {
  id: string;
  game_id: string;
  team_id: string | null;
  sender: string;
  body: string;
  created_at: string;
};

/** `team_id` is the recipient: null broadcasts to every team, a team id targets one. */
export async function sendProfMessage(gameId: string, body: string, toTeamId: string | null) {
  const { error } = await supabase
    .from("messages")
    .insert({ game_id: gameId, sender: "prof", team_id: toTeamId, body });
  if (error) throw error;
}

/** `team_id` is the sender here: a team can only message the teacher. */
export async function sendTeamMessage(gameId: string, teamId: string, body: string) {
  const { error } = await supabase
    .from("messages")
    .insert({ game_id: gameId, sender: "team", team_id: teamId, body });
  if (error) throw error;
}

export function useMessages(gameId: string | null) {
  const [messages, setMessages] = useState<GameMessage[]>([]);

  const refresh = useCallback(async () => {
    if (!gameId) return;
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("game_id", gameId)
      .order("created_at");
    setMessages((data ?? []) as unknown as GameMessage[]);
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;
    void refresh();
    const channel = supabase
      .channel(`messages-${gameId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `game_id=eq.${gameId}` },
        (payload) => {
          const row = payload.new as unknown as GameMessage;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        },
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [gameId, refresh]);

  return { messages };
}
