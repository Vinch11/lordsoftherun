import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Crosshair, Grid3x3, MessageCircle, Send, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MapCanvas } from "@/components/MapCanvas";
import { ScoreStrip } from "@/components/ScoreStrip";
import { GeoPermissionHelp } from "@/components/GeoPermissionHelp";
import { FinalResults } from "@/components/FinalResults";
import { PhotoRequestCard } from "@/components/PhotoRequestCard";
import { useGameState } from "@/lib/useGameState";
import {
  DEFAULT_RUNNING_BONUS_SPEED_KMH,
  DEFAULT_VEHICLE_PENALTY_M2,
  DEFAULT_VEHICLE_SPEED_THRESHOLD_KMH,
  FORBIDDEN_PENALTY_COOLDOWN_MS,
  VEHICLE_SUSTAINED_MS,
  formatArea,
  formatCountdown,
  haversine,
  kmhToMs,
  withTimeout,
} from "@/lib/conquete";
import { sendTeamMessage, useMessages } from "@/lib/messages";
import {
  armAlertSound,
  notifyMessage,
  notifyUrgent,
  requestNotificationPermission,
  setNotificationSound,
} from "@/lib/notify";
import {
  awardRunningBonusCell,
  cellCenter,
  claimGridCell,
  isWithinGridZone,
  pointToCell,
  useGridCells,
} from "@/lib/grid";
import { applyPenalty } from "@/lib/forbiddenZones";
import { checkGraceArrival, resolveGraceStatus } from "@/lib/grace";
import { GeoKalmanFilter } from "@/lib/geoFilter";
import { SpeedTracker } from "@/lib/speed";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useMotionHint } from "@/hooks/useMotionHint";

