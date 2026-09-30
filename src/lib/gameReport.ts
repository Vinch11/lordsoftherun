import { formatCountdown } from "@/lib/conquete";

export type ReportTeamStat = {
  id: string;
  rank: number;
  name: string;
  color: string;
  validated: boolean;
  scoreLabel: string;
  scoreValue: number;
  distanceKm: number;
  speedKmh: number;
  stoppedSeconds: number | null;
  stoppedLabel: string | null;
  flagsCaptured: number | null;
  penaltyLabel: string | null;
  memberCount: number;
  trail: [number, number][];
  narrative: string;
};

export type GameReportHighlight = {
  label: string;
  teamName: string;
  teamColor: string;
  value: string;
};

export type GameReportData = {
  code: string;
  gameName: string;
  modeLabel: string;
  dateLabel: string;
  durationLabel: string;
  participantNounPlural: string;
  totalParticipants: number;
  showStopped: boolean;
  showFlags: boolean;
  teams: ReportTeamStat[];
  unvalidatedTeams: ReportTeamStat[];
  totalCapturedLabel: string | null;
  totals: { distanceKm: number; avgSpeedKmh: number };
  rankingNarrative: string;
  overviewNarrative: string;
  highlights: GameReportHighlight[];
};

/** Projects a lat/lng trail into a flat [0,1]-normalized square (x right, y
 * up) so it can be drawn as a simple route shape without map tiles — a flat
 * local approximation is accurate enough for a single game's trail. */
export function projectTrail(points: [number, number][]): [number, number][] {
  if (points.length === 0) return [];
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const lat0 = points[0]![0];
  const xy = points.map((p): [number, number] => {
    const x = toRad(p[1]) * Math.cos(toRad(lat0)) * R;
    const y = toRad(p[0]) * R;
    return [x, y];
  });
  const xs = xy.map((p) => p[0]);
  const ys = xy.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const offX = (span - (maxX - minX)) / 2;
  const offY = (span - (maxY - minY)) / 2;
  return xy.map(([x, y]) => [(x - minX + offX) / span, (y - minY + offY) / span]);
}

type RawTeamInput = {
  id: string;
  name: string;
  color: string;
  scoreLabel: string;
  scoreValue: number;
  distanceKm: number;
  speedKmh: number;
  stoppedSeconds: number | null;
  flagsCaptured: number | null;
  penaltyLabel: string | null;
  trail: [number, number][];
};

