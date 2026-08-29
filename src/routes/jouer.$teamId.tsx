import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Crosshair, Flag, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MapCanvas } from "@/components/MapCanvas";
import { useGameState } from "@/lib/useGameState";
import {
  CLOSE_RADIUS_M,
  MIN_LOOP_DISTANCE_M,
  formatArea,
  formatClock,
  haversine,
} from "@/lib/conquete";
import { captureTerritory, polygonFromTrack } from "@/lib/capture";

export const Route = createFileRoute("/jouer/$teamId")({
  head: () => ({
    meta: [
      { title: "Ma boucle — Conquête" },
      {
        name: "description",
        content:
          "Lancez votre boucle GPS, revenez à votre point de départ et capturez la surface enfermée pour votre équipe.",
      },
      { property: "og:title", content: "Ma boucle — Conquête" },
      {
        property: "og:description",
        content: "Trace GPS en direct, fermeture automatique de boucle et capture de territoire.",
      },
    ],
  }),
  component: PlayView,
});

function PlayView() {
  const { teamId } = Route.useParams();
  const [gameId, setGameId] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [track, setTrack] = useState<[number, number][]>([]);
  const [distance, setDistance] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [geoError, setGeoError] = useState<string | null>(null);

  const runningRef = useRef(false);
  const trackRef = useRef<[number, number][]>([]);
  const distRef = useRef(0);
  const lastSync = useRef(0);
  const closing = useRef(false);

  useEffect(() => {
    let active = true;
    void supabase
      .from("teams")
      .select("game_id")
      .eq("id", teamId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        if (!data) setMissing(true);
        else setGameId(data.game_id);
      });
    return () => {
      active = false;
    };
  }, [teamId]);

  const { game, teams, territories } = useGameState(gameId);
  const me = teams.find((t) => t.id === teamId) ?? null;
  const myColor = me?.color ?? "#e63946";

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const closeLoop = useCallback(async () => {
    if (closing.current || !gameId) return;
    closing.current = true;
    const poly = polygonFromTrack(trackRef.current);
    runningRef.current = false;
    setRunning(false);
    if (!poly) {
      toast.error("Boucle invalide, réessayez.");
    } else {
      try {
        const captured = await captureTerritory(gameId, teamId, poly);
        toast.success(`Territoire capturé : ${formatArea(captured)} !`);
      } catch {
        toast.error("La capture a échoué.");
      }
    }
    trackRef.current = [];
    distRef.current = 0;
    setTrack([]);
    setDistance(0);
    closing.current = false;
  }, [gameId, teamId]);

  const onPosition = useCallback(
    (p: GeolocationPosition) => {
      const point: [number, number] = [p.coords.latitude, p.coords.longitude];
      setPos(point);
      setAccuracy(p.coords.accuracy);
      setGeoError(null);

      if (Date.now() - lastSync.current > 3000) {
        lastSync.current = Date.now();
        void supabase
          .from("teams")
          .update({ lat: point[0], lng: point[1], updated_at: new Date().toISOString() })
          .eq("id", teamId);
      }

      if (!runningRef.current) return;
      const trackNow = trackRef.current;
      const last = trackNow[trackNow.length - 1];
      if (last) {
        const step = haversine(last, point);
        if (step < 4) return;
        distRef.current += step;
        setDistance(distRef.current);
      }
      trackRef.current = [...trackNow, point];
      setTrack(trackRef.current);

      const start = trackRef.current[0]!;
      if (
        distRef.current >= MIN_LOOP_DISTANCE_M &&
        haversine(start, point) <= CLOSE_RADIUS_M &&
        trackRef.current.length >= 4
      ) {
        void closeLoop();
      }
    },
    [teamId, closeLoop],
  );

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("GPS indisponible sur cet appareil.");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      onPosition,
      (err) => setGeoError(err.message || "Position GPS refusée."),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [onPosition]);

  const mapTerritories = useMemo(
    () =>
      territories.map((t) => ({
        id: t.id,
        color: teams.find((x) => x.id === t.team_id)?.color ?? "#888888",
        geometry: t.geometry,
      })),
    [territories, teams],
  );

  const remaining = game?.ends_at ? (new Date(game.ends_at).getTime() - now) / 1000 : null;
  const finished = game?.status === "finished" || (remaining !== null && remaining <= 0);

  const toStart = track[0] && pos ? haversine(track[0], pos) : null;

  function startLoop() {
    if (!pos) {
      toast.error("En attente du signal GPS…");
      return;
    }
    trackRef.current = [pos];
    distRef.current = 0;
    runningRef.current = true;
    setTrack([pos]);
    setDistance(0);
    setRunning(true);
    toast.success("Boucle lancée ! Reviens à ton point de départ.");
  }

  function abortLoop() {
    runningRef.current = false;
    trackRef.current = [];
    distRef.current = 0;
    setRunning(false);
    setTrack([]);
    setDistance(0);
  }

  if (missing) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="text-lg">Équipe introuvable. Rejoignez à nouveau la partie.</p>
      </main>
    );
  }

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden">
      <div className="absolute inset-0">
        <MapCanvas
          center={pos}
          teams={teams}
          territories={mapTerritories}
          trail={track}
          trailColor={myColor}
          follow
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1000] flex items-start justify-between gap-2 p-3">
        <div className="panel px-3 py-2">
          <div className="flex items-center gap-2">
            <span
              className="h-5 w-5 rounded-full border-2 border-foreground"
              style={{ backgroundColor: myColor }}
            />
            <span className="text-lg font-bold">{me?.name ?? "…"}</span>
          </div>
          <div className="display text-xl">{formatArea(me?.score_m2 ?? 0)}</div>
        </div>
        <div className="panel px-3 py-2 text-right">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Temps
          </div>
          <div className="display text-2xl tabular-nums">
            {remaining === null ? "--:--" : formatClock(remaining)}
          </div>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 z-[1000] flex flex-col gap-3 p-3">
        {geoError && (
          <div className="panel px-4 py-3 text-sm font-semibold text-destructive">
            {geoError}
          </div>
        )}

        {running && (
          <div className="panel flex items-center justify-between px-4 py-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Distance
              </div>
              <div className="display text-2xl tabular-nums">{Math.round(distance)} m</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Retour au départ
              </div>
              <div className="display text-2xl tabular-nums">
                {toStart === null ? "—" : `${Math.round(toStart)} m`}
              </div>
            </div>
          </div>
        )}

        {!running && (
          <div className="panel flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
            <Crosshair className="h-4 w-4" />
            {accuracy ? `Précision GPS ±${Math.round(accuracy)} m` : "Recherche du GPS…"}
          </div>
        )}

        {finished ? (
          <div className="btn-huge btn-huge-dark">Partie terminée</div>
        ) : running ? (
          <button className="btn-huge" onClick={abortLoop}>
            <Square className="h-6 w-6" /> Annuler ma boucle
          </button>
        ) : (
          <button className="btn-huge btn-huge-accent" onClick={startLoop} disabled={!pos}>
            <Flag className="h-6 w-6" /> Commencer ma boucle
          </button>
        )}
      </div>
    </main>
  );
}