export function GridPlayView({ gameId, teamId }: { gameId: string; teamId: string }) {
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoDenied, setGeoDenied] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [chatBody, setChatBody] = useState("");
  const [unread, setUnread] = useState(false);
  const [followMe, setFollowMe] = useState(true);
  const [speedKmh, setSpeedKmh] = useState(0);

  const lastSync = useRef(0);
  const syncFailWarnedRef = useRef(false);
  const seenMessageCount = useRef<number | null>(null);
  const lastClaimedCellRef = useRef<string | null>(null);
  const instSpeedRef = useRef(0);
  const lastPosRef = useRef<{ point: [number, number]; t: number } | null>(null);
  const totalDistanceRef = useRef(0);
  const totalDistanceInitRef = useRef(false);
  const speedTrackerRef = useRef(new SpeedTracker());
  // Scores freeze the instant the timer hits zero: during the return grace
  // period players are still moving, but nothing they do may change the board.
  const finishedRef = useRef(false);
  const vehicleAboveSinceRef = useRef<number | null>(null);
  const lastVehiclePenaltyRef = useRef(0);
  const geoFilterRef = useRef(new GeoKalmanFilter());
  const { movingRef, needsPermission, requestPermission } = useMotionHint();

  useEffect(() => {
    requestNotificationPermission();
    return armAlertSound();
  }, []);

  const { game, teams } = useGameState(gameId);
  const gameRef = useRef(game);
  gameRef.current = game;
  useEffect(() => setNotificationSound(game?.notification_sound), [game?.notification_sound]);
  const { messages } = useMessages(gameId);
  const { cells } = useGridCells(gameId);
  const cellsRef = useRef(cells);
  cellsRef.current = cells;

  const me = teams.find((t) => t.id === teamId) ?? null;
  const meRef = useRef(me);
  meRef.current = me;
  const myColor = me?.color ?? "#e63946";

  useEffect(() => {
    if (!totalDistanceInitRef.current && me) {
      totalDistanceRef.current = me.total_distance_m;
      totalDistanceInitRef.current = true;
    }
  }, [me]);
  const myCellCount = useMemo(
    () => cells.filter((c) => c.owner_team_id === teamId).length,
    [cells, teamId],
  );

  const scoreStripTeams = useMemo(() => {
    const cellCountByTeam = new Map<string, number>();
    for (const c of cells) {
      cellCountByTeam.set(c.owner_team_id, (cellCountByTeam.get(c.owner_team_id) ?? 0) + 1);
    }
    return teams.map((tm) => ({
      id: tm.id,
      name: tm.name,
      color: tm.color,
      score: Math.max(
        0,
        (cellCountByTeam.get(tm.id) ?? 0) + (tm.landmark_bonus_m2 ?? 0) - tm.penalty_m2,
      ),
    }));
  }, [cells, teams]);
  const formatCellScore = (n: number) => `${Math.round(n)} case${Math.round(n) > 1 ? "s" : ""}`;

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
      }
    }
    seenMessageCount.current = myMessages.length;
  }, [myMessages, chatOpen]);

  async function sendChat() {
    if (!chatBody.trim()) return;
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

  const gridCenter = useMemo<[number, number] | null>(
    () =>
      game?.grid_center_lat != null && game.grid_center_lng != null
        ? [game.grid_center_lat, game.grid_center_lng]
        : null,
    [game?.grid_center_lat, game?.grid_center_lng],
  );
  const gridCenterRef = useRef(gridCenter);
  gridCenterRef.current = gridCenter;
  const gridRadiusRef = useRef(game?.grid_radius_m ?? 40);
  gridRadiusRef.current = game?.grid_radius_m ?? 40;
  const gridShapeRef = useRef(game?.grid_shape ?? "circle");
  gridShapeRef.current = game?.grid_shape ?? "circle";
  const gridWidthRef = useRef(game?.grid_width_m ?? 80);
  gridWidthRef.current = game?.grid_width_m ?? 80;
  const gridHeightRef = useRef(game?.grid_height_m ?? 80);
  gridHeightRef.current = game?.grid_height_m ?? 80;
  const cellSizeRef = useRef(game?.grid_cell_size_m ?? 6);
  cellSizeRef.current = game?.grid_cell_size_m ?? 6;

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
      setSpeedKmh(instSpeedRef.current * 3.6);

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
        void withTimeout(
          supabase
            .from("teams")
            .update({
              lat: point[0],
              lng: point[1],
              total_distance_m: totalDistanceRef.current,
              updated_at: new Date().toISOString(),
            })
            .eq("id", teamId),
          8000,
        ).then(
          ({ error }) => {
            if (error && !syncFailWarnedRef.current) {
              syncFailWarnedRef.current = true;
              console.error("Échec de synchronisation de la position :", error);
              toast.error("Position non synchronisée — vérifiez votre connexion.", {
                duration: 8000,
              });
            } else if (!error) {
              syncFailWarnedRef.current = false;
            }
          },
          (err: unknown) => {
            if (!syncFailWarnedRef.current) {
              syncFailWarnedRef.current = true;
              console.error("Échec de synchronisation de la position :", err);
              toast.error("Position non synchronisée — vérifiez votre connexion.", {
                duration: 8000,
              });
            }
          },
        );
      }

      if (gameRef.current) {
        checkGraceArrival(gameRef.current, teamId, meRef.current?.returned_at != null, point);
      }

      // Position (above) and grace-return detection (just above) keep
      // running regardless of status — the grace window only exists once
      // the game has moved past "running" — but nothing below should score
      // or penalize before the professor actually starts the game.
      if (gameRef.current?.status !== "running") return;

      if (gameRef.current && !gameRef.current.vehicle_allowed) {
        const thresholdKmh =
          gameRef.current.vehicle_speed_threshold_kmh ?? DEFAULT_VEHICLE_SPEED_THRESHOLD_KMH;
        if (instSpeedRef.current >= kmhToMs(thresholdKmh)) {
          vehicleAboveSinceRef.current ??= Date.now();
          if (
            Date.now() - vehicleAboveSinceRef.current >= VEHICLE_SUSTAINED_MS &&
            Date.now() - lastVehiclePenaltyRef.current >= FORBIDDEN_PENALTY_COOLDOWN_MS
          ) {
            lastVehiclePenaltyRef.current = Date.now();
            const penaltyM2 = gameRef.current.vehicle_penalty_m2 ?? DEFAULT_VEHICLE_PENALTY_M2;
            void applyPenalty({ game_id: gameId, penalty_m2: penaltyM2 }, teamId, true).then(() => {
              toast.error(`🚴 Vitesse suspecte détectée ! -${formatArea(penaltyM2)}`);
              notifyMessage("🚴 Vitesse suspecte !", `-${formatArea(penaltyM2)}`);
            });
          }
        } else {
          vehicleAboveSinceRef.current = null;
        }
      }

      const center = gridCenterRef.current;
      if (!center) return;
      if (finishedRef.current) return; // board frozen at the final whistle
      if (
        !isWithinGridZone(
          gridShapeRef.current,
          center,
          point,
          gridRadiusRef.current,
          gridWidthRef.current,
          gridHeightRef.current,
        )
      )
        return;

      const minSpeedKmh = gameRef.current?.grid_min_speed_kmh ?? 0;
      if (minSpeedKmh > 0 && instSpeedRef.current < kmhToMs(minSpeedKmh)) return;

      const { row, col } = pointToCell(center, cellSizeRef.current, point);
      const key = `${row}:${col}`;
      if (lastClaimedCellRef.current === key) return;
      lastClaimedCellRef.current = key;
      const existing = cellsRef.current.find((c) => c.row === row && c.col === col);
      if (existing?.owner_team_id === teamId) return;
      const runningBonus =
        (gameRef.current?.running_bonus_enabled ?? true) &&
        instSpeedRef.current >=
          kmhToMs(gameRef.current?.running_bonus_speed_kmh ?? DEFAULT_RUNNING_BONUS_SPEED_KMH);
      void claimGridCell(gameId, teamId, row, col).then(() => {
        if (runningBonus) void awardRunningBonusCell(teamId);
      });
    },
    [teamId, gameId],
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

  const gridZone = useMemo(
    () =>
      gridCenter
        ? {
            lat: gridCenter[0],
            lng: gridCenter[1],
            shape: game?.grid_shape ?? "circle",
            radiusM: game?.grid_radius_m ?? 40,
            widthM: game?.grid_width_m ?? 80,
            heightM: game?.grid_height_m ?? 80,
          }
        : null,
    [gridCenter, game?.grid_radius_m, game?.grid_shape, game?.grid_width_m, game?.grid_height_m],
  );

  const mapGridCells = useMemo(() => {
    if (!gridCenter) return [];
    const cellSize = game?.grid_cell_size_m ?? 6;
    return cells.map((c) => {
      const [lat, lng] = cellCenter(gridCenter, cellSize, c.row, c.col);
      const owner = teams.find((t) => t.id === c.owner_team_id);
      return { id: c.id, lat, lng, sizeM: cellSize, color: owner?.color ?? "#888" };
    });
  }, [cells, gridCenter, game?.grid_cell_size_m, teams]);

  const remaining = game?.ends_at ? (new Date(game.ends_at).getTime() - now) / 1000 : null;
  const finished = game?.status === "finished" || (remaining !== null && remaining <= 0);
  const graceStatus = game && me ? resolveGraceStatus(game, me, now) : null;
  const returnZone = useMemo(
    () =>
      game?.return_lat != null && game.return_lng != null
        ? { lat: game.return_lat, lng: game.return_lng, radiusM: game.return_radius_m }
        : null,
    [game?.return_lat, game?.return_lng, game?.return_radius_m],
  );
  const toReturnZone = pos && returnZone ? haversine(pos, [returnZone.lat, returnZone.lng]) : null;
  const cellsLabel = `${myCellCount} case${myCellCount > 1 ? "s" : ""} contrôlée${myCellCount > 1 ? "s" : ""}`;
  const endgameLabel = !game?.grace_ends_at
    ? `Partie terminée — ${cellsLabel} !`
    : graceStatus?.remainingS != null
      ? `Partie terminée — ${cellsLabel} !`
      : graceStatus?.validated
        ? "Partie terminée — retour validé !"
        : "Partie terminée — retour hors délai";

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

  return (
    <main className="bib relative h-[100dvh] w-full overflow-hidden">
      <div className="absolute inset-0">
        <MapCanvas
          center={pos}
          teams={teams}
          territories={[]}
          gridZone={game?.grid_show_overlay === false ? null : gridZone}
          gridCells={game?.grid_show_overlay === false ? [] : mapGridCells}
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
          <div className="display flex items-center gap-1 text-xl">
            <Grid3x3 className="h-4 w-4" /> {myCellCount}
          </div>
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
        <ScoreStrip teams={scoreStripTeams} myTeamId={teamId} formatScore={formatCellScore} />
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

        {!gridZone && (
          <div className="panel px-4 py-3 text-sm font-semibold text-muted-foreground">
            En attente que le prof définisse la zone de jeu…
          </div>
        )}

        {!finished && (game?.grid_min_speed_kmh ?? 0) > 0 && (
          <div
            className={`panel flex items-center justify-between px-4 py-2 text-sm font-semibold ${
              speedKmh < (game?.grid_min_speed_kmh ?? 0) ? "text-destructive" : "text-accent"
            }`}
          >
            <span>Vitesse min. pour valider une case</span>
            <span className="display tabular-nums">
              {speedKmh.toFixed(1)} / {game?.grid_min_speed_kmh} km/h
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

        {finished && returnZone && graceStatus?.remainingS != null && (
          <div className="panel flex items-center justify-between gap-3 px-4 py-3 ring-2 ring-accent">
            <span className="text-sm font-semibold">⏳ Revenez dans la zone avant</span>
            <span className="display text-lg tabular-nums">
              {formatCountdown(graceStatus.remainingS)}
              {toReturnZone !== null && ` · ${Math.round(toReturnZone)} m`}
            </span>
          </div>
        )}

        {finished && (
          <button className="btn-huge btn-huge-accent" onClick={() => setResultsOpen(true)}>
            🏁 Voir le classement final
          </button>
        )}
        {finished && <div className="panel px-4 py-2 text-center text-sm">{endgameLabel}</div>}
      </div>

      {geoDenied && <GeoPermissionHelp onDismiss={() => setGeoDenied(false)} />}

      {resultsOpen && (
        <FinalResults
          teams={scoreStripTeams}
          myTeamId={teamId}
          formatScore={formatCellScore}
          statusLabel={endgameLabel}
          onClose={() => setResultsOpen(false)}
        />
      )}
    </main>
  );
}
