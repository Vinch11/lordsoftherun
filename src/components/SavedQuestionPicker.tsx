import { useState } from "react";
import { toast } from "sonner";
import { Bookmark, X } from "lucide-react";
import { addSavedQuestion, deleteSavedQuestion, useSavedQuestions } from "@/lib/savedQuestions";

type Props = {
  question: string;
  answer: string;
  onPick: (question: string, answer: string) => void;
};

/**
 * Save the current question/answer to a personal library, or pick one back
 * out of it — shared between the live quiz bonus and the grid bonus's
 * question gate so a teacher builds one reusable bank instead of two.
 */
export function SavedQuestionPicker({ question, answer, onPick }: Props) {
  const { questions, refresh } = useSavedQuestions();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!question.trim() || !answer.trim()) return;
    setSaving(true);
    try {
      await addSavedQuestion(question.trim(), answer.trim());
      await refresh();
      toast.success("Question enregistrée dans la bibliothèque.");
    } catch {
      toast.error("Échec de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await deleteSavedQuestion(id);
      await refresh();
    } catch {
      toast.error("Échec de la suppression.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="mini-btn flex items-center gap-1"
          onClick={() => setOpen((o) => !o)}
        >
          <Bookmark className="h-3.5 w-3.5" />
          Bibliothèque{questions.length > 0 ? ` (${questions.length})` : ""}
        </button>
        <button
          type="button"
          className="mini-btn flex items-center gap-1"
          disabled={saving || !question.trim() || !answer.trim()}
          onClick={() => void save()}
        >
          <Bookmark className="h-3.5 w-3.5" />
          {saving ? "Enregistrement..." : "Enregistrer cette question"}
        </button>
      </div>
      {open && (
        <div className="flex flex-col gap-1 rounded-xl border border-border p-2">
          {questions.length === 0 && (
            <p className="px-1 py-1 text-xs text-muted-foreground">Aucune question enregistrée.</p>
          )}
          {questions.map((q) => (
            <div key={q.id} className="flex items-center gap-2">
              <button
                type="button"
                className="min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-left text-sm hover:bg-secondary"
                onClick={() => {
                  onPick(q.question, q.answer);
                  setOpen(false);
                }}
                title={`Réponse : ${q.answer}`}
              >
                {q.question}
              </button>
              <button
                type="button"
                aria-label="Supprimer cette question"
                className="icon-btn h-7 w-7 shrink-0"
                onClick={() => void remove(q.id)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
