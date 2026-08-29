import { Flag, Ruler, Timer, Trophy } from "lucide-react";
import { formatArea, formatClock } from "@/lib/conquete";

export type LoopSummaryData = {
  /** Surface enfermée par la boucle, en m². */
  area: number;
  /** Durée de la boucle, en secondes. */
  durationS: number;
  /** Distance parcourue, en mètres. */
  distanceM: number;
  /** Bonus course obtenu (vitesse moyenne suffisante). */
  ran: boolean;
  /** Trace GPS de la boucle, pour l'aperçu du territoire. */
  track: [number, number][];
  /** Nouveau score total du groupe, en m². */
  totalM2: number;
};

/** Projette la trace lat/lng dans une viewBox 100x100 en gardant les proportions. */
function trackToPath(track: [number, number][]): string | null {
  if (track.length < 3) return null;
  const lats = track.map((p) => p[0]);
  const lngs = track.map((p) => p[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const midLat = (minLat + maxLat) / 2;
  const kx = Math.cos((midLat * Math.PI) / 180);
  const w = Math.max((maxLng - minLng) * kx, 1e-9);
  const h = Math.max(maxLat - minLat, 1e-9);
  const scale = 84 / Math.max(w, h);
  const offsetX = (100 - w * scale) / 2;
  const offsetY = (100 - h * scale) / 2;
  const pts = track.map(([lat, lng]) => {
    const x = offsetX + (lng - minLng) * kx * scale;
    const y = offsetY + (maxLat - lat) * scale;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });
  return `M${pts.join("L")}Z`;
}

export function LoopSummary({
  data,
  color = "#e63946",
  onClose,
}: {
  data: LoopSummaryData;
  color?: string;
  onClose: () => void;
}) {
  const path = trackToPath(data.track);

  return (
    <div className="absolute inset-0 z-[1200] flex flex-col bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto p-5">
        <div>
          <div className="pill">
            <Trophy className="h-3.5 w-3.5" /> Boucle fermée
          </div>
          <h1 className="mt-3 text-4xl leading-[0.9]">
            Territoire <em>capturé</em>
          </h1>
        </div>

        <div className="panel flex flex-col items-center gap-1 p-5">
          <span className="label-xs">Surface gagnée</span>
          <span className="display text-5xl" style={{ color }}>
            {formatArea(data.area)}
          </span>
          {data.ran && <span className="chip chip-accent mt-1">🏃 Bonus course</span>}
        </div>

        <div className="panel p-4">
          <span className="label-xs">Aperçu du territoire</span>
          <div className="mt-2 aspect-square w-full rounded-xl bg-muted p-2">
            {path ? (
              <svg
                viewBox="0 0 100 100"
                className="h-full w-full"
                role="img"
                aria-label="Aperçu du territoire capturé"
              >
                <path
                  d={path}
                  fill={color}
                  fillOpacity={0.35}
                  stroke={color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Aperçu indisponible
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="stat">
            <span className="label-xs">
              <Timer className="mr-1 inline h-3 w-3" /> Temps de jeu
            </span>
            <span className="stat-value text-2xl">{formatClock(data.durationS)}</span>
          </div>
          <div className="stat">
            <span className="label-xs">
              <Ruler className="mr-1 inline h-3 w-3" /> Distance
            </span>
            <span className="stat-value text-2xl">{Math.round(data.distanceM)} m</span>
          </div>
        </div>

        <div className="panel flex items-center justify-between gap-3 px-4 py-3">
          <span className="label-xs">Score total du groupe</span>
          <span className="display text-xl">{formatArea(data.totalM2)}</span>
        </div>

        <button className="btn-huge btn-huge-accent mt-auto" onClick={onClose}>
          <Flag className="h-6 w-6" /> Repartir pour une boucle
        </button>
      </div>
    </div>
  );
}
