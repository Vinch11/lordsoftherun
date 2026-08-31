import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Crosshair, Flag as FlagIcon, MessageCircle, Send, Shield, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MapCanvas } from "@/components/MapCanvas";
import { ScoreStrip } from "@/components/ScoreStrip";
import { useGameState } from "@/lib/useGameState";
import {
  CTF_CAPTURE_POINTS,
  DEFAULT_VEHICLE_PENALTY_M2,
  DEFAULT_VEHICLE_SPEED_THRESHOLD_KMH,
  FLAG_PICKUP_RADIUS_M,
  FORBIDDEN_PENALTY_COOLDOWN_MS,
  VEHICLE_SUSTAINED_MS,
  formatArea,
  formatCountdown,
  haversine,
  kmhToMs,
} from "@/lib/conquete";
import { sendTeamMessage, useMessages } from "@/lib/messages";
import { notifyMessage, requestNotificationPermission } from "@/lib/notify";
import { checkLandmarkClaims, isLandmarkActive, useLandmarks } from "@/lib/landmarks";
import { applyPenalty, useForbiddenZones } from "@/lib/forbiddenZones";
import { applyCapture, deliverFlag, tryPickupFlag, useFlags } from "@/lib/flags";
import { checkGraceArrival, resolveGraceStatus } from "@/lib/grace";
import { GeoKalmanFilter } from "@/lib/geoFilter";
import { SpeedTracker } from "@/lib/speed";
import { useWakeLock } from "@/hooks/useWakeLock";
import { useMotionHint } from "@/hooks/useMotionHint";