export function buildGameReportData(args: {
  code: string;
  gameName: string;
  modeLabel: string;
  dateLabel: string;
  durationLabel: string;
  participantNounPlural: string;
  memberCountByTeamId: Map<string, number>;
  totalParticipants: number;
  showStopped: boolean;
  showFlags: boolean;
  totalCapturedLabel: string | null;
  rankedTeams: RawTeamInput[];
  unvalidatedTeams: RawTeamInput[];
}): GameReportData {
  const leaderScore = args.rankedTeams[0]?.scoreValue || 1;

  const toStat = (raw: RawTeamInput, rank: number, validated: boolean): ReportTeamStat => {
    const memberCount = args.memberCountByTeamId.get(raw.id) ?? 0;
    const stoppedLabel = raw.stoppedSeconds != null ? formatCountdown(raw.stoppedSeconds) : null;
    const speedLine = `${raw.speedKmh.toFixed(1)} km/h de moyenne`;
    let narrative: string;
    if (!validated) {
      narrative = `${raw.name} n'est pas revenue en zone à temps, mais a tout de même parcouru ${raw.distanceKm.toFixed(2)} km à ${speedLine}.`;
    } else if (rank === 1) {
      narrative = `${raw.name} termine en tête avec ${raw.scoreLabel}, en tenant ${speedLine}.`;
    } else {
      const gapPct = leaderScore > 0 ? Math.round((1 - raw.scoreValue / leaderScore) * 100) : 0;
      narrative =
        gapPct > 0
          ? `${raw.name} finit ${ordinal(rank)}, à ${gapPct}% du score de tête, avec ${speedLine}.`
          : `${raw.name} finit ${ordinal(rank)} avec ${raw.scoreLabel}, à ${speedLine}.`;
    }
    return {
      id: raw.id,
      rank,
      name: raw.name,
      color: raw.color,
      validated,
      scoreLabel: raw.scoreLabel,
      scoreValue: raw.scoreValue,
      distanceKm: raw.distanceKm,
      speedKmh: raw.speedKmh,
      stoppedSeconds: raw.stoppedSeconds,
      stoppedLabel,
      flagsCaptured: raw.flagsCaptured,
      penaltyLabel: raw.penaltyLabel,
      memberCount,
      trail: raw.trail,
      narrative,
    };
  };

  const teams = args.rankedTeams.map((r, i) => toStat(r, i + 1, true));
  const unvalidatedTeams = args.unvalidatedTeams.map((r, i) =>
    toStat(r, teams.length + i + 1, false),
  );
  const allTeams = [...teams, ...unvalidatedTeams];

  const totals = {
    distanceKm: allTeams.reduce((sum, t) => sum + t.distanceKm, 0),
    avgSpeedKmh: allTeams.length
      ? allTeams.reduce((sum, t) => sum + t.speedKmh, 0) / allTeams.length
      : 0,
  };

  const rankingNarrative =
    teams.length >= 2
      ? (() => {
          const first = teams[0]!;
          const second = teams[1]!;
          const gapPct =
            first.scoreValue > 0 ? Math.round((1 - second.scoreValue / first.scoreValue) * 100) : 0;
          return gapPct > 0
            ? `${first.name} devance ${second.name} de ${gapPct}% au score final — l'écart s'est joué sur le terrain, pas sur le papier.`
            : `${first.name} et ${second.name} terminent quasiment à égalité en tête du classement.`;
        })()
      : teams.length === 1
        ? `${teams[0]!.name} termine seule au classement, avec ${teams[0]!.scoreLabel}.`
        : "Aucune équipe n'a terminé la partie dans les temps.";

  const pitchLengths = totals.distanceKm > 0 ? Math.round((totals.distanceKm * 1000) / 100) : 0;
  const overviewNarrative =
    pitchLengths > 0
      ? `À elles toutes, les équipes ont parcouru ${totals.distanceKm.toFixed(1)} km — soit environ ${pitchLengths} longueurs de terrain de foot mises bout à bout.`
      : "Pas encore assez de données de déplacement pour cette partie.";

  const highlights: GameReportHighlight[] = [];
  if (allTeams.length > 0) {
    const fastest = [...allTeams].sort((a, b) => b.speedKmh - a.speedKmh)[0]!;
    if (fastest.speedKmh > 0) {
      highlights.push({
        label: "Équipe la plus rapide",
        teamName: fastest.name,
        teamColor: fastest.color,
        value: `${fastest.speedKmh.toFixed(1)} km/h de moyenne`,
      });
    }
    const farthest = [...allTeams].sort((a, b) => b.distanceKm - a.distanceKm)[0]!;
    if (farthest.distanceKm > 0) {
      highlights.push({
        label: "Plus grande distance parcourue",
        teamName: farthest.name,
        teamColor: farthest.color,
        value: `${farthest.distanceKm.toFixed(2)} km`,
      });
    }
    if (args.showStopped) {
      const stoppedTeams = allTeams.filter((t) => t.stoppedSeconds != null);
      if (stoppedTeams.length > 0) {
        const mostActive = [...stoppedTeams].sort(
          (a, b) => (a.stoppedSeconds ?? 0) - (b.stoppedSeconds ?? 0),
        )[0]!;
        highlights.push({
          label: "La plus active (le moins de pauses)",
          teamName: mostActive.name,
          teamColor: mostActive.color,
          value: `${formatCountdown(mostActive.stoppedSeconds ?? 0)} à l'arrêt`,
        });
      }
    }
    if (args.showFlags) {
      const flagTeams = allTeams.filter((t) => t.flagsCaptured != null);
      if (flagTeams.length > 0) {
        const mostFlags = [...flagTeams].sort(
          (a, b) => (b.flagsCaptured ?? 0) - (a.flagsCaptured ?? 0),
        )[0]!;
        if ((mostFlags.flagsCaptured ?? 0) > 0) {
          highlights.push({
            label: "Plus de drapeaux capturés",
            teamName: mostFlags.name,
            teamColor: mostFlags.color,
            value: `${mostFlags.flagsCaptured} drapeau${(mostFlags.flagsCaptured ?? 0) > 1 ? "x" : ""}`,
          });
        }
      }
    }
  }

  return {
    code: args.code,
    gameName: args.gameName,
    modeLabel: args.modeLabel,
    dateLabel: args.dateLabel,
    durationLabel: args.durationLabel,
    participantNounPlural: args.participantNounPlural,
    totalParticipants: args.totalParticipants,
    showStopped: args.showStopped,
    showFlags: args.showFlags,
    teams,
    unvalidatedTeams,
    totalCapturedLabel: args.totalCapturedLabel,
    totals,
    rankingNarrative,
    overviewNarrative,
    highlights,
  };
}

function ordinal(n: number): string {
  return n === 2 ? "2e" : `${n}e`;
}
