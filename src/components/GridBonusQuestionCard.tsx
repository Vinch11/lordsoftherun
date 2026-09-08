import { useState } from "react";
import { toast } from "sonner";
import { Flame } from "lucide-react";
import { answerGridBonus, type GridBonus } from "@/lib/gridBonus";

type Props = {
  bonus: GridBonus | null;
  teamId: string;
  gridCenter: [number, number] | null;
  cellSizeM: number;
  onResolved: () => void;
};

/**
 * A manually-placed bonus the teacher gated behind a question: shown while
 * the team is in range and the bonus is still unclaimed. A correct answer
 * explodes it; a wrong one makes it disappear — see `answerGridBonus`.
 */
export function GridBonusQuestionCard({ bonus, teamId, gridCenter, cellSizeM, onResolved }: Props) {
  const [answer, setAnswer] = useState("");
  const [sending, setSending] = useState(false);

  if (!bonus || !bonus.question || !gridCenter) return null;

  async function submit() {
    if (!answer.trim() || !gridCenter || !bonus) return;
    setSending(true);
    try {
      const { correct, cellsClaimed } = await answerGridBonus(
        bonus,
        teamId,
        answer.trim(),
        gridCenter,
        cellSizeM,
      );
      if (correct) {
        toast.success(`💥 Bonus activé ! +${cellsClaimed} case${cellsClaimed > 1 ? "s" : ""}`);
      } else {
        toast.error("Mauvaise réponse — le bonus a disparu.");
      }
      setAnswer("");
      onResolved();
    } catch (e) {
      toast.error(`Envoi impossible : ${e instanceof Error ? e.message : "réessayez"}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="panel flex flex-col gap-3 px-4 py-3 ring-2 ring-accent">
      <div className="section-title">
        <Flame className="h-4 w-4" /> Bonus explosif — question
      </div>
      <p className="text-sm font-semibold">{bonus.question}</p>
      <p className="text-xs text-muted-foreground">
        Bonne réponse : le bonus explose. Mauvaise réponse : il disparaît.
      </p>
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
