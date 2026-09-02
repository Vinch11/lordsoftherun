import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Crosshair, Flag, MessageCircle, Send, Shield, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MapCanvas } from "@/components/MapCanvas";
import { GeoPermissionHelp } from "@/components/GeoPermissionHelp";
import { FinalResults } from "@/components/FinalResults";
import { PhotoRequestCard } from "@/components/PhotoRequestCard";
import { ItemResultOverlay } from "@/components/ItemResultOverlay";
import { useGameState } from "@/lib/useGameState";
import {
  CIRCUIT_ITEM_ICONS,
  CIRCUIT_ITEM_LABELS,
  DEFAULT_CIRCUIT_BANANA_PENALTY_S,
  DEFAULT_CIRCUIT_BOOST_BONUS_S,
  DEFAULT_CIRCUIT_CAPTURE_RADIUS_M,
  DEFAULT_CIRCUIT_ITEM_COOLDOWN_S,
  DEFAULT_CIRCUIT_LIGHTNING_PENALTY_S,
  DEFAULT_VEHICLE_PENALTY_M2,
  DEFAULT_VEHICLE_SPEED_THRESHOLD_KMH,
  CIRCUIT_ITEM_RADIUS_M,
  FORBIDDEN_PENALTY_COOLDOWN_MS,
  VEHICLE_SUSTAINED_MS,
  formatArea,
  formatClock,
  formatCountdown,
  haversine,
  kmhToMs,
  withTimeout,
  type CircuitItemKind,
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
  advanceCircuitProgress,
  applyCircuitTimeAdjustment,
  circuitFormatRank,
  circuitRankMetric,
  dropBanana,
  removeBanana,
  setCircuitHeldItem,
  setCircuitShielded,
  tryTriggerBox,
  useBananas,
  useCheckpoints,
  useCircuitBoxes,
} from "@/lib/circuit";
import { applyPenalty } from "@/lib/forbiddenZones";
import { GeoKalmanFilter } from "@/lib/geoFilter";
import { SpeedTracker } from "@/lib/speed";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useMotionHint } from "@/hooks/useMotionHint";

