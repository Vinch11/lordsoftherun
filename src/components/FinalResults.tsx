import { Trophy, X } from "lucide-react";
import type { ScoreStripTeam } from "@/components/ScoreStrip";

type Props = {
  teams: ScoreStripTeam[];
  myTeamId: string;
  formatScore: (score: number) => string;
  /** Endgame status line (validated / late return / grace countdown). */
  statusLabel: string;
  onClose: () => void;
};

const MEDALS = ["🥇", "🥈", "🥉"];

/**
 * End-of-game recap for the team screens. The old finish banner was a dead
 * block of text; players want to know where they landed, so the banner now
 * opens this final ranking with their own line highlighted.
 */
export function FinalResults({ teams, myTeamId, formatScore, statusLabel, onClose }: Props) {
  const ranked = [...teams].sort((a, b) => b.score - a.score);
  const myIndex = ranked.findIndex((t) => t.id === myTeamId);
  const me = myIndex >= 0 ? ranked[myIndex] : null;

  return (
    <div className="fixed inset-0 z-[1300] flex flex-col overflow-y-auto bg-background/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="section-title">
            <Trophy className="h-4 w-4" /> Classement final
          </div>
          <button aria-label="Fermer" className="icon-btn" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {me && (
          <div className="panel flex flex-col items-center gap-1 p-4">
            <span className="label-xs">Votre équipe</span>
            <span className="display text-4xl" style={{ color: me.color }}>
              {myIndex + 1}
              <sup className="text-lg">{myIndex === 0 ? "er" : "e"}</sup>
            </span>
            <span className="display text-xl">{formatScore(me.score)}</span>
          </div>
        )}

        <div className="panel flex flex-col gap-1 p-3">
          {ranked.map((t, i) => (
            <div
              key={t.id}
              className={`flex items-center gap-3 rounded-lg px-2 py-2 ${
                t.id === myTeamId ? "bg-accent/15 ring-1 ring-accent" : ""
              }`}
            >
              <span className="w-6 text-center text-sm font-extrabold">
                {MEDALS[i] ?? `${i + 1}.`}
              </span>
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: t.color }}
              />
              <span className="flex-1 truncate text-sm font-semibold">{t.name}</span>
              <span className="display text-sm tabular-nums">{formatScore(t.score)}</span>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground">{statusLabel}</p>

        <button className="btn-huge btn-huge-accent" onClick={onClose}>
          Retour à la carte
        </button>
      </div>
    </div>
  );
}
