import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { HelpCircle } from "lucide-react";
import { submitQuizAnswer } from "@/lib/quiz";
import { notifyUrgent } from "@/lib/notify";

type Props = {
  teamId: string;
  question: string | null | undefined;
  bonus: number | null | undefined;
  /** `games.quiz_sent_at` — a new value means a brand-new question. */
  sentAt: string | null | undefined;
  /** Territoire needs to also refresh score_m2 right away; Grille doesn't. */
  onCorrect?: () => void;
};

/**
 * The teacher's live bonus question, shown identically in Territoire and
 * Grille. One component so a new mode can never silently lose the feature —
 * same pattern as PhotoRequestCard.
 */
export function QuizCard({ teamId, question, bonus, sentAt, onCorrect }: Props) {
  const [answer, setAnswer] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);
  const alertedRef = useRef<string | null>(null);

  const storageKey = sentAt ? `conquete:quiz:${teamId}:${sentAt}` : null;

  useEffect(() => {
    setAnswer("");
    if (!storageKey) {
      setResult(null);
      return;
    }
    const stored = localStorage.getItem(storageKey);
    setResult(stored === "correct" || stored === "wrong" ? stored : null);
  }, [storageKey]);

  // Loud alert the moment a question arrives (once per question).
  useEffect(() => {
    if (!sentAt || alertedRef.current === sentAt) return;
    const first = alertedRef.current === null;
    alertedRef.current = sentAt;
    if (first && storageKey && localStorage.getItem(storageKey)) return;
    toast("❓ Nouvelle question bonus !", { duration: 8000 });
    notifyUrgent("❓ Question bonus !", "Une nouvelle question vient d'arriver.", "message");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sentAt]);

  if (!question) return null;

  async function submit() {
    if (!storageKey || !answer.trim()) return;
    setSending(true);
    try {
      const correct = await submitQuizAnswer(teamId, answer.trim());
      localStorage.setItem(storageKey, correct ? "correct" : "wrong");
      setResult(correct ? "correct" : "wrong");
      if (correct) {
        toast.success(`Bonne réponse ! +${bonus ?? 0}`);
        onCorrect?.();
      } else {
        toast.error("Mauvaise réponse.");
      }
    } catch (e) {
      toast.error(`Envoi impossible : ${e instanceof Error ? e.message : "réessayez"}`);
    } finally {
      setSending(false);
    }
  }

  if (result) {
    return (
      <div className="panel flex items-center gap-2 px-4 py-3">
        <HelpCircle className="h-4 w-4 shrink-0 text-accent" />
        <span className="text-sm font-semibold">
          {result === "correct"
            ? `Bonne réponse ! +${bonus ?? 0} points`
            : "Mauvaise réponse — dommage !"}
        </span>
      </div>
    );
  }

  return (
    <div className="panel flex flex-col gap-3 px-4 py-3 ring-2 ring-accent">
      <div className="section-title">
        <HelpCircle className="h-4 w-4" /> Question bonus
      </div>
      <p className="text-sm font-semibold">{question}</p>
      <p className="text-xs text-muted-foreground">Bonne réponse : +{bonus ?? 0} points</p>
      <input
        className="field"
        placeholder="Votre réponse"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void submit()}
      />
      <button
        className="btn-huge btn-huge-accent"
        disabled={sending || !answer.trim()}
        onClick={() => void submit()}
      >
        {sending ? "Envoi..." : "Valider"}
      </button>
    </div>
  );
}
