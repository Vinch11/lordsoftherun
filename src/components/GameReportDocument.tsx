import type { CSSProperties, ReactNode } from "react";
import type { GameReportData, ReportTeamStat } from "@/lib/gameReport";
import { projectTrail } from "@/lib/gameReport";

export const PAGE_W = 794;
export const PAGE_H = 1123;

const COLORS = {
  navyDeep: "#0a0f1f",
  navyMid: "#101d3d",
  navyLight: "#1a3466",
  accent: "#39ff88",
  cream: "#f7f4ec",
  card: "#ffffff",
  ink: "#161a20",
  inkSoft: "#6b7280",
  line: "#e6e1d3",
  pink: "#d63a7a",
  pinkSoft: "rgba(214,58,122,0.12)",
  green: "#1c8a4f",
  greenSoft: "rgba(28,138,79,0.12)",
};

const FONT_DISPLAY = '"Archivo Black", system-ui, sans-serif';
const FONT_BODY = '"Barlow", system-ui, sans-serif';
const FONT_MONO = '"IBM Plex Mono", ui-monospace, monospace';

function Page({
  children,
  dark,
  footerRight,
  pageNum,
  pageTotal,
}: {
  children: ReactNode;
  dark?: boolean;
  footerRight: string;
  pageNum: number;
  pageTotal: number;
}) {
  const style: CSSProperties = {
    width: PAGE_W,
    height: PAGE_H,
    position: "relative",
    background: dark
      ? `linear-gradient(160deg, ${COLORS.navyDeep} 0%, ${COLORS.navyMid} 55%, ${COLORS.navyLight} 100%)`
      : COLORS.cream,
    color: dark ? "#ffffff" : COLORS.ink,
    fontFamily: FONT_BODY,
    padding: "56px 60px 44px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  };
  return (
    <div data-report-page style={style}>
      {children}
      <div
        style={{
          position: "absolute",
          left: 60,
          right: 60,
          bottom: 26,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 10,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: dark ? "rgba(255,255,255,0.45)" : COLORS.inkSoft,
        }}
      >
        <span>Conquête · Rapport de partie</span>
        <span>
          {footerRight} · Page {pageNum}/{pageTotal}
        </span>
      </div>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  dark,
}: {
  eyebrow: string;
  title: string;
  dark?: boolean;
}) {
  return (
    <div style={{ marginBottom: 26 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.16em",
          color: dark ? COLORS.accent : COLORS.pink,
          marginBottom: 10,
        }}
      >
        {eyebrow}
      </div>
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 28,
          lineHeight: 1.15,
        }}
      >
        {title}
      </div>
    </div>
  );
}

function FrostedStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.07)",
        border: "1px solid rgba(255,255,255,0.16)",
        borderRadius: 16,
        padding: "16px 20px",
        flex: "1 1 150px",
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.55)",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 21 }}>{value}</div>
    </div>
  );
}

function LightStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.line}`,
        borderRadius: 14,
        padding: "14px 18px",
        flex: "1 1 150px",
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: COLORS.inkSoft,
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 19, color: COLORS.ink }}>
        {value}
      </div>
    </div>
  );
}

function Callout({
  lead,
  children,
  accent = COLORS.pink,
  bg = COLORS.pinkSoft,
}: {
  lead: string;
  children: ReactNode;
  accent?: string;
  bg?: string;
}) {
  return (
    <div
      style={{
        borderLeft: `4px solid ${accent}`,
        background: bg,
        borderRadius: "0 12px 12px 0",
        padding: "14px 18px",
        fontSize: 13.5,
        lineHeight: 1.55,
        color: COLORS.ink,
      }}
    >
      <strong style={{ fontWeight: 700 }}>{lead} </strong>
      {children}
    </div>
  );
}

function Pill({ children, tone }: { children: ReactNode; tone: "good" | "warn" }) {
  const c =
    tone === "good"
      ? { bg: COLORS.greenSoft, fg: COLORS.green }
      : { bg: COLORS.pinkSoft, fg: COLORS.pink };
  return (
    <span
      style={{
        background: c.bg,
        color: c.fg,
        fontSize: 10,
        fontWeight: 700,
        padding: "3px 10px",
        borderRadius: 999,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function GaugeBar({ fraction, color }: { fraction: number; color: string }) {
  return (
    <div
      style={{
        position: "relative",
        height: 8,
        borderRadius: 999,
        background: COLORS.line,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: `${Math.max(3, fraction * 100)}%`,
          background: color,
          borderRadius: 999,
        }}
      />
    </div>
  );
}

function RouteShape({ trail, color }: { trail: [number, number][]; color: string }) {
  const pts = projectTrail(trail);
  if (pts.length < 2) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: COLORS.inkSoft,
          fontSize: 12,
        }}
      >
        Trajet indisponible
      </div>
    );
  }
  const pad = 12;
  const scaleX = (v: number) => pad + v * (100 - 2 * pad);
  const scaleY = (v: number) => 100 - (pad + v * (100 - 2 * pad));
  const d = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${scaleX(x).toFixed(2)} ${scaleY(y).toFixed(2)}`)
    .join(" ");
  const [sx, sy] = pts[0]!;
  const [ex, ey] = pts[pts.length - 1]!;
  return (
    <svg
      viewBox="0 0 100 100"
      style={{ width: "100%", height: "100%" }}
      preserveAspectRatio="xMidYMid meet"
    >
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={scaleX(sx)} cy={scaleY(sy)} r={3.2} fill={COLORS.green} />
      <circle cx={scaleX(ex)} cy={scaleY(ey)} r={3.2} fill={color} stroke="#fff" strokeWidth={1} />
    </svg>
  );
}

