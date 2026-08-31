import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Crosshair, Flag, HelpCircle, MessageCircle, Send, Square, X } from "lucide-react";
import { RulesIntro } from "@/components/RulesIntro";
import { LoopSummary, type LoopSummaryData } from "@/components/LoopSummary";
import { ScoreStrip } from "@/components/ScoreStrip";
import { GeoPermissionHelp } from "@/components/GeoPermissionHelp";
import { FinalResults } from "@/components/FinalResults";

import { supabase } from "@/integrations/supabase/client";
import { MapCanvas } from "@/components/MapCanvas";
import { useGameState } from "@/lib/useGameState";
import {
  CLOSE_RADIUS_M,
  DEFAULT_RUNNING_BONUS_SPEED_KMH,
  DEFAULT_VEHICLE_PENALTY_M2,
  DEFAULT_VEHICLE_SPEED_THRESHOLD_KMH,
  FORBIDDEN_PENALTY_COOLDOWN_MS,
  MIN_LOOP_DISTANCE_M,
  VEHICLE_SUSTAINED_MS,
  formatArea,
  formatClock,
  formatCountdown,
  haversine,
  kmhToMs,
} from "@/lib/conquete";
import { captureTerritory, polygonFromTrack } from "@/lib/capture";
import { sendTeamMessage, useMessages } from "@/lib/messages";
import {
  notifyMessage,
  notifyUrgent,
  primeAlertSound,
  requestNotificationPermission,
} from "@/lib/notify";
import { PhotoRequestCard } from "@/components/PhotoRequestCard";
import { checkLandmarkClaims, isLandmarkActive, useLandmarks } from "@/lib/landmarks";
import { applyPenalty, useForbiddenZones } from "@/lib/forbiddenZones";
import { checkGraceArrival, resolveGraceStatus } from "@/lib/grace";
import { GeoKalmanFilter } from "@/lib/geoFilter";
import { SpeedTracker } from "@/lib/speed";
import { CtfPlayView } from "@/components/CtfPlayView";
import { GridPlayView } from "@/components/GridPlayView";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useMotionHint } from "@/hooks/useMotionHint";

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

  const { game } = useGameState(gameId);

  if (missing) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="text-lg">Équipe introuvable. Rejoignez à nouveau la partie.</p>
      </main>
    );
  }
  if (!gameId || !game) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-center">
        <p className="text-lg text-muted-foreground">Chargement…</p>
      </main>
    );
  }
  if (game.mode === "capture_drapeau") {
    return <CtfPlayView gameId={gameId} teamId={teamId} />;
  }
  if (game.mode === "grille") {
    return <GridPlayView gameId={gameId} teamId={teamId} />;
  }
  return <TerritoryPlayView gameId={gameId} teamId={teamId} />;
}

