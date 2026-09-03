import { createFileRoute } from "@tanstack/react-router";
import { Crosshair, Flag, HelpCircle, MessageCircle } from "lucide-react";
import { MapCanvas } from "@/components/MapCanvas";
import { ScoreStrip } from "@/components/ScoreStrip";
import { formatArea, formatCountdown, studentThemeClass } from "@/lib/conquete";
import { getTerminology, type Terminology } from "@/lib/terminology";

export const Route = createFileRoute("/apercu-theme/$theme")({
  validateSearch: (search: Record<string, unknown>): { term: Terminology } => ({
    term: search["term"] === "organisateur" ? "organisateur" : "enseignant",
  }),
  head: () => ({
    meta: [
      { title: "Aperçu du thème élève — Conquête" },
      {
        name: "description",
        content:
          "Aperçu grandeur nature de l'écran élève de Conquête avec le thème visuel choisi par l'enseignant.",
      },
      { property: "og:title", content: "Aperçu du thème élève — Conquête" },
      {
        property: "og:description",
        content: "Visualisez l'écran de jeu des élèves avant de lancer la partie.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ThemePreviewScreen,
});

/** Fake but realistic game data so the preview looks exactly like a live round. */
const CENTER: [number, number] = [50.8466, 4.3528];
const DEMO_TEAMS = [
  { id: "a", name: "Les Bleus", color: "#1d6fe0", score: 1240 },
  { id: "b", name: "Les Rouges", color: "#e63946", score: 980 },
  { id: "c", name: "Les Verts", color: "#2a9d3f", score: 620 },
];
const DEMO_TRAIL: [number, number][] = [
  [50.8462, 4.3521],
  [50.8465, 4.3527],
  [50.8469, 4.3533],
  [50.8471, 4.3526],
  [50.8467, 4.3519],
];

function ThemePreviewScreen() {
  const { theme } = Route.useParams();
  const { term } = Route.useSearch();
  const t = getTerminology(term);
  const me = DEMO_TEAMS[0]!;

  return (
    <main
      className={`${studentThemeClass(theme)} relative h-[100dvh] w-full overflow-hidden`}
      aria-label={`Aperçu de l'écran ${t.participantNoun}`}
    >
      <div className="absolute inset-0">
        <MapCanvas
          center={CENTER}
          teams={DEMO_TEAMS.map((t, i) => ({
            id: t.id,
            name: t.name,
            color: t.color,
            lat: CENTER[0] + i * 0.0004,
            lng: CENTER[1] - i * 0.0005,
          }))}
          territories={[
            {
              id: "t1",
              color: me.color,
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [4.3521, 50.8462],
                    [4.3527, 50.8465],
                    [4.3533, 50.8469],
                    [4.3526, 50.8471],
                    [4.3519, 50.8467],
                    [4.3521, 50.8462],
                  ],
                ],
              },
            },
          ]}
          trail={DEMO_TRAIL}
          trailColor={me.color}
          follow={false}
          hudFrame
        />
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[1000] grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2 p-3"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <div className="hud-badge min-w-0 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="h-5 w-5 shrink-0 rounded-full border-2 border-foreground"
              style={{ backgroundColor: me.color }}
            />
            <span className="truncate text-lg font-bold">{me.name}</span>
          </div>
          <div className="display text-xl">{formatArea(me.score)}</div>
          <div className="label-xs">Total conquis · {formatArea(1860)}</div>
        </div>
        <div className="hud-badge shrink-0 px-3 py-2 text-right">
          <div className="label-xs">Temps</div>
          <div className="display text-2xl tabular-nums">{formatCountdown(742)}</div>
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-x-3 z-[999]"
        style={{ top: "max(6.5rem, calc(env(safe-area-inset-top) + 4.25rem))" }}
      >
        <ScoreStrip teams={DEMO_TEAMS} myTeamId={me.id} formatScore={formatArea} />
      </div>

      <div
        className="hud-badge absolute right-3 z-[1000] flex h-12 w-12 items-center justify-center"
        style={{ top: "max(12rem, calc(env(safe-area-inset-top) + 9.5rem))" }}
      >
        <MessageCircle className="h-6 w-6" />
      </div>
      <div
        className="hud-badge absolute right-3 z-[1000] flex h-12 w-12 items-center justify-center"
        style={{ top: "max(16rem, calc(env(safe-area-inset-top) + 13.5rem))" }}
      >
        <HelpCircle className="h-6 w-6" />
      </div>

      <div
        className="absolute inset-x-0 bottom-0 z-[1000] mx-auto flex w-full max-w-md flex-col gap-2.5 p-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="panel px-4 py-2 text-sm font-semibold">
          {t.hostChatLabel} : regroupement à la zone Nord dans 5 minutes !
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="stat">
            <span className="label-xs">Distance</span>
            <span className="stat-value text-2xl">248 m</span>
          </div>
          <div className="stat text-right">
            <span className="label-xs">Retour au départ</span>
            <span className="stat-value text-2xl">62 m</span>
          </div>
        </div>
        <div className="panel flex items-center gap-2 px-4 py-2">
          <Crosshair className="h-4 w-4 shrink-0 text-accent" />
          <span className="label-xs">Signal GPS OK · ±6 m</span>
        </div>
        <div className="btn-huge btn-huge-accent justify-center">
          <Flag className="h-6 w-6" /> Commencer ma boucle
        </div>
      </div>
    </main>
  );
}