function TeamRow({
  t,
  showStopped,
  showFlags,
}: {
  t: ReportTeamStat;
  showStopped: boolean;
  showFlags: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "9px 4px",
        borderBottom: `1px solid ${COLORS.line}`,
      }}
    >
      <span
        style={{
          fontFamily: FONT_MONO,
          fontWeight: 700,
          fontSize: 13,
          width: 22,
          flexShrink: 0,
          color: COLORS.inkSoft,
        }}
      >
        {t.rank}
      </span>
      <span
        style={{
          width: 12,
          height: 12,
          borderRadius: 999,
          background: t.color,
          border: "1px solid rgba(0,0,0,0.25)",
          flexShrink: 0,
        }}
      />
      <span
        style={{
          flex: 1,
          fontWeight: 600,
          fontSize: 13.5,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {t.name}
      </span>
      {!t.validated && (
        <span style={{ flexShrink: 0 }}>
          <Pill tone="warn">Hors classement</Pill>
        </span>
      )}
      {showFlags && t.flagsCaptured != null && (
        <span style={{ fontSize: 11.5, color: COLORS.inkSoft, flexShrink: 0 }}>
          🚩 {t.flagsCaptured}
        </span>
      )}
      {showStopped && t.stoppedLabel && (
        <span style={{ fontSize: 11.5, color: COLORS.inkSoft, flexShrink: 0 }}>
          ⏸ {t.stoppedLabel}
        </span>
      )}
      <span
        style={{
          fontSize: 11.5,
          color: COLORS.inkSoft,
          width: 88,
          flexShrink: 0,
          textAlign: "right",
        }}
      >
        {t.distanceKm.toFixed(2)} km
      </span>
      <span
        style={{
          fontSize: 11.5,
          color: COLORS.inkSoft,
          width: 76,
          flexShrink: 0,
          textAlign: "right",
        }}
      >
        {t.speedKmh.toFixed(1)} km/h
      </span>
      <span
        style={{
          fontFamily: FONT_MONO,
          fontWeight: 700,
          fontSize: 14,
          width: 92,
          flexShrink: 0,
          textAlign: "right",
          color: t.validated ? COLORS.ink : COLORS.inkSoft,
          textDecoration: t.validated ? "none" : "line-through",
        }}
      >
        {t.scoreLabel}
      </span>
    </div>
  );
}

