import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Camera, Crosshair, Flag, HelpCircle, MessageCircle, Send, Square, X } from "lucide-react";
import { RulesIntro } from "@/components/RulesIntro";
import { LoopSummary, type LoopSummaryData } from "@/components/LoopSummary";

import { supabase } from "@/integrations/supabase/client";
import { MapCanvas } from "@/components/MapCanvas";
import { useGameState } from "@/lib/useGameState";
import {
  CLOSE_RADIUS_M,
  DEFAULT_RUNNING_BONUS_SPEED_KMH,
  FORBIDDEN_PENALTY_COOLDOWN_MS,
  MIN_LOOP_DISTANCE_M,
  formatArea,
  formatClock,
  formatCountdown,
  haversine,
  kmhToMs,
} from "@/lib/conquete";
import { captureTerritory, polygonFromTrack } from "@/lib/capture";
import { sendTeamMessage, useMessages } from "@/lib/messages";
import { notifyMessage, requestNotificationPermission } from "@/lib/notify";
import { uploadTeamPhoto } from "@/lib/photoCheck";
import { checkLandmarkClaims, isLandmarkActive, useLandmarks } from "@/lib/landmarks";
import { applyPenalty, useForbiddenZones } from "@/lib/forbiddenZones";
import { CtfPlayView } from "@/components/CtfPlayView";

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

  const runningRef = useRef(false);
  const trackRef = useRef<[number, number][]>([]);
  const distRef = useRef(0);
  const loopStartRef = useRef(0);
  const lastSync = useRef(0);
  const closing = useRef(false);
  const lastPosRef = useRef<{ point: [number, number]; t: number } | null>(null);
  const instSpeedRef = useRef(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatBody, setChatBody] = useState("");
  const seenMessageCount = useRef<number | null>(null);
  const [unread, setUnread] = useState(false);
  const [photoSending, setPhotoSending] = useState(false);
  const [photoSentAt, setPhotoSentAt] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [summary, setSummary] = useState<LoopSummaryData | null>(null);

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
      } else if (latest?.sender === "system") {
        toast.error(latest.body, { duration: 8000 });
        notifyMessage("⚠️ Territoire perdu !", latest.body);
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

  const photoStorageKey = game?.photo_requested_at
    ? `conquete:photo:${teamId}:${game.photo_requested_at}`
    : null;

  useEffect(() => {
    if (!photoStorageKey) return;
    setPhotoSentAt(localStorage.getItem(photoStorageKey));
  }, [photoStorageKey]);

  async function sendPhoto(file: File) {
    if (!gameId || !photoStorageKey) return;
    setPhotoSending(true);
    try {
      await uploadTeamPhoto(gameId, teamId, file);
      const sentAt = new Date().toISOString();
      localStorage.setItem(photoStorageKey, sentAt);
      setPhotoSentAt(sentAt);
      toast.success("Photo envoyée au prof !");
    } catch {
      toast.error("Échec de l'envoi de la photo.");
    } finally {
      setPhotoSending(false);
    }
  }

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
      const point: [number, number] = [p.coords.latitude, p.coords.longitude];
      setPos(point);
      setAccuracy(p.coords.accuracy);
      setGeoError(null);

      const prevPos = lastPosRef.current;
      const nowMs = Date.now();
      if (prevPos) {
        const dt = (nowMs - prevPos.t) / 1000;
        const dist = haversine(prevPos.point, point);
        // Ignore samples too close together in time/space: GPS jitter would
        // otherwise produce wildly inflated instantaneous speed readings.
        if (dt > 0.5 && dist > 2) {
          instSpeedRef.current = dist / dt;
          lastPosRef.current = { point, t: nowMs };
        }
      } else {
        lastPosRef.current = { point, t: nowMs };
      }

      if (Date.now() - lastSync.current > 3000) {
        lastSync.current = Date.now();
        void supabase
          .from("teams")
          .update({ lat: point[0], lng: point[1], updated_at: new Date().toISOString() })
          .eq("id", teamId);
      }

      if (landmarksRef.current.some((l) => !l.claimed_by_team_id)) {
        void checkLandmarkClaims(
          landmarksRef.current,
          teamId,
          point,
          gameRef.current?.started_at ?? null,
        ).then((won) => {
          if (won) {
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

  const mapLandmarks = useMemo(
    () =>
      landmarks
        .filter((l) => isLandmarkActive(l, game?.started_at ?? null, now))
        .map((l) => ({ id: l.id, lat: l.lat, lng: l.lng, icon: l.icon })),
    [landmarks, game?.started_at, now],
  );

  const mapForbiddenZones = useMemo(
    () => forbiddenZones.map((z) => ({ id: z.id, lat: z.lat, lng: z.lng, radiusM: z.radius_m })),
    [forbiddenZones],
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

  const toStart = track[0] && pos ? haversine(track[0], pos) : null;

  const photoDeadlineRemaining = game?.photo_deadline
    ? (new Date(game.photo_deadline).getTime() - now) / 1000
    : null;
  const photoRequestPending = !!game?.photo_requested_at && !photoSentAt;

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
          follow
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

      <button
        aria-label="Messages"
        className="hud-badge pointer-events-auto absolute right-3 z-[1000] flex h-12 w-12 items-center justify-center"
        style={{ top: "max(7rem, calc(env(safe-area-inset-top) + 4.5rem))" }}
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
        style={{ top: "max(11rem, calc(env(safe-area-inset-top) + 8.5rem))" }}
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
        {geoError && (
          <div className="panel px-4 py-3 text-sm font-semibold text-destructive">{geoError}</div>
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

        {photoRequestPending && (
          <div className="panel flex flex-col gap-3 px-4 py-3 ring-2 ring-accent">
            <div className="section-title">
              <Camera className="h-4 w-4" /> Photo demandée
            </div>
            <div className="text-sm font-semibold">
              Le prof demande une photo de votre groupe
              {photoDeadlineRemaining !== null && photoDeadlineRemaining > 0
                ? ` — il reste ${formatClock(photoDeadlineRemaining)}`
                : " — délai dépassé, envoyez-la quand même"}
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void sendPhoto(file);
                e.target.value = "";
              }}
            />
            <button
              className="btn-huge btn-huge-accent"
              disabled={photoSending}
              onClick={() => photoInputRef.current?.click()}
            >
              <Camera className="h-6 w-6" /> {photoSending ? "Envoi..." : "Prendre la photo"}
            </button>
          </div>
        )}

        {returnZone && !finished && (
          <div className="panel flex items-center justify-between gap-3 px-4 py-3">
            <span className="label-xs">Zone de retour</span>
            <span className="display text-xl tabular-nums">
              {toZone === null ? "—" : `${Math.round(toZone)} m`}
            </span>
          </div>
        )}

        {finished ? (
          <div className="btn-huge btn-huge-dark">
            {returnZone
              ? me?.validated
                ? "Partie terminée — territoire validé !"
                : "Partie terminée — territoire non comptabilisé (hors zone)"
              : "Partie terminée"}
          </div>
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
    </main>
  );
}
