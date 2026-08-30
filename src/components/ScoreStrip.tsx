export type ScoreStripTeam = { id: string; name: string; color: string; score: number };

type Props = {
  teams: ScoreStripTeam[];
  myTeamId: string;
  formatScore: (score: number) => string;
};

/**
 * Live "who's winning" strip for the team play screens: leader, plus up to
 * two more slots that always include the viewer's own team even when it
 * isn't in the top 2 — otherwise it swaps in for the 3rd slot.
 */
export function ScoreStrip({ teams, myTeamId, formatScore }: Props) {
  if (teams.length === 0) return null;
  const ranked = [...teams].sort((a, b) => b.score - a.score);
  const top = ranked.slice(0, 3);
  const display = top.some((t) => t.id === myTeamId)
    ? top
    : [...ranked.slice(0, 2), ranked.find((t) => t.id === myTeamId)].filter(
        (t): t is ScoreStripTeam => t != null,
      );
  const leaderId = ranked[0]!.id;
  const maxScore = Math.max(1, ranked[0]!.score);

  return (
    <div className="score-strip pointer-events-none flex gap-1.5 p-2">
      {display.map((t) => {
        const isLeader = t.id === leaderId;
        const isMe = t.id === myTeamId;
        return (
          <div
            key={t.id}
            className={`score-chip relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-1 ${
              isLeader ? "score-chip-leader" : ""
            } ${isMe ? "score-chip-me" : ""}`}
          >
            {isLeader && <span className="score-chip-crown absolute -top-2.5 text-xs">👑</span>}
            <span className="score-chip-track block h-1 w-full overflow-hidden rounded-full">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${Math.max(6, (t.score / maxScore) * 100)}%`,
                  backgroundColor: t.color,
                }}
              />
            </span>
            <span className="label-xs w-full truncate text-center">{t.name}</span>
            <span className="display text-sm">{formatScore(t.score)}</span>
            {isMe && !isLeader && (
              <span className="absolute -bottom-3.5 whitespace-nowrap text-[9px] font-extrabold text-destructive">
                -{formatScore(Math.max(0, maxScore - t.score))}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
