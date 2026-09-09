import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SavedQuestion = {
  id: string;
  question: string;
  answer: string;
  created_at: string;
};

/** Adds a question to the teacher's personal library, reusable across games. */
export async function addSavedQuestion(question: string, answer: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const ownerId = auth.user?.id;
  if (!ownerId) throw new Error("no session");
  const { error } = await supabase
    .from("saved_questions")
    .insert({ owner_id: ownerId, question, answer });
  if (error) throw error;
}

export async function deleteSavedQuestion(id: string): Promise<void> {
  const { error } = await supabase.from("saved_questions").delete().eq("id", id);
  if (error) throw error;
}

/** The current teacher's saved questions, newest first. */
export function useSavedQuestions() {
  const [questions, setQuestions] = useState<SavedQuestion[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("saved_questions")
      .select("id, question, answer, created_at")
      .order("created_at", { ascending: false });
    setQuestions((data ?? []) as unknown as SavedQuestion[]);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { questions, loaded, refresh };
}