function CoverPage({ data, pageTotal }: { data: GameReportData; pageTotal: number }) {
  const teamCount = data.teams.length + data.unvalidatedTeams.length;
  return (
    <Page dark pageNum={1} pageTotal={pageTotal} footerRight={data.dateLabel}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            border: `2px solid ${COLORS.accent}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: FONT_DISPLAY,
            fontSize: 14,
            color: COLORS.accent,
          }}
        >
          C
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.24em",
            color: "rgba(255,255,255,0.6)",
          }}
        >
          CONQUÊTE
        </div>
      </div>
      <div style={{ flex: 1 }} />
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.16em",
          color: COLORS.accent,
          marginBottom: 16,
        }}
      >
        RAPPORT DE FIN DE PARTIE
      </div>
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 44,
          lineHeight: 1.1,
          marginBottom: 18,
          maxWidth: 620,
        }}
      >
        {data.gameName}
      </div>
      <div
        style={{
          fontSize: 15,
          lineHeight: 1.65,
          color: "rgba(255,255,255,0.78)",
          maxWidth: 520,
          marginBottom: 40,
        }}
      >
        Mode {data.modeLabel} · {teamCount} équipes · {data.totalParticipants}{" "}
        {data.participantNounPlural}. {data.overviewNarrative}
      </div>
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <FrostedStat label="Équipes" value={String(teamCount)} />
        <FrostedStat label={data.participantNounPlural} value={String(data.totalParticipants)} />
        <FrostedStat label="Distance totale" value={`${data.totals.distanceKm.toFixed(1)} km`} />
        <FrostedStat label="Durée" value={data.durationLabel} />
      </div>
    </Page>
  );
}

function RankingPage({
  data,
  pageNum,
  pageTotal,
}: {
  data: GameReportData;
  pageNum: number;
  pageTotal: number;
}) {
  const podium = data.teams.slice(0, 3);
  const medals = ["🥇", "🥈", "🥉"];
  const rowCount = data.teams.length + data.unvalidatedTeams.length;
  const compact = rowCount > 14;
  return (
    <Page pageNum={pageNum} pageTotal={pageTotal} footerRight={data.dateLabel}>
      <SectionHeading eyebrow="01 — CLASSEMENT FINAL" title="Qui a dominé le terrain ?" />
      {podium.length > 0 && (
        <div style={{ display: "flex", gap: 12, marginBottom: 18 }}>
          {podium.map((t, i) => (
            <div
              key={t.id}
              style={{
                flex: 1,
                background: COLORS.card,
                border: `1px solid ${COLORS.line}`,
                borderRadius: 14,
                padding: "14px 16px",
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 6 }}>{medals[i]}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: t.color,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.name}
                </span>
              </div>
              <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 17 }}>
                {t.scoreLabel}
              </div>
              <div style={{ marginTop: 8 }}>
                <GaugeBar
                  fraction={t.scoreValue / (data.teams[0]?.scoreValue || 1)}
                  color={t.color}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginBottom: 20 }}>
        <Callout lead="Ce que ça raconte.">{data.rankingNarrative}</Callout>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 4px 8px",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: COLORS.inkSoft,
          borderBottom: `2px solid ${COLORS.ink}`,
        }}
      >
        <span style={{ width: 22 }}>#</span>
        <span style={{ width: 12 }} />
        <span style={{ flex: 1 }}>Équipe</span>
        <span style={{ width: 88, textAlign: "right" }}>Distance</span>
        <span style={{ width: 76, textAlign: "right" }}>Vitesse</span>
        <span style={{ width: 92, textAlign: "right" }}>Score</span>
      </div>
      <div style={{ fontSize: compact ? 12 : 13.5, overflow: "hidden" }}>
        {data.teams.map((t) => (
          <TeamRow key={t.id} t={t} showStopped={data.showStopped} showFlags={data.showFlags} />
        ))}
        {data.unvalidatedTeams.map((t) => (
          <TeamRow key={t.id} t={t} showStopped={data.showStopped} showFlags={data.showFlags} />
        ))}
      </div>
    </Page>
  );
}

function OverviewPage({
  data,
  pageNum,
  pageTotal,
}: {
  data: GameReportData;
  pageNum: number;
  pageTotal: number;
}) {
  const allTeams = [...data.teams, ...data.unvalidatedTeams];
  const maxDist = Math.max(...allTeams.map((t) => t.distanceKm), 0.01);
  const rowH = Math.max(16, Math.min(30, 420 / Math.max(1, allTeams.length)));
  return (
    <Page pageNum={pageNum} pageTotal={pageTotal} footerRight={data.dateLabel}>
      <SectionHeading eyebrow="02 — VUE D'ENSEMBLE" title="Toute la classe en mouvement" />
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
        <LightStat label="Distance cumulée" value={`${data.totals.distanceKm.toFixed(1)} km`} />
        <LightStat label="Vitesse moyenne" value={`${data.totals.avgSpeedKmh.toFixed(1)} km/h`} />
        <LightStat label="Équipes" value={String(allTeams.length)} />
        {data.totalCapturedLabel && (
          <LightStat label="Total conquis (brut)" value={data.totalCapturedLabel} />
        )}
      </div>
      <div style={{ marginBottom: 24 }}>
        <Callout lead="Repère clé." accent={COLORS.green} bg={COLORS.greenSoft}>
          {data.overviewNarrative}
        </Callout>
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: COLORS.inkSoft,
          marginBottom: 10,
        }}
      >
        Distance parcourue par équipe
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {[...allTeams]
          .sort((a, b) => b.distanceKm - a.distanceKm)
          .map((t) => (
            <div
              key={t.id}
              style={{ display: "flex", alignItems: "center", gap: 10, height: rowH }}
            >
              <span
                style={{
                  width: 130,
                  fontSize: 12,
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {t.name}
              </span>
              <div
                style={{
                  flex: 1,
                  position: "relative",
                  height: Math.min(16, rowH - 4),
                  background: COLORS.line,
                  borderRadius: 999,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${Math.max(3, (t.distanceKm / maxDist) * 100)}%`,
                    background: t.color,
                    borderRadius: 999,
                  }}
                />
              </div>
              <span
                style={{
                  width: 64,
                  fontFamily: FONT_MONO,
                  fontSize: 11.5,
                  textAlign: "right",
                  flexShrink: 0,
                }}
              >
                {t.distanceKm.toFixed(2)} km
              </span>
            </div>
          ))}
      </div>
    </Page>
  );
}

