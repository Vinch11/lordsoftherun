import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type QuizAnswer = {
  id: string;
  team_id: string;
  answer: string;
  correct: boolean;
  round_sent_at: string;
  answered_at: string;
};

/** Sends a new question to every team, replacing any question already in progress. */
export async function sendQuizQuestion(
  gameId: string,
  question: string,
  answer: string,
  bonus: number,
): Promise<void> {
  const { error } = await supabase.rpc("send_quiz_question", {
    _game_id: gameId,
    _question: question,
    _answer: answer,
    _bonus: bonus,
  });
  if (error) throw error;
}

/** Ends the current question early — no more answers are accepted for it. */
export async function closeQuizQuestion(gameId: string): Promise<void> {
  const { error } = await supabase.rpc("close_quiz_question", { _game_id: gameId });
  if (error) throw error;
}

/**
 * Submits this team's answer. The correct answer is checked server-side and
 * never sent to the client — this only ever learns whether it was right.
 */
export async function submitQuizAnswer(teamId: string, answer: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("submit_quiz_answer", {
    _team_id: teamId,
    _answer: answer,
  });
  if (error) throw error;
  return data ?? false;
}

/** For the teacher dashboard: who has answered the current question, and whether they got it right. */
export function useQuizAnswers(gameId: string | null) {
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);

  const refresh = useCallback(async () => {
    if (!gameId) return;
    const { data } = await supabase
      .from("quiz_answers")
      .select("id, team_id, answer, correct, round_sent_at, answered_at")
      .eq("game_id", gameId)
      .order("answered_at");
    setAnswers((data ?? []) as unknown as QuizAnswer[]);
  }, [gameId]);

  useEffect(() => {
    if (!gameId) return;
    void refresh();
    const channel = supabase
      .channel(`quiz-answers-${gameId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quiz_answers", filter: `game_id=eq.${gameId}` },
        () => void refresh(),
      )
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [gameId, refresh]);

  return answers;
}