export function CircuitPlayView({ gameId, teamId }: { gameId: string; teamId: string }) {
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
  const [itemResult, setItemResult] = useState<{ kind: CircuitItemKind; detail: string } | null>(
    null,
  );

  const lastSync = useRef(0);
  const syncFailWarnedRef = useRef(false);
  const seenMessageCount = useRef<number | null>(null);
  const instSpeedRef = useRef(0);
  const lastPosRef = useRef<{ point: [number, number]; t: number } | null>(null);
  const totalDistanceRef = useRef(0);
  const totalDistanceInitRef = useRef(false);
  const speedTrackerRef = useRef(new SpeedTracker());
  const finishedRef = useRef(false);
  const vehicleAboveSinceRef = useRef<number | null>(null);
  const lastVehiclePenaltyRef = useRef(0);
  const geoFilterRef = useRef(new GeoKalmanFilter());
  const { movingRef, needsPermission, requestPermission } = useMotionHint();

  // Optimistic local mirror of race progress, so the next GPS tick doesn't
  // re-trigger the same checkpoint/box while waiting for the DB round-trip.
  const raceInitRef = useRef(false);
  const nextCheckpointRef = useRef(0);
  const lapRef = useRef(0);
  const myFinishedRef = useRef(false);
  const heldItemRef = useRef<string | null>(null);
  const shieldedRef = useRef(false);
  const knownAdjustmentRef = useRef(0);
  const boxCooldownRef = useRef<Map<string, number>>(new Map());
  const bananaHitRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    requestNotificationPermission();
    return armAlertSound();
  }, []);

  const { game, teams } = useGameState(gameId);
  const gameRef = useRef(game);
  gameRef.current = game;
  useEffect(() => setNotificationSound(game?.notification_sound), [game?.notification_sound]);
  const { messages } = useMessages(gameId);
  const { checkpoints } = useCheckpoints(gameId);
  const checkpointsRef = useRef(checkpoints);
  checkpointsRef.current = checkpoints;
  const { boxes } = useCircuitBoxes(gameId);
  const boxesRef = useRef(boxes);
  boxesRef.current = boxes;
  const { bananas } = useBananas(gameId);
  const bananasRef = useRef(bananas);
  bananasRef.current = bananas;

  const me = teams.find((t) => t.id === teamId) ?? null;
  const meRef = useRef(me);
  meRef.current = me;
  const teamsRef = useRef(teams);
  teamsRef.current = teams;
  const myColor = me?.color ?? "#e63946";
  const checkpointCount = game?.circuit_checkpoint_count ?? checkpoints.length;
  const lapCount = game?.circuit_lap_count ?? 3;

  useEffect(() => {
    if (raceInitRef.current || !me) return;
    raceInitRef.current = true;
    totalDistanceRef.current = me.total_distance_m;
    nextCheckpointRef.current = me.circuit_next_checkpoint;
    lapRef.current = me.circuit_lap;
    myFinishedRef.current = me.circuit_finished_at != null;
    heldItemRef.current = me.circuit_held_item;
    shieldedRef.current = me.circuit_shielded;
    knownAdjustmentRef.current = me.circuit_time_adjustment_s;
  }, [me]);

  // A lightning bolt drawn by another team writes straight to our row — the
  // only way we find out is noticing our own adjustment jumped without us
  // having caused it ourselves (banana hits update knownAdjustmentRef too).
  useEffect(() => {
    if (!me || !raceInitRef.current) return;
    if (me.circuit_time_adjustment_s > knownAdjustmentRef.current) {
      const deltaS = me.circuit_time_adjustment_s - knownAdjustmentRef.current;
      knownAdjustmentRef.current = me.circuit_time_adjustment_s;
      setItemResult({ kind: "lightning", detail: `+${Math.round(deltaS)}s` });
      notifyUrgent("⚡ Frappé par la foudre !", `+${Math.round(deltaS)}s sur votre temps.`);
    } else {
      knownAdjustmentRef.current = me.circuit_time_adjustment_s;
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

  async function triggerBox(boxId: string) {
    if (!game) return;
    const cooldownS = game.circuit_item_cooldown_s ?? DEFAULT_CIRCUIT_ITEM_COOLDOWN_S;
    const kind = await tryTriggerBox(boxId, teamId, cooldownS);
    if (!kind) return;

    if (kind === "banana") {
      heldItemRef.current = "banana";
      void setCircuitHeldItem(teamId, "banana");
      setItemResult({ kind, detail: "Larguez-la où vous voulez" });
      notifyUrgent("🍌 Banane récupérée !", "Utilisez le bouton pour la larguer.");
      return;
    }
    if (kind === "shield") {
      shieldedRef.current = true;
      void setCircuitShielded(teamId, true);
      setItemResult({ kind, detail: "Bloque le prochain malus" });
      notifyUrgent("🛡️ Bouclier activé !", "Protège du prochain malus reçu.");
      return;
    }
    if (kind === "boost") {
      const bonusS = game.circuit_boost_bonus_s ?? DEFAULT_CIRCUIT_BOOST_BONUS_S;
      const newTotal = (meRef.current?.circuit_time_adjustment_s ?? 0) - bonusS;
      knownAdjustmentRef.current = newTotal;
      void applyCircuitTimeAdjustment(teamId, newTotal);
      setItemResult({ kind, detail: `-${bonusS}s` });
      notifyUrgent("🚀 Boost !", `-${bonusS}s sur votre temps.`);
      return;
    }
    // lightning: targets the current leader among the other teams.
    const penaltyS = game.circuit_lightning_penalty_s ?? DEFAULT_CIRCUIT_LIGHTNING_PENALTY_S;
    const others = teamsRef.current.filter((t) => t.id !== teamId);
    const leader = others.reduce<(typeof others)[number] | null>((best, t) => {
      const metric = circuitRankMetric(t, gameRef.current?.started_at ?? null);
      const bestMetric = best
        ? circuitRankMetric(best, gameRef.current?.started_at ?? null)
        : -Infinity;
      return metric > bestMetric ? t : best;
    }, null);
    if (!leader) {
      setItemResult({ kind, detail: "Personne à cibler" });
      return;
    }
    if (leader.circuit_shielded) {
      void setCircuitShielded(leader.id, false);
      setItemResult({ kind, detail: `${leader.name} avait un bouclier` });
      notifyUrgent("⚡ Foudre bloquée !", `${leader.name} avait un bouclier.`);
      return;
    }
    void applyCircuitTimeAdjustment(leader.id, leader.circuit_time_adjustment_s + penaltyS);
    setItemResult({ kind, detail: `${leader.name} +${penaltyS}s` });
    notifyUrgent("⚡ Foudre envoyée !", `${leader.name} : +${penaltyS}s.`);
  }

  async function dropHeldBanana() {
    if (!pos || heldItemRef.current !== "banana") return;
    heldItemRef.current = null;
    void setCircuitHeldItem(teamId, null);
    void dropBanana(gameId, teamId, pos[0], pos[1]);
    toast.success("🍌 Banane larguée.");
  }

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

      instSpeedRef.current = speedTrackerRef.current.update(
        point,
        p.coords.accuracy ?? null,
        p.coords.speed ?? null,
        Date.now(),
        haversine,
      );

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

      if (gameRef.current?.status !== "running") return;
      if (finishedRef.current || myFinishedRef.current) return;

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

      // Dropped bananas: anyone but the team that placed it can trigger one.
      const captureRadius =
        gameRef.current?.circuit_capture_radius_m ?? DEFAULT_CIRCUIT_CAPTURE_RADIUS_M;
      for (const b of bananasRef.current) {
        if (b.team_id === teamId || bananaHitRef.current.has(b.id)) continue;
        if (haversine(point, [b.lat, b.lng]) > CIRCUIT_ITEM_RADIUS_M) continue;
        bananaHitRef.current.add(b.id);
        void removeBanana(b.id);
        const penaltyS =
          gameRef.current?.circuit_banana_penalty_s ?? DEFAULT_CIRCUIT_BANANA_PENALTY_S;
        if (shieldedRef.current) {
          shieldedRef.current = false;
          void setCircuitShielded(teamId, false);
          setItemResult({ kind: "banana", detail: "Bouclier vous a protégé !" });
          notifyUrgent("🛡️ Bouclier !", "Votre bouclier vous a protégé d'une banane.");
        } else {
          const newTotal = (meRef.current?.circuit_time_adjustment_s ?? 0) + penaltyS;
          knownAdjustmentRef.current = newTotal;
          void applyCircuitTimeAdjustment(teamId, newTotal);
          setItemResult({ kind: "banana", detail: `+${penaltyS}s` });
          notifyUrgent("🍌 Banane !", `+${penaltyS}s sur votre temps.`);
        }
      }

      // Mystery boxes: independent per-team cooldown, never consumed.
      if (!heldItemRef.current) {
        for (const box of boxesRef.current) {
          if (haversine(point, [box.lat, box.lng]) > CIRCUIT_ITEM_RADIUS_M) continue;
          const cooldownS =
            gameRef.current?.circuit_item_cooldown_s ?? DEFAULT_CIRCUIT_ITEM_COOLDOWN_S;
          const localLast = boxCooldownRef.current.get(box.id) ?? 0;
          if (Date.now() - localLast < cooldownS * 1000) continue;
          boxCooldownRef.current.set(box.id, Date.now());
          void triggerBox(box.id);
          break;
        }
      }

      // Checkpoints, in order.
      const target = checkpointsRef.current.find((c) => c.seq_index === nextCheckpointRef.current);
      if (!target || checkpointCount < 2) return;
      const captureM =
        gameRef.current?.circuit_capture_radius_m ?? DEFAULT_CIRCUIT_CAPTURE_RADIUS_M;
      if (haversine(point, [target.lat, target.lng]) > captureM) return;

      const justCompleted = nextCheckpointRef.current;
      if (justCompleted === 0) {
        const newLap = lapRef.current + 1;
        lapRef.current = newLap;
        nextCheckpointRef.current = 1 % checkpointCount;
        const finished = newLap >= lapCount;
        myFinishedRef.current = finished;
        void advanceCircuitProgress(teamId, nextCheckpointRef.current, newLap, finished);
        if (finished) {
          toast.success("🏁 Vous avez terminé la course !");
          notifyUrgent("🏁 Course terminée !", "Regardez le classement final.");
        } else {
          toast.success(`🏁 Tour ${newLap}/${lapCount} !`);
          notifyUrgent("🏁 Nouveau tour !", `Tour ${newLap + 1}/${lapCount}`);
        }
      } else {
        nextCheckpointRef.current = (justCompleted + 1) % checkpointCount;
        void advanceCircuitProgress(teamId, nextCheckpointRef.current, lapRef.current, false);
        toast(`✅ Checkpoint ${justCompleted}/${checkpointCount - 1}`);
      }
    },
    [teamId, gameId, checkpointCount, lapCount],
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

  const mapCheckpoints = useMemo(
    () => checkpoints.map((c) => ({ id: c.id, lat: c.lat, lng: c.lng, seq: c.seq_index })),
    [checkpoints],
  );
  const mapBoxes = useMemo(() => boxes.map((b) => ({ id: b.id, lat: b.lat, lng: b.lng })), [boxes]);
  const mapBananas = useMemo(
    () => bananas.map((b) => ({ id: b.id, lat: b.lat, lng: b.lng })),
    [bananas],
  );

  const remaining = game?.ends_at ? (new Date(game.ends_at).getTime() - now) / 1000 : null;
  const finished = game?.status === "finished" || (remaining !== null && remaining <= 0);
  finishedRef.current = finished;
  useWakeLock(!finished && !myFinishedRef.current);

  const rankedTeams = useMemo(
    () =>
      [...teams].sort(
        (a, b) =>
          circuitRankMetric(b, game?.started_at ?? null) -
          circuitRankMetric(a, game?.started_at ?? null),
      ),
    [teams, game?.started_at],
  );
  const myPosition = rankedTeams.findIndex((t) => t.id === teamId) + 1;
  const formatRank = useMemo(() => circuitFormatRank(lapCount), [lapCount]);
  const finalResultsTeams = useMemo(
    () =>
      teams.map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        score: circuitRankMetric(t, game?.started_at ?? null),
      })),
    [teams, game?.started_at],
  );

  const prevFinishedRef = useRef(finished);
  useEffect(() => {
    if (finished && !prevFinishedRef.current) {
      toast.success("🏁 Partie terminée !");
      notifyUrgent("🏁 Partie terminée !", "Regardez le classement final !");
    }
    prevFinishedRef.current = finished;
  }, [finished]);

  const nextCheckpointDist =
    pos && checkpoints.length
      ? (() => {
          const target = checkpoints.find(
            (c) => c.seq_index === (me?.circuit_next_checkpoint ?? 0),
          );
          return target ? haversine(pos, [target.lat, target.lng]) : null;
        })()
      : null;

  return (
    <main className={`bib ${studentThemeClass(game?.student_theme)} relative h-[100dvh] w-full overflow-hidden`}>
      <div className="absolute inset-0">
        <MapCanvas
          center={pos}
          teams={teams}
          territories={[]}
          checkpoints={mapCheckpoints}
          circuitBoxes={mapBoxes}
          bananas={mapBananas}
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
          <div className="display flex items-center gap-2 text-xl">
            <Flag className="h-4 w-4" />
            {myFinishedRef.current
              ? "Terminé"
              : `Tour ${Math.min((me?.circuit_lap ?? 0) + 1, lapCount)}/${lapCount}`}
          </div>
          <div className="label-xs">
            Position {myPosition}/{teams.length}
            {nextCheckpointDist != null && ` · Checkpoint à ${Math.round(nextCheckpointDist)} m`}
          </div>
          {me?.circuit_shielded && (
            <div className="label-xs flex items-center gap-1 text-accent">
              <Shield className="h-3 w-3" /> Bouclier prêt
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

      <button
        aria-label="Messages"
        className="hud-badge pointer-events-auto absolute right-3 z-[1000] flex h-12 w-12 items-center justify-center"
        style={{ top: "max(9.5rem, calc(env(safe-area-inset-top) + 7rem))" }}
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

        {checkpoints.length < 2 && (
          <div className="panel px-4 py-3 text-sm font-semibold text-muted-foreground">
            En attente que le prof dessine le circuit…
          </div>
        )}

        {me?.circuit_held_item === "banana" && (
          <button className="btn-huge btn-huge-accent" onClick={() => void dropHeldBanana()}>
            🍌 Larguer la banane
          </button>
        )}

        <PhotoRequestCard
          gameId={gameId}
          teamId={teamId}
          requestedAt={game?.photo_requested_at}
          photoDeadline={game?.photo_deadline}
          nowMs={now}
        />

        {finished && (
          <button className="btn-huge btn-huge-accent" onClick={() => setResultsOpen(true)}>
            🏁 Voir le classement final
          </button>
        )}
        {finished && <div className="panel px-4 py-2 text-center text-sm">Partie terminée !</div>}
        {!finished && myFinishedRef.current && (
          <div className="panel px-4 py-2 text-center text-sm">
            Course terminée — en attente des autres équipes.
          </div>
        )}
      </div>

      {geoDenied && <GeoPermissionHelp onDismiss={() => setGeoDenied(false)} />}

      {itemResult && (
        <ItemResultOverlay
          kind={itemResult.kind}
          detail={itemResult.detail}
          onClose={() => setItemResult(null)}
        />
      )}

      {resultsOpen && (
        <FinalResults
          teams={finalResultsTeams}
          myTeamId={teamId}
          formatScore={formatRank}
          statusLabel="Partie terminée !"
          onClose={() => setResultsOpen(false)}
        />
      )}
    </main>
  );
}