function TeamPage({
  t,
  data,
  index,
  pageNum,
  pageTotal,
}: {
  t: ReportTeamStat;
  data: GameReportData;
  index: number;
  pageNum: number;
  pageTotal: number;
}) {
  return (
    <Page pageNum={pageNum} pageTotal={pageTotal} footerRight={data.dateLabel}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.16em",
          color: COLORS.pink,
          marginBottom: 10,
        }}
      >
        {`03.${index + 1} — RÉSUMÉ D'ÉQUIPE`}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
        <span
          style={{ width: 16, height: 16, borderRadius: 999, background: t.color, flexShrink: 0 }}
        />
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 30 }}>{t.name}</div>
        {!t.validated && <Pill tone="warn">Hors classement</Pill>}
        {t.validated && t.rank === 1 && <Pill tone="good">Vainqueur</Pill>}
      </div>
      <div style={{ display: "flex", gap: 24, marginBottom: 22 }}>
        <div
          style={{
            flex: "0 0 260px",
            height: 220,
            background: COLORS.card,
            border: `1px solid ${COLORS.line}`,
            borderRadius: 16,
            padding: 14,
          }}
        >
          <RouteShape trail={t.trail} color={t.color} />
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <LightStat label="Score final" value={t.scoreLabel} />
            <LightStat label="Rang" value={`${t.rank}${t.rank === 1 ? "er" : "e"}`} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <LightStat label="Distance" value={`${t.distanceKm.toFixed(2)} km`} />
            <LightStat label="Vitesse moy." value={`${t.speedKmh.toFixed(1)} km/h`} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {data.showStopped && t.stoppedLabel && (
              <LightStat label="Temps d'arrêt" value={t.stoppedLabel} />
            )}
            {data.showFlags && t.flagsCaptured != null && (
              <LightStat label="Drapeaux" value={String(t.flagsCaptured)} />
            )}
            <LightStat
              label="Effectif"
              value={`${t.memberCount} ${t.memberCount > 1 ? "joueurs" : "joueur"}`}
            />
          </div>
        </div>
      </div>
      {t.penaltyLabel && (
        <div style={{ marginBottom: 16 }}>
          <Callout lead="Pénalité.">{t.penaltyLabel}</Callout>
        </div>
      )}
      <Callout lead="Lecture coach." accent={t.color} bg="rgba(0,0,0,0.04)">
        {t.narrative}
      </Callout>
    </Page>
  );
}

function HighlightsPage({
  data,
  pageNum,
  pageTotal,
}: {
  data: GameReportData;
  pageNum: number;
  pageTotal: number;
}) {
  return (
    <Page pageNum={pageNum} pageTotal={pageTotal} footerRight={data.dateLabel}>
      <SectionHeading
        eyebrow="04 — FAITS MARQUANTS"
        title="Ce qu'il faut retenir de cette partie"
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
        {data.highlights.map((h) => (
          <div
            key={h.label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              background: COLORS.card,
              border: `1px solid ${COLORS.line}`,
              borderRadius: 14,
              padding: "14px 18px",
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 999,
                background: h.teamColor,
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: COLORS.inkSoft,
                }}
              >
                {h.label}
              </div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{h.teamName}</div>
            </div>
            <div style={{ fontFamily: FONT_MONO, fontWeight: 700, fontSize: 15 }}>{h.value}</div>
          </div>
        ))}
        {data.highlights.length === 0 && (
          <p style={{ color: COLORS.inkSoft, fontSize: 13 }}>
            Pas assez de données pour dégager des faits marquants sur cette partie.
          </p>
        )}
      </div>
      <Callout lead="Pour la prochaine séance.">
        Comparez ce rapport à la prochaine partie pour suivre la progression de chaque équipe dans
        le temps — distance, vitesse et régularité sont les indicateurs les plus fiables d'une
        séance à l'autre.
      </Callout>
    </Page>
  );
}

export function GameReportDocument({ data }: { data: GameReportData }) {
  const pageTotal = 3 + data.teams.length + data.unvalidatedTeams.length + 1;
  const allTeams = [...data.teams, ...data.unvalidatedTeams];
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <CoverPage data={data} pageTotal={pageTotal} />
      <RankingPage data={data} pageNum={2} pageTotal={pageTotal} />
      <OverviewPage data={data} pageNum={3} pageTotal={pageTotal} />
      {allTeams.map((t, i) => (
        <TeamPage key={t.id} t={t} data={data} index={i} pageNum={4 + i} pageTotal={pageTotal} />
      ))}
      <HighlightsPage data={data} pageNum={pageTotal} pageTotal={pageTotal} />
    </div>
  );
}
