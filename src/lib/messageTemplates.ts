import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type MessageTemplate = { id: string; owner_id: string; body: string };

/** Saves a message body as a reusable template, private to this teacher's account. */
export async function saveMessageTemplate(ownerId: string, body: string) {
  const { error } = await supabase.from("message_templates").insert({ owner_id: ownerId, body });
  if (error) throw error;
}

export async function deleteMessageTemplate(id: string) {
  const { error } = await supabase.from("message_templates").delete().eq("id", id);
  if (error) throw error;
}

export function useMessageTemplates(ownerId: string | null) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);

  const refresh = useCallback(async () => {
    if (!ownerId) return;
    const { data } = await supabase
      .from("message_templates")
      .select("*")
      .eq("owner_id", ownerId)
      .order("created_at");
    setTemplates((data ?? []) as unknown as MessageTemplate[]);
  }, [ownerId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { templates, refresh };
}
