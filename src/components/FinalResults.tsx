import { Home, Trophy, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { ScoreStripTeam } from "@/components/ScoreStrip";

export type FinalResultsTeam = ScoreStripTeam & {
  /** False once a team missed the return deadline in "cancel" grace mode — excluded from the podium. */
  validated: boolean;
};

type Props = {
  teams: FinalResultsTeam[];
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
 * opens this final ranking with their own line highlighted. A team that
 * missed the return deadline (grace "cancel" mode) is disqualified — shown
 * separately, struck through, never on the podium — same treatment as the
 * teacher's own dashboard already gives it.
 */
export function FinalResults({ teams, myTeamId, formatScore, statusLabel, onClose }: Props) {
  const validated = [...teams.filter((t) => t.validated)].sort((a, b) => b.score - a.score);
  const disqualified = teams.filter((t) => !t.validated);
  const myIndex = validated.findIndex((t) => t.id === myTeamId);
  const me = myIndex >= 0 ? validated[myIndex] : null;
  const myTeam = teams.find((t) => t.id === myTeamId);
  const iAmDisqualified = !!myTeam && !myTeam.validated;

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

        {iAmDisqualified && (
          <div className="panel flex flex-col items-center gap-1 p-4 ring-2 ring-destructive">
            <span className="label-xs text-destructive">Votre équipe</span>
            <span className="display text-xl text-destructive">Disqualifiée</span>
            <span className="text-center text-xs text-muted-foreground">
              Retour hors délai — hors classement
            </span>
          </div>
        )}

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
          {validated.map((t, i) => (
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

        {disqualified.length > 0 && (
          <div className="panel flex flex-col gap-1 p-3">
            <span className="label-xs px-2">Hors classement — retour hors délai</span>
            {disqualified.map((t) => (
              <div
                key={t.id}
                className={`flex items-center gap-3 rounded-lg px-2 py-2 opacity-60 ${
                  t.id === myTeamId ? "ring-1 ring-destructive" : ""
                }`}
              >
                <span className="w-6 text-center text-sm font-extrabold text-destructive">✕</span>
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: t.color }}
                />
                <span className="flex-1 truncate text-sm font-semibold">{t.name}</span>
                <span className="display text-sm tabular-nums line-through">
                  {formatScore(t.score)}
                </span>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-sm text-muted-foreground">{statusLabel}</p>

        <button className="btn-huge btn-huge-accent" onClick={onClose}>
          Retour à la carte
        </button>

        <Link to="/" className="btn-huge btn-huge-dark flex items-center justify-center gap-2">
          <Home className="h-5 w-5" /> Accueil — mes parties
        </Link>
      </div>
    </div>
  );
}
