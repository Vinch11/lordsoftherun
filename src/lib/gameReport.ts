import { formatCountdown, kmhToMs } from "@/lib/conquete";

/**
 * How much of the final score compliance (not stopping, not walking) alone
 * can reach vs. how much is reserved for the speed/distance effort bonus —
 * a team that clears both absolute rules but never pushes its pace tops out
 * at COMPLIANCE_WEIGHT * 100 (70%), not 100%: the remaining share only
 * opens up by also beating the reference pace. This keeps the score capped
 * at exactly 100% (compliance and effort are each at most 1) while still
 * giving the bonus somewhere to matter for a team that already has perfect
 * compliance — the most common case once a class understands "don't stop,
 * don't walk".
 */
const COMPLIANCE_WEIGHT = 0.7;
const EFFORT_WEIGHT = 1 - COMPLIANCE_WEIGHT;
/** The effort ratio (speed or distance vs. the reference) saturates at 1
 * once the team beats the reference by this fraction — no reason to need
 * more than 50% over a teacher-set reference pace to earn the full bonus. */
const BONUS_SATURATION_RATIO = 0.5;

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

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
  enduranceScore: number | null;
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
  enduranceYearLevel: string | null;
  enduranceSpeedRefKmh: number | null;
  enduranceAvgScore: number | null;
};

/**
 * "Coefficient d'endurance": compliance with the test's two absolute rules
 * (don't stop, don't walk) gates the score, and effort beyond that — speed
 * and distance compared to the teacher's reference pace — decides how much
 * of the remaining ceiling a compliant team actually reaches. The score
 * never exceeds 100%: compliance and effort are each a ratio capped at 1,
 * weighted by COMPLIANCE_WEIGHT/EFFORT_WEIGHT so their product's maximum is
 * exactly 100.
 *
 * compliance = the share of the whole game spent actually running — not
 * stopped, not walking (walking being a fixed, age-independent pace
 * threshold, not something compared against a target — see
 * DEFAULT_WALK_SPEED_THRESHOLD_KMH). runningSeconds (activeSeconds minus
 * the portion already classified as walking, live, during the game — see
 * totalWalkingRef in the play views) is what's left once both failures are
 * subtracted out, so a team that walks the entire game without ever
 * stopping scores close to 0%, not a middling "regularity" score.
 *
 * effort = how far speedKmh (average pace while actually moving) and
 * distanceM (what they covered over the *whole* game, stops included)
 * exceed the reference pace for their year level, saturating once they
 * beat it by 50%. A fully compliant team with no reference pace configured
 * (teacher left it disabled) gets full effort credit by default — the
 * bonus only applies once the teacher opts in.
 *
 * Returns null when the mode doesn't track active/walking time at all.
 */
export function computeEnduranceScore(args: {
  activeSeconds: number;
  walkingSeconds: number;
  gameElapsedS: number;
  distanceM: number;
  speedKmh: number;
  speedRefKmh: number | null;
}): number | null {
  if (args.gameElapsedS <= 0) return null;
  const runningSeconds = Math.max(0, args.activeSeconds - args.walkingSeconds);
  const compliance = clamp01(runningSeconds / args.gameElapsedS);

  let effort = 1;
  if (args.speedRefKmh && args.speedRefKmh > 0) {
    const speedRatio = clamp01((args.speedKmh / args.speedRefKmh - 1) / BONUS_SATURATION_RATIO);
    const refDistanceM = kmhToMs(args.speedRefKmh) * args.gameElapsedS;
    const distanceRatio =
      refDistanceM > 0 ? clamp01((args.distanceM / refDistanceM - 1) / BONUS_SATURATION_RATIO) : 0;
    effort = (speedRatio + distanceRatio) / 2;
  }

  const score = compliance * 100 * (COMPLIANCE_WEIGHT + EFFORT_WEIGHT * effort);
  const rounded = Math.round(Math.max(0, Math.min(100, score)));
  // Any NaN input anywhere above (a column missing on a game played before
  // its migration landed, for instance — this project's recurring failure
  // mode) silently poisons every step through Math.max/min, which never
  // throw on NaN, just propagate it — so this is the one place that would
  // ever actually surface it, as "NaN%" in the report. Showing no score is
  // a far better failure than a glaring, meaningless "NaN%".
  return Number.isFinite(rounded) ? rounded : null;
}

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
  activeSeconds: number | null;
  walkingSeconds: number | null;
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
  gameElapsedS: number;
  enduranceYearLevel: string | null;
  enduranceSpeedRefKmh: number | null;
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
    const enduranceScore =
      raw.activeSeconds != null && raw.walkingSeconds != null
        ? computeEnduranceScore({
            activeSeconds: raw.activeSeconds,
            walkingSeconds: raw.walkingSeconds,
            gameElapsedS: args.gameElapsedS,
            distanceM: raw.distanceKm * 1000,
            speedKmh: raw.speedKmh,
            speedRefKmh: args.enduranceSpeedRefKmh,
          })
        : null;
    if (enduranceScore != null) {
      narrative += ` Coefficient d'endurance : ${enduranceScore}%.`;
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
      enduranceScore,
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
    const enduranceTeams = allTeams.filter((t) => t.enduranceScore != null);
    if (enduranceTeams.length > 0) {
      const best = [...enduranceTeams].sort(
        (a, b) => (b.enduranceScore ?? 0) - (a.enduranceScore ?? 0),
      )[0]!;
      highlights.push({
        label: "Meilleur coefficient d'endurance",
        teamName: best.name,
        teamColor: best.color,
        value: `${best.enduranceScore}%`,
      });
    }
  }

  const enduranceTeamsForAvg = allTeams.filter(
    (t): t is ReportTeamStat & { enduranceScore: number } => t.enduranceScore != null,
  );
  const enduranceAvgScore = enduranceTeamsForAvg.length
    ? Math.round(
        enduranceTeamsForAvg.reduce((sum, t) => sum + t.enduranceScore, 0) /
          enduranceTeamsForAvg.length,
      )
    : null;

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
    enduranceYearLevel: args.enduranceYearLevel,
    enduranceSpeedRefKmh: args.enduranceSpeedRefKmh,
    enduranceAvgScore,
  };
}

function ordinal(n: number): string {
  return n === 2 ? "2e" : `${n}e`;
}