function TerritoryPlayView({ gameId, teamId }: { gameId: string; teamId: string }) {
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [track, setTrack] = useState<[number, number][]>([]);
  const [distance, setDistance] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoDenied, setGeoDenied] = useState(false);

  const runningRef = useRef(false);
  const trackRef = useRef<[number, number][]>([]);
  const distRef = useRef(0);
  const loopStartRef = useRef(0);
  const lastSync = useRef(0);
  const closing = useRef(false);
  const instSpeedRef = useRef(0);
  const lastPosRef = useRef<{ point: [number, number]; t: number } | null>(null);
  const totalDistanceRef = useRef(0);
  const totalDistanceInitRef = useRef(false);
  const speedTrackerRef = useRef(new SpeedTracker());
  // Scores freeze the instant the timer hits zero: during the return grace
  // period players are still moving, but nothing they do may change the board.
  const finishedRef = useRef(false);
  const vehicleAboveSinceRef = useRef<number | null>(null);
  const geoFilterRef = useRef(new GeoKalmanFilter());
  const { movingRef, needsPermission, requestPermission } = useMotionHint();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatBody, setChatBody] = useState("");
  const seenMessageCount = useRef<number | null>(null);
  const [unread, setUnread] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [summary, setSummary] = useState<LoopSummaryData | null>(null);
  const [followMe, setFollowMe] = useState(true);
  const [resultsOpen, setResultsOpen] = useState(false);

  const rulesKey = `conquete:rules-seen:${teamId}`;
  useEffect(() => {
    if (!localStorage.getItem(rulesKey)) setRulesOpen(true);
  }, [rulesKey]);

  function closeRules() {
    localStorage.setItem(rulesKey, "1");
    setRulesOpen(false);
  }

  useEffect(() => {
    requestNotificationPermission();
    // Mobile browsers only allow sound after a user gesture: arm it on the
    // first tap so later alerts are audible even with the screen in a pocket.
    const arm = () => primeAlertSound();
    window.addEventListener("pointerdown", arm, { once: true });
    return () => window.removeEventListener("pointerdown", arm);
  }, []);

  const { game, teams, territories } = useGameState(gameId);
  const gameRef = useRef(game);
  gameRef.current = game;
  const { messages } = useMessages(gameId);
  const { landmarks } = useLandmarks(gameId);
  const landmarksRef = useRef(landmarks);
  landmarksRef.current = landmarks;
  const { zones: forbiddenZones } = useForbiddenZones(gameId);
  const forbiddenZonesRef = useRef(forbiddenZones);
  forbiddenZonesRef.current = forbiddenZones;
  const lastPenalizedRef = useRef<Map<string, number>>(new Map());
  const me = teams.find((t) => t.id === teamId) ?? null;
  const myColor = me?.color ?? "#e63946";
  const meRef = useRef(me);
  meRef.current = me;

  useEffect(() => {
    if (!totalDistanceInitRef.current && me) {
      totalDistanceRef.current = me.total_distance_m;
      totalDistanceInitRef.current = true;
    }
  }, [me]);

  const myMessages = useMemo(
    () =>
      messages.filter((m) => (m.sender === "prof" && m.team_id === null) || m.team_id === teamId),
    [messages, teamId],
  );

  useEffect(() => {
    if (seenMessageCount.current === null) {
      seenMessageCount.current = myMessages.length;
      return;
    }
    if (myMessages.length > seenMessageCount.current) {
      const latest = myMessages[myMessages.length - 1];
      if (latest?.sender === "prof") {
        toast(`💬 Prof : ${latest.body}`);
        notifyUrgent("💬 Message du prof", latest.body);
        if (!chatOpen) setUnread(true);
      } else if (latest?.sender === "system") {
        toast.error(latest.body, { duration: 8000 });
        notifyUrgent("⚠️ Territoire perdu !", latest.body);
      }
    }
    seenMessageCount.current = myMessages.length;
  }, [myMessages, chatOpen]);

  async function sendChat() {
    if (!gameId || !chatBody.trim()) return;
    const body = chatBody.trim();
    setChatBody("");
    try {
      await sendTeamMessage(gameId, teamId, body);
    } catch {
      toast.error("Message non envoyé.");
    }
  }

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const closeLoop = useCallback(async () => {
    if (closing.current || !gameId) return;
    closing.current = true;
    if (finishedRef.current) {
      runningRef.current = false;
      setRunning(false);
      toast("⏱️ Partie terminée — cette boucle ne compte plus.");
      closing.current = false;
      return;
    }
    const poly = polygonFromTrack(trackRef.current);
    runningRef.current = false;
    setRunning(false);
    if (!poly) {
      toast.error("Boucle invalide, réessayez.");
    } else {
      try {
        const elapsedS = (Date.now() - loopStartRef.current) / 1000;
        const avgSpeedMs = elapsedS > 0 ? distRef.current / elapsedS : 0;
        const loopTrack = [...trackRef.current];
        const loopDistance = distRef.current;
        const result = await captureTerritory(gameId, teamId, poly, avgSpeedMs, {
          enabled: gameRef.current?.running_bonus_enabled ?? true,
          speedMs: kmhToMs(
            gameRef.current?.running_bonus_speed_kmh ?? DEFAULT_RUNNING_BONUS_SPEED_KMH,
          ),
        });
        const { data: teamRow } = await supabase
          .from("teams")
          .select("score_m2")
          .eq("id", teamId)
          .maybeSingle();
        setSummary({
          area: result.area,
          durationS: elapsedS,
          distanceM: loopDistance,
          ran: result.ran,
          track: loopTrack,
          totalM2: teamRow?.score_m2 ?? 0,
        });
        toast.success(
          `Territoire capturé : ${formatArea(result.area)} !${result.ran ? " 🏃 Bonus course !" : ""}`,
        );
        for (const v of result.victims) {
          toast(`🏴 Vous avez pris ${formatArea(v.areaM2)} à ${v.name} !`);
        }
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
      const point: [number, number] = geoFilterRef.current.update(
        p.coords.latitude,
        p.coords.longitude,
        p.coords.accuracy || 15,
        Date.now(),
        movingRef.current,
      );
      setPos(point);
      setAccuracy(p.coords.accuracy);
      setGeoError(null);

      // Speed comes from a tracker that discards imprecise fixes and smooths
      // the rest, so a single GPS glitch can never trigger a vehicle penalty.
      instSpeedRef.current = speedTrackerRef.current.update(
        point,
        p.coords.accuracy ?? null,
        p.coords.speed ?? null,
        Date.now(),
        haversine,
      );

      // Separate, simpler jitter filter for the lifetime distance stat — it
      // doesn't need SpeedTracker's full smoothing, just to reject samples
      // too close together in time/space to be real movement.
      const prevPos = lastPosRef.current;
      const nowMs = Date.now();
      if (prevPos) {
        const dt = (nowMs - prevPos.t) / 1000;
        const dist = haversine(prevPos.point, point);
        if (dt > 0.5 && dist > 2) {
          lastPosRef.current = { point, t: nowMs };
          if (gameRef.current?.status === "running") {
            totalDistanceRef.current += dist;
          }
        }
      } else {
        lastPosRef.current = { point, t: nowMs };
      }

      if (Date.now() - lastSync.current > 3000) {
        lastSync.current = Date.now();
        void supabase
          .from("teams")
          .update({
            lat: point[0],
            lng: point[1],
            current_trail: trackRef.current,
            total_distance_m: totalDistanceRef.current,
            updated_at: new Date().toISOString(),
          })
          .eq("id", teamId);
      }

      if (gameRef.current) {
        checkGraceArrival(gameRef.current, teamId, meRef.current?.returned_at != null, point);
      }

      // Position (above) and grace-return detection (just above) keep
      // running regardless of status — the grace window only exists once
      // the game has moved past "running" — but nothing below should score
      // or penalize before the professor starts the game, or once it's over
      // (finishedRef also catches the client-side countdown hitting zero
      // slightly before games.status has actually flipped to "finished").
      if (gameRef.current?.status !== "running" || finishedRef.current) return;

      if (landmarksRef.current.some((l) => !l.claimed_by_team_id)) {
        void checkLandmarkClaims(
          landmarksRef.current,
          teamId,
          point,
          gameRef.current?.started_at ?? null,
        ).then((won) => {
          if (!won) return;
          if (won.kind === "shield") {
            toast.success(`${won.icon} Bouclier activé ! Immunité ${won.shield_duration_s}s.`);
            notifyMessage(`${won.icon} Bouclier !`, `Immunité ${won.shield_duration_s}s`);
          } else {
            toast.success(`${won.icon} Repère bonus capturé : +${formatArea(won.bonus_m2)} !`);
            notifyMessage(`${won.icon} Repère bonus !`, `+${formatArea(won.bonus_m2)}`);
          }
        });
      }

      for (const zone of forbiddenZonesRef.current) {
        if (haversine(point, [zone.lat, zone.lng]) > zone.radius_m) continue;
        const last = lastPenalizedRef.current.get(zone.id) ?? 0;
        if (Date.now() - last < FORBIDDEN_PENALTY_COOLDOWN_MS) continue;
        if (gameRef.current?.forbidden_zone_running_only) {
          const speedMs = kmhToMs(
            gameRef.current.running_bonus_speed_kmh ?? DEFAULT_RUNNING_BONUS_SPEED_KMH,
          );
          if (instSpeedRef.current < speedMs) continue;
        }
        lastPenalizedRef.current.set(zone.id, Date.now());
        void applyPenalty(zone, teamId).then(() => {
          toast.error(`⚠️ Zone interdite ! -${formatArea(zone.penalty_m2)}`);
          notifyMessage("⚠️ Zone interdite !", `-${formatArea(zone.penalty_m2)}`);
        });
      }

      if (gameRef.current && !gameRef.current.vehicle_allowed) {
        const thresholdKmh =
          gameRef.current.vehicle_speed_threshold_kmh ?? DEFAULT_VEHICLE_SPEED_THRESHOLD_KMH;
        if (instSpeedRef.current >= kmhToMs(thresholdKmh)) {
          vehicleAboveSinceRef.current ??= Date.now();
          const lastVehiclePenalty = lastPenalizedRef.current.get("__vehicle__") ?? 0;
          if (
            Date.now() - vehicleAboveSinceRef.current >= VEHICLE_SUSTAINED_MS &&
            Date.now() - lastVehiclePenalty >= FORBIDDEN_PENALTY_COOLDOWN_MS
          ) {
            lastPenalizedRef.current.set("__vehicle__", Date.now());
            const penaltyM2 = gameRef.current.vehicle_penalty_m2 ?? DEFAULT_VEHICLE_PENALTY_M2;
            void applyPenalty({ game_id: gameId, penalty_m2: penaltyM2 }, teamId).then(() => {
              toast.error(`🚴 Vitesse suspecte détectée ! -${formatArea(penaltyM2)}`);
              notifyMessage("🚴 Vitesse suspecte !", `-${formatArea(penaltyM2)}`);
            });
          }
        } else {
          vehicleAboveSinceRef.current = null;
        }
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
      (err) => {
        setGeoError(err.message || "Position GPS refusée.");
        if (err.code === err.PERMISSION_DENIED) setGeoDenied(true);
      },
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

  const mapLandmarks = useMemo(
    () =>
      landmarks
        .filter((l) => isLandmarkActive(l, game?.started_at ?? null, now))
        .map((l) => ({ id: l.id, lat: l.lat, lng: l.lng, icon: l.icon, kind: l.kind })),
    [landmarks, game?.started_at, now],
  );

  const mapForbiddenZones = useMemo(
    () => forbiddenZones.map((z) => ({ id: z.id, lat: z.lat, lng: z.lng, radiusM: z.radius_m })),
    [forbiddenZones],
  );

  const scoreStripTeams = useMemo(
    () => teams.map((tm) => ({ id: tm.id, name: tm.name, color: tm.color, score: tm.score_m2 })),
    [teams],
  );

  const returnZone = useMemo(
    () =>
      game?.return_lat != null && game.return_lng != null
        ? { lat: game.return_lat, lng: game.return_lng, radiusM: game.return_radius_m }
        : null,
    [game?.return_lat, game?.return_lng, game?.return_radius_m],
  );
  const toZone = pos && returnZone ? haversine(pos, [returnZone.lat, returnZone.lng]) : null;

  const remaining = game?.ends_at ? (new Date(game.ends_at).getTime() - now) / 1000 : null;
  const finished = game?.status === "finished" || (remaining !== null && remaining <= 0);

  finishedRef.current = finished;
  useWakeLock(!finished);

  const prevFinishedRef = useRef(finished);
  useEffect(() => {
    if (finished && !prevFinishedRef.current) {
      toast.success("🏁 Partie terminée !");
      notifyUrgent("🏁 Partie terminée !", "Regardez le classement final !");
    }
    prevFinishedRef.current = finished;
  }, [finished]);

  const graceStatus = game && me ? resolveGraceStatus(game, me, now) : null;
  const endgameLabel = !game?.grace_ends_at
    ? !returnZone
      ? "Partie terminée"
      : me?.validated
        ? "Partie terminée — territoire validé !"
        : "Partie terminée — territoire non comptabilisé (hors zone)"
    : graceStatus?.remainingS != null
      ? `⏳ Revenez dans la zone avant : ${formatClock(graceStatus.remainingS)}`
      : graceStatus?.validated
        ? "Partie terminée — territoire validé !"
        : "Partie terminée — territoire non comptabilisé (retour hors délai)";

  const toStart = track[0] && pos ? haversine(track[0], pos) : null;

  function startLoop() {
    if (!pos) {
      toast.error("En attente du signal GPS…");
      return;
    }
    trackRef.current = [pos];
    distRef.current = 0;
    loopStartRef.current = Date.now();
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

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden">
      <div className="absolute inset-0">
        <MapCanvas
          center={pos}
          teams={teams}
          territories={mapTerritories}
          trail={track}
          trailColor={myColor}
          returnZone={returnZone}
          landmarks={mapLandmarks}
          forbiddenZones={mapForbiddenZones}
          mapStyle={game?.map_style}
          follow={followMe}
          onUserPan={() => setFollowMe(false)}
          onRecenter={() => setFollowMe(true)}
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
              style={{ backgroundColor: myColor }}
            />
            <span className="truncate text-lg font-bold">{me?.name ?? "…"}</span>
          </div>
          <div className="display text-xl">{formatArea(me?.score_m2 ?? 0)}</div>
          <div className="label-xs">Total conquis · {formatArea(me?.total_captured_m2 ?? 0)}</div>
          {!!me?.penalty_m2 && (
            <div className="label-xs text-destructive">
              Pénalités · -{formatArea(me.penalty_m2)}
            </div>
          )}
        </div>
        <div className="hud-badge shrink-0 px-3 py-2 text-right">
          <div className="label-xs">Temps</div>
          <div className="display text-2xl tabular-nums">
            {remaining === null ? "--:--" : formatCountdown(remaining)}
          </div>
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-x-3 z-[999]"
        style={{ top: "max(6.5rem, calc(env(safe-area-inset-top) + 4.25rem))" }}
      >
        <ScoreStrip teams={scoreStripTeams} myTeamId={teamId} formatScore={formatArea} />
      </div>

      <button
        aria-label="Messages"
        className="hud-badge pointer-events-auto absolute right-3 z-[1000] flex h-12 w-12 items-center justify-center"
        style={{ top: "max(12rem, calc(env(safe-area-inset-top) + 9.5rem))" }}
        onClick={() => {
          setChatOpen(true);
          setUnread(false);
        }}
      >
        <MessageCircle className="h-6 w-6" />
        {unread && (
          <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-destructive" />
        )}
      </button>

      <button
        aria-label="Règles et consignes"
        className="hud-badge pointer-events-auto absolute right-3 z-[1000] flex h-12 w-12 items-center justify-center"
        style={{ top: "max(16rem, calc(env(safe-area-inset-top) + 13.5rem))" }}
        onClick={() => setRulesOpen(true)}
      >
        <HelpCircle className="h-6 w-6" />
      </button>

      {chatOpen && (
        <div
          className="sheet pointer-events-auto absolute inset-x-0 bottom-0 z-[1100] flex max-h-[70vh] flex-col gap-3 p-4"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <div className="flex items-center justify-between">
            <span className="section-title">
              <MessageCircle className="h-4 w-4" /> Messages avec le prof
            </span>
            <button className="icon-btn" aria-label="Fermer" onClick={() => setChatOpen(false)}>
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
            {myMessages.length === 0 && (
              <p className="py-2 text-center text-sm text-muted-foreground">Aucun message.</p>
            )}
            {myMessages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                  m.sender === "prof"
                    ? "bg-secondary text-secondary-foreground"
                    : "self-end bg-primary/20"
                }`}
              >
                <div className="label-xs">{m.sender === "prof" ? "Prof" : "Vous"}</div>
                <div>{m.body}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              className="field"
              placeholder="Votre message au prof..."
              value={chatBody}
              onChange={(e) => setChatBody(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void sendChat()}
            />
            <button
              aria-label="Envoyer"
              className="icon-btn h-12 w-12 shrink-0 bg-primary text-primary-foreground"
              onClick={sendChat}
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}

      <div
        className="absolute inset-x-0 bottom-0 z-[1000] mx-auto flex w-full max-w-md flex-col gap-2.5 p-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        {geoError && !geoDenied && (
          <div className="panel px-4 py-3 text-sm font-semibold text-destructive">{geoError}</div>
        )}

        {needsPermission && (
          <button
            className="panel flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold"
            onClick={() => void requestPermission()}
          >
            <Crosshair className="h-4 w-4" /> Activer la précision GPS avancée
          </button>
        )}

        {running && (
          <div className="grid grid-cols-2 gap-2">
            <div className="stat">
              <span className="label-xs">Distance</span>
              <span className="stat-value text-2xl">{Math.round(distance)} m</span>
            </div>
            <div className="stat text-right">
              <span className="label-xs">Retour au départ</span>
              <span className="stat-value text-2xl">
                {toStart === null ? "—" : `${Math.round(toStart)} m`}
              </span>
            </div>
          </div>
        )}

        {!running && (
          <div className="panel flex items-center gap-2 px-4 py-2">
            <Crosshair className="h-4 w-4 shrink-0 text-accent" />
            <span className="label-xs">
              {pos
                ? `Signal GPS OK${accuracy ? ` · ±${Math.round(accuracy)} m` : ""}`
                : "Recherche du GPS…"}
            </span>
          </div>
        )}

        <PhotoRequestCard
          gameId={gameId}
          teamId={teamId}
          requestedAt={game?.photo_requested_at}
          photoDeadline={game?.photo_deadline}
          nowMs={now}
        />

        {returnZone && (!finished || graceStatus?.remainingS != null) && (
          <div className="panel flex items-center justify-between gap-3 px-4 py-3">
            <span className="label-xs">Zone de retour</span>
            <span className="display text-xl tabular-nums">
              {toZone === null ? "—" : `${Math.round(toZone)} m`}
            </span>
          </div>
        )}

        {finished ? (
          <>
            <button className="btn-huge btn-huge-accent" onClick={() => setResultsOpen(true)}>
              🏁 Voir le classement final
            </button>
            <div className="panel px-4 py-2 text-center text-sm">{endgameLabel}</div>
          </>
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

      {rulesOpen && (
        <RulesIntro
          teamName={me?.name ?? null}
          teamColor={myColor}
          hasReturnZone={!!returnZone}
          onClose={closeRules}
        />
      )}

      {summary && <LoopSummary data={summary} color={myColor} onClose={() => setSummary(null)} />}

      {geoDenied && <GeoPermissionHelp onDismiss={() => setGeoDenied(false)} />}

      {resultsOpen && (
        <FinalResults
          teams={scoreStripTeams}
          myTeamId={teamId}
          formatScore={formatArea}
          statusLabel={endgameLabel}
          onClose={() => setResultsOpen(false)}
        />
      )}
    </main>
  );
}