export function CtfPlayView({ gameId, teamId }: { gameId: string; teamId: string }) {
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [geoError, setGeoError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatBody, setChatBody] = useState("");
  const [unread, setUnread] = useState(false);
  const [followMe, setFollowMe] = useState(true);

  const lastSync = useRef(0);
  const seenMessageCount = useRef<number | null>(null);
  const lastPenalizedRef = useRef<Map<string, number>>(new Map());
  const instSpeedRef = useRef(0);
  const speedTrackerRef = useRef(new SpeedTracker());
  // Scores freeze the instant the timer hits zero: during the return grace
  // period players are still moving, but nothing they do may change the board.
  const finishedRef = useRef(false);
  const vehicleAboveSinceRef = useRef<number | null>(null);
  const geoFilterRef = useRef(new GeoKalmanFilter());
  const { movingRef, needsPermission, requestPermission } = useMotionHint();

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  const { game, teams } = useGameState(gameId);
  const gameRef = useRef(game);
  gameRef.current = game;
  const teamsRef = useRef(teams);
  teamsRef.current = teams;
  const { messages } = useMessages(gameId);
  const { landmarks } = useLandmarks(gameId);
  const landmarksRef = useRef(landmarks);
  landmarksRef.current = landmarks;
  const { zones: forbiddenZones } = useForbiddenZones(gameId);
  const forbiddenZonesRef = useRef(forbiddenZones);
  forbiddenZonesRef.current = forbiddenZones;
  const { flags } = useFlags(gameId);
  const flagsRef = useRef(flags);
  flagsRef.current = flags;

  const me = teams.find((t) => t.id === teamId) ?? null;
  const myColor = me?.color ?? "#e63946";
  const myFlag = flags.find((f) => f.team_id === teamId) ?? null;
  const prevMyFlagStatusRef = useRef<string | null>(null);

  useEffect(() => {
    const prevStatus = prevMyFlagStatusRef.current;
    if (myFlag && prevStatus !== null && myFlag.status === "carried" && prevStatus !== "carried") {
      const carrierName =
        teams.find((t) => t.id === myFlag.carried_by_team_id)?.name ?? "Une équipe";
      toast.error(`🚩 ${carrierName} a pris votre drapeau !`);
      notifyMessage("🚩 Drapeau pris !", `${carrierName} a pris votre drapeau.`);
    }
    prevMyFlagStatusRef.current = myFlag?.status ?? null;
  }, [myFlag, teams]);

  const carriedFlags = useMemo(
    () => flags.filter((f) => f.carried_by_team_id === teamId),
    [flags, teamId],
  );
  const shieldActive = !!me?.shield_until && new Date(me.shield_until).getTime() > now;
  const shieldActiveRef = useRef(shieldActive);
  shieldActiveRef.current = shieldActive;
  const shieldRemainingS = shieldActive
    ? Math.max(0, Math.round((new Date(me!.shield_until!).getTime() - now) / 1000))
    : 0;

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
        notifyMessage("💬 Message du prof", latest.body);
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

  const dropPoint = useMemo<[number, number] | null>(() => {
    if (game?.return_lat != null && game.return_lng != null)
      return [game.return_lat, game.return_lng];
    if (myFlag) return [myFlag.lat, myFlag.lng];
    return null;
  }, [game?.return_lat, game?.return_lng, myFlag]);
  const dropRadius = game?.return_lat != null ? game.return_radius_m : FLAG_PICKUP_RADIUS_M;
  const dropPointRef = useRef(dropPoint);
  dropPointRef.current = dropPoint;
  const dropRadiusRef = useRef(dropRadius);
  dropRadiusRef.current = dropRadius;

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

      if (Date.now() - lastSync.current > 3000) {
        lastSync.current = Date.now();
        void supabase
          .from("teams")
          .update({ lat: point[0], lng: point[1], updated_at: new Date().toISOString() })
          .eq("id", teamId);
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
            void applyPenalty({ game_id: gameId, penalty_m2: penaltyM2 }, teamId, true).then(() => {
              toast.error(`🚴 Vitesse suspecte détectée ! -${formatArea(penaltyM2)}`);
              notifyMessage("🚴 Vitesse suspecte !", `-${formatArea(penaltyM2)}`);
            });
          }
        } else {
          vehicleAboveSinceRef.current = null;
        }
      }

      if (finishedRef.current) return; // scores frozen: no more bonuses or flags

      if (landmarksRef.current.some((l) => !l.claimed_by_team_id)) {
        void checkLandmarkClaims(
          landmarksRef.current,
          teamId,
          point,
          gameRef.current?.started_at ?? null,
          true,
        ).then((won) => {
          if (!won) return;
          if (won.kind === "shield") {
            toast.success(`${won.icon} Bouclier activé ! Immunité ${won.shield_duration_s}s.`);
            notifyMessage(`${won.icon} Bouclier !`, `Immunité ${won.shield_duration_s}s`);
          } else {
            toast.success(`${won.icon} Bonus capturé : +${formatArea(won.bonus_m2)} !`);
            notifyMessage(`${won.icon} Bonus !`, `+${formatArea(won.bonus_m2)}`);
          }
        });
      }

      for (const zone of forbiddenZonesRef.current) {
        if (haversine(point, [zone.lat, zone.lng]) > zone.radius_m) continue;
        const last = lastPenalizedRef.current.get(zone.id) ?? 0;
        if (Date.now() - last < FORBIDDEN_PENALTY_COOLDOWN_MS) continue;
        lastPenalizedRef.current.set(zone.id, Date.now());
        void applyPenalty(zone, teamId, true).then(() => {
          toast.error(`⚠️ Zone interdite ! -${formatArea(zone.penalty_m2)}`);
          notifyMessage("⚠️ Zone interdite !", `-${formatArea(zone.penalty_m2)}`);
        });
      }

      // Pick up (or recover) any flag within reach.
      for (const flag of flagsRef.current) {
        if (flag.carried_by_team_id === teamId) continue;
        const isMine = flag.team_id === teamId;
        if (isMine && flag.status !== "dropped") continue;
        if (!isMine && flag.status !== "home" && flag.status !== "dropped") continue;
        if (haversine(point, [flag.lat, flag.lng]) > FLAG_PICKUP_RADIUS_M) continue;
        void tryPickupFlag(flag, teamId).then((ok) => {
          if (!ok) return;
          if (isMine) {
            toast.success("🚩 Vous avez récupéré votre drapeau !");
          } else {
            toast.success("🚩 Drapeau ennemi capturé ! Ramenez-le à la zone de dépôt.");
            notifyMessage("🚩 Drapeau pris !", "Ramenez-le à la zone de dépôt.");
          }
        });
      }

      // Deliver any enemy flag currently carried, if close enough to the drop point.
      const dropPoint = dropPointRef.current;
      if (dropPoint) {
        const dropRadius = dropRadiusRef.current;
        for (const flag of flagsRef.current) {
          if (flag.carried_by_team_id !== teamId) continue;
          if (haversine(point, dropPoint) > dropRadius) continue;
          void deliverFlag(flag, teamId).then((ok) => {
            if (!ok) return;
            toast.success(`🏆 Drapeau livré ! +${formatArea(CTF_CAPTURE_POINTS)}`);
            notifyMessage("🏆 Drapeau livré !", `+${formatArea(CTF_CAPTURE_POINTS)}`);
          });
        }
      }

      // Get tagged by a nearby opposing team while carrying a flag.
      if (!shieldActiveRef.current) {
        const captureRadius = gameRef.current?.ctf_capture_radius_m ?? 8;
        const nearbyEnemy = teamsRef.current.some(
          (t) =>
            t.id !== teamId &&
            t.lat != null &&
            t.lng != null &&
            haversine(point, [t.lat, t.lng]) <= captureRadius,
        );
        if (nearbyEnemy) {
          for (const flag of flagsRef.current) {
            if (flag.carried_by_team_id !== teamId) continue;
            void applyCapture(
              flag,
              gameRef.current?.ctf_capture_consequence ?? "return_to_base",
              gameRef.current?.ctf_time_penalty_m2 ?? 50,
              point,
            ).then((applied) => {
              if (!applied) return;
              toast.error("🚫 Attrapé ! Le drapeau vous a échappé.");
              notifyMessage("🚫 Attrapé !", "Le drapeau vous a échappé.");
            });
          }
        }
      }

      if (gameRef.current) {
        const myTeam = teamsRef.current.find((t) => t.id === teamId);
        checkGraceArrival(gameRef.current, teamId, myTeam?.returned_at != null, point);
      }
    },
    [teamId],
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

  const mapFlags = useMemo(
    () =>
      flags
        .filter((f) => f.status !== "awaiting_placement")
        .map((f) => {
          const owner = teams.find((t) => t.id === f.team_id);
          const carrier = f.carried_by_team_id
            ? teams.find((t) => t.id === f.carried_by_team_id)
            : null;
          const position: [number, number] =
            f.status === "carried" && carrier?.lat != null && carrier.lng != null
              ? [carrier.lat, carrier.lng]
              : [f.lat, f.lng];
          const label =
            f.status === "carried"
              ? `Drapeau ${owner?.name ?? ""} — porté par ${carrier?.name ?? "?"}`
              : `Drapeau ${owner?.name ?? ""}`;
          return {
            id: f.id,
            lat: position[0],
            lng: position[1],
            color: owner?.color ?? "#888",
            label,
          };
        }),
    [flags, teams],
  );

  const returnZone = useMemo(
    () =>
      game?.return_lat != null && game.return_lng != null
        ? { lat: game.return_lat, lng: game.return_lng, radiusM: game.return_radius_m }
        : null,
    [game?.return_lat, game?.return_lng, game?.return_radius_m],
  );

  const remaining = game?.ends_at ? (new Date(game.ends_at).getTime() - now) / 1000 : null;
  const finished = game?.status === "finished" || (remaining !== null && remaining <= 0);
  const toDrop = pos && dropPoint ? haversine(pos, dropPoint) : null;
  const graceStatus = game && me ? resolveGraceStatus(game, me, now) : null;
  const flagsCapturedLabel = `${me?.flags_captured ?? 0} drapeau${(me?.flags_captured ?? 0) > 1 ? "x" : ""} capturé${(me?.flags_captured ?? 0) > 1 ? "s" : ""}`;
  const endgameLabel = !game?.grace_ends_at
    ? `Partie terminée — ${flagsCapturedLabel} !`
    : graceStatus?.remainingS != null
      ? `Partie terminée — ${flagsCapturedLabel} !`
      : graceStatus?.validated
        ? "Partie terminée — retour validé !"
        : "Partie terminée — retour hors délai";

  finishedRef.current = finished;
  useWakeLock(!finished);

  const prevFinishedRef = useRef(finished);
  useEffect(() => {
    if (finished && !prevFinishedRef.current) {
      toast.success("🏁 Partie terminée !");
      notifyMessage("🏁 Partie terminée !", "Regardez le classement final !");
    }
    prevFinishedRef.current = finished;
  }, [finished]);

  const myFlagStatusLabel = !myFlag
    ? "Pas encore placé"
    : myFlag.status === "home"
      ? "À la base"
      : myFlag.status === "carried"
        ? `Porté par ${teams.find((t) => t.id === myFlag.carried_by_team_id)?.name ?? "une équipe"}`
        : myFlag.status === "dropped"
          ? "Au sol — allez le récupérer !"
          : "En attente (l'organisateur va le replacer)";

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden">
      <div className="absolute inset-0">
        <MapCanvas
          center={pos}
          teams={teams}
          territories={[]}
          returnZone={returnZone}
          landmarks={mapLandmarks}
          forbiddenZones={mapForbiddenZones}
          flags={mapFlags}
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
          <div className="display text-xl">🚩 {me?.flags_captured ?? 0}</div>
          {shieldActive && (
            <div className="label-xs flex items-center gap-1 text-accent">
              <Shield className="h-3 w-3" /> Bouclier {shieldRemainingS}s
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
        {geoError && (
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

        {carriedFlags.length > 0 && (
          <div className="panel flex items-center justify-between gap-3 px-4 py-3 ring-2 ring-accent">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <FlagIcon className="h-4 w-4 text-accent" />
              {carriedFlags.length === 1
                ? "Vous portez un drapeau ennemi !"
                : `Vous portez ${carriedFlags.length} drapeaux ennemis !`}
            </span>
            <span className="display text-lg tabular-nums">
              {toDrop === null ? "—" : `${Math.round(toDrop)} m`}
            </span>
          </div>
        )}

        <div className="panel flex items-center justify-between gap-3 px-4 py-3">
          <span className="label-xs">Votre drapeau</span>
          <span className="text-sm font-semibold">{myFlagStatusLabel}</span>
        </div>

        {finished && game?.grace_ends_at && graceStatus?.remainingS != null && (
          <div className="panel flex items-center justify-between gap-3 px-4 py-3 ring-2 ring-accent">
            <span className="text-sm font-semibold">⏳ Revenez dans la zone avant</span>
            <span className="display text-lg tabular-nums">
              {formatCountdown(graceStatus.remainingS)}
            </span>
          </div>
        )}

        {finished && <div className="btn-huge btn-huge-dark">{endgameLabel}</div>}
      </div>
    </main>
  );
}
