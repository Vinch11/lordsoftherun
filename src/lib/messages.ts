import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type GameMessage = {
  id: string;
  game_id: string;
  from_role: "prof" | "team";
  from_team_id: string | null;
  to_team_id: string | null;
  body: string;
  created_at: string;
};

export async function sendProfMessage(gameId: string, body: string, toTeamId: string | null) {
  const { error } = await supabase
    .from("messages")
    .insert({ game_id: gameId, from_role: "prof", to_team_id: toTeamId, body });
  if (error) throw error;
}

export async function sendTeamMessage(gameId: string, teamId: string, body: string) {
  const { error } = await supabase
    .from("messages")
    .insert({ game_id: gameId, from_role: "team", from_team_id: teamId, body });
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
