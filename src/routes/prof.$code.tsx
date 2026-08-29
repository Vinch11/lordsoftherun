import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bookmark,
  Camera,
  Maximize2,
  MapPin,
  Medal,
  Minus,
  Pencil,
  Plus,
  QrCode,
  Send,
  ShieldAlert,
  Star,
  Trophy,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MapCanvas } from "@/components/MapCanvas";
import { JoinQRCode } from "@/components/JoinQRCode";
import { useGameState } from "@/lib/useGameState";

import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/lib/profile";
import { getTerminology } from "@/lib/terminology";
import { sendProfMessage, useMessages } from "@/lib/messages";
import { notifyMessage, requestNotificationPermission } from "@/lib/notify";
import { getPhotoUrl, requestPhotoCheck, usePhotoSubmissions } from "@/lib/photoCheck";
import {
  addLandmark,
  isLandmarkActive,
  removeLandmark,
  updateLandmark,
  useLandmarks,
} from "@/lib/landmarks";
import { addForbiddenZone, removeForbiddenZone, useForbiddenZones } from "@/lib/forbiddenZones";
import {
  applySavedPoint,
  deleteSavedPoint,
  saveSavedPoint,
  useSavedPoints,
} from "@/lib/savedPoints";
import {
  DEFAULT_FORBIDDEN_PENALTY_M2,
  DEFAULT_FORBIDDEN_RADIUS_M,
  DEFAULT_LANDMARK_BONUS_M2,
  DEFAULT_LANDMARK_ICON,
  LANDMARK_ICONS,
  formatArea,
  formatClock,
  formatCountdown,
  haversine,
  randomCode,
} from "@/lib/conquete";

type DurationUnit = "minutes" | "heures" | "jours";
const UNIT_TO_MINUTES: Record<DurationUnit, number> = { minutes: 1, heures: 60, jours: 1440 };
const UNIT_STEP: Record<DurationUnit, number> = { minutes: 5, heures: 1, jours: 1 };
const UNIT_MAX: Record<DurationUnit, number> = { minutes: 180, heures: 72, jours: 30 };
const UNIT_DEFAULT: Record<DurationUnit, number> = { minutes: 20, heures: 1, jours: 1 };

export const Route = createFileRoute("/prof/$code")({
  head: () => ({
    meta: [
      { title: "Tableau de bord enseignant — Conquête" },
      {
        name: "description",
        content:
          "Suivez en direct la position de tous les groupes, les territoires capturés et le classement par surface.",
      },
      { property: "og:title", content: "Tableau de bord enseignant — Conquête" },
      {
        property: "og:description",
        content: "Positions en direct, territoires et scores de la partie Conquête.",
      },
    ],
  }),
  component: TeacherDashboard,
});

const DEFAULT_ZONE_RADIUS = 25;

type LandmarkFieldsProps = {
  icon: string;
  onIcon: (icon: string) => void;
  bonus: number;
  onBonus: (updater: (b: number) => number) => void;
  appearAfter: number;
  onAppearAfter: (updater: (m: number) => number) => void;
  expires: boolean;
  onExpires: (expires: boolean) => void;
  disappearAfter: number;
  onDisappearAfter: (updater: (m: number) => number) => void;
};

function LandmarkFields({
  icon,
  onIcon,
  bonus,
  onBonus,
  appearAfter,
  onAppearAfter,
  expires,
  onExpires,
  disappearAfter,
  onDisappearAfter,
}: LandmarkFieldsProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {LANDMARK_ICONS.map((i) => (
          <button
            key={i}
            type="button"
            aria-label={`Icône ${i}`}
            className="seg-btn flex h-11 w-11 items-center justify-center !text-xl"
            data-active={icon === i}
            onClick={() => onIcon(i)}
          >
            {i}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">Bonus</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Réduire le bonus"
            className="icon-btn"
            onClick={() => onBonus((b) => Math.max(10, b - 10))}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="display w-24 text-center text-lg">{formatArea(bonus)}</span>
          <button
            type="button"
            aria-label="Augmenter le bonus"
            className="icon-btn"
            onClick={() => onBonus((b) => Math.min(500, b + 10))}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">Apparaît après</span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Réduire le délai d'apparition"
            className="icon-btn"
            onClick={() => onAppearAfter((m) => Math.max(0, m - 5))}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="display w-20 text-center text-lg">{appearAfter} min</span>
          <button
            type="button"
            aria-label="Augmenter le délai d'apparition"
            className="icon-btn"
            onClick={() => onAppearAfter((m) => m + 5)}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
      <label className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">Disparaît après un délai</span>
        <input
          type="checkbox"
          className="h-5 w-5"
          checked={expires}
          onChange={(e) => onExpires(e.target.checked)}
        />
      </label>
      {expires ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">Délai</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Réduire le délai de disparition"
              className="icon-btn"
              onClick={() => onDisappearAfter((m) => Math.max(5, m - 5))}
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="display w-20 text-center text-lg">{disappearAfter} min</span>
            <button
              type="button"
              aria-label="Augmenter le délai de disparition"
              className="icon-btn"
              onClick={() => onDisappearAfter((m) => m + 5)}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Reste sur la carte jusqu'à ce qu'une équipe le capture.
        </p>
      )}
    </div>
  );
}

function TeacherDashboard() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile(user?.id);
  const t = getTerminology(profile?.terminology);
  const [creatingGame, setCreatingGame] = useState(false);
  const [qrFullscreen, setQrFullscreen] = useState(false);
  const [gameId, setGameId] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("minutes");
  const [durationValue, setDurationValue] = useState(UNIT_DEFAULT.minutes);
  const [now, setNow] = useState(() => Date.now());
  const [placingMode, setPlacingMode] = useState<"none" | "zone" | "landmark" | "forbidden">(
    "none",
  );
  const [zoneRadius, setZoneRadius] = useState(DEFAULT_ZONE_RADIUS);
  const [landmarkBonus, setLandmarkBonus] = useState(DEFAULT_LANDMARK_BONUS_M2);
  const [landmarkIconChoice, setLandmarkIconChoice] = useState<string>(DEFAULT_LANDMARK_ICON);
  const [landmarkAppearAfter, setLandmarkAppearAfter] = useState(0);
  const [landmarkExpires, setLandmarkExpires] = useState(false);
  const [landmarkDisappearAfter, setLandmarkDisappearAfter] = useState(30);
  const [editingLandmarkId, setEditingLandmarkId] = useState<string | null>(null);
  const [forbiddenRadius, setForbiddenRadius] = useState(DEFAULT_FORBIDDEN_RADIUS_M);
  const [forbiddenPenalty, setForbiddenPenalty] = useState(DEFAULT_FORBIDDEN_PENALTY_M2);
  const [messageBody, setMessageBody] = useState("");
  const [messageTarget, setMessageTarget] = useState<string>("all");
  const [selfPos, setSelfPos] = useState<[number, number] | null>(null);
  const [photoDelay, setPhotoDelay] = useState(3);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const stoppedRef = useRef(false);
  const radiusInitRef = useRef(false);
  const seenMessageCount = useRef<number | null>(null);

  const durationMinutes = durationValue * UNIT_TO_MINUTES[durationUnit];

  useEffect(() => {
    requestNotificationPermission();
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (p) => setSelfPos([p.coords.latitude, p.coords.longitude]),
        () => {},
        { enableHighAccuracy: true, timeout: 10000 },
      );
    }
  }, []);

  useEffect(() => {
    let active = true;
    void supabase
      .from("games")
      .select("id, duration_minutes, owner_id")
      .eq("code", code)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        if (!data) setNotFound(true);
        else {
          setGameId(data.id);
          setOwnerId(data.owner_id);
          const mins = data.duration_minutes;
          if (mins >= 1440 && mins % 1440 === 0) {
            setDurationUnit("jours");
            setDurationValue(mins / 1440);
          } else if (mins >= 60 && mins % 60 === 0) {
            setDurationUnit("heures");
            setDurationValue(mins / 60);
          } else {
            setDurationUnit("minutes");
            setDurationValue(mins);
          }
        }
      });
    return () => {
      active = false;
    };
  }, [code]);

  const { game, teams, territories } = useGameState(gameId);
  const { messages } = useMessages(gameId);
  const { submissions } = usePhotoSubmissions(gameId);
  const { landmarks } = useLandmarks(gameId);
  const { zones: forbiddenZones } = useForbiddenZones(gameId);
  const { points: landmarkTemplates, refresh: refreshLandmarkTemplates } = useSavedPoints(
    user?.id ?? null,
    "landmark",
  );
  const { points: forbiddenTemplates, refresh: refreshForbiddenTemplates } = useSavedPoints(
    user?.id ?? null,
    "forbidden",
  );

  useEffect(() => {
    if (!radiusInitRef.current && game?.return_radius_m != null) {
      setZoneRadius(game.return_radius_m);
      radiusInitRef.current = true;
    }
  }, [game?.return_radius_m]);

  useEffect(() => {
    if (seenMessageCount.current === null) {
      seenMessageCount.current = messages.length;
      return;
    }
    if (messages.length > seenMessageCount.current) {
      const latest = messages[messages.length - 1];
      if (latest?.sender !== "prof") {
        const teamName = teams.find((t) => t.id === latest?.team_id)?.name ?? "Équipe";
        toast(`💬 ${teamName} : ${latest?.body}`);
        notifyMessage(`💬 ${teamName}`, latest?.body ?? "");
      }
    }
    seenMessageCount.current = messages.length;
  }, [messages, teams]);

  useEffect(() => {
    for (const s of submissions) {
      if (photoUrls[s.id]) continue;
      void getPhotoUrl(s.storage_path).then((url) => {
        if (url) setPhotoUrls((prev) => ({ ...prev, [s.id]: url }));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissions]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const isOwner = !!user && !!ownerId && user.id === ownerId;

  const remaining = game?.ends_at
    ? (new Date(game.ends_at).getTime() - now) / 1000
    : durationMinutes * 60;
  const running = game?.status === "running" && remaining > 0;

  const withinReturnZone = useMemo(() => {
    return (team: { lat: number | null; lng: number | null }) => {
      if (game?.return_lat == null || game.return_lng == null) return true;
      if (team.lat == null || team.lng == null) return false;
      return (
        haversine([team.lat, team.lng], [game.return_lat, game.return_lng]) <= game.return_radius_m
      );
    };
  }, [game?.return_lat, game?.return_lng, game?.return_radius_m]);

  async function stop() {
    if (!gameId || stoppedRef.current) return;
    if (!isOwner) {
      toast.error(t.ownerOnlyError);
      return;
    }
    stoppedRef.current = true;
    await Promise.all(
      teams.map((t) =>
        supabase
          .from("teams")
          .update({ validated: withinReturnZone(t) })
          .eq("id", t.id),
      ),
    );
    await supabase.from("games").update({ status: "finished" }).eq("id", gameId);
    toast("Partie terminée.");
  }

  useEffect(() => {
    if (game?.status === "running" && remaining <= 0 && isOwner) {
      void stop();
    }
    if (game?.status !== "running") {
      stoppedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, game?.status, isOwner]);

  const currentSubmissions = useMemo(() => {
    if (!game?.photo_requested_at) return [];
    const since = new Date(game.photo_requested_at).getTime();
    return submissions.filter((s) => new Date(s.submitted_at).getTime() >= since);
  }, [submissions, game?.photo_requested_at]);
  const respondedTeamIds = useMemo(
    () => new Set(currentSubmissions.map((s) => s.team_id)),
    [currentSubmissions],
  );
  const photoDeadlineRemaining = game?.photo_deadline
    ? (new Date(game.photo_deadline).getTime() - now) / 1000
    : null;

  const ranked = useMemo(() => [...teams].sort((a, b) => b.score_m2 - a.score_m2), [teams]);
  const finished = game?.status === "finished";
  const validatedRanked = useMemo(() => ranked.filter((t) => t.validated), [ranked]);
  const unvalidated = useMemo(() => ranked.filter((t) => !t.validated), [ranked]);
  const totalCapturedRanked = useMemo(
    () => [...teams].sort((a, b) => b.total_captured_m2 - a.total_captured_m2),
    [teams],
  );

  const center = useMemo<[number, number] | null>(() => {
    if (game?.return_lat != null && game.return_lng != null)
      return [game.return_lat, game.return_lng];
    const withPos = teams.filter((t) => t.lat != null && t.lng != null);
    if (withPos.length) {
      const lat = withPos.reduce((s, t) => s + (t.lat ?? 0), 0) / withPos.length;
      const lng = withPos.reduce((s, t) => s + (t.lng ?? 0), 0) / withPos.length;
      return [lat, lng];
    }
    return selfPos;
  }, [teams, game?.return_lat, game?.return_lng, selfPos]);

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

  const joinUrl =
    typeof window !== "undefined" ? `${window.location.origin}/rejoindre/${code}` : "";

  async function start() {
    if (!gameId) return;
    if (!isOwner) {
      toast.error(t.ownerOnlyError);
      return;
    }
    const ends = new Date(Date.now() + durationMinutes * 60_000).toISOString();
    await supabase
      .from("games")
      .update({
        status: "running",
        duration_minutes: durationMinutes,
        started_at: new Date().toISOString(),
        ends_at: ends,
      })
      .eq("id", gameId);
    toast.success("Partie démarrée !");
  }

  async function placeZone(lat: number, lng: number) {
    if (!gameId || !isOwner) return;
    await supabase
      .from("games")
      .update({ return_lat: lat, return_lng: lng, return_radius_m: zoneRadius })
      .eq("id", gameId);
    setPlacingMode("none");
    toast.success("Zone de retour placée.");
  }

  async function placeLandmark(lat: number, lng: number) {
    if (!gameId || !isOwner) return;
    try {
      await addLandmark(
        gameId,
        lat,
        lng,
        landmarkBonus,
        landmarkIconChoice,
        landmarkAppearAfter,
        landmarkExpires ? landmarkDisappearAfter : null,
      );
      setPlacingMode("none");
      toast.success("Repère bonus placé !");
    } catch {
      toast.error("Impossible de placer le repère.");
    }
  }

  async function deleteLandmark(id: string) {
    if (!isOwner) return;
    try {
      await removeLandmark(id);
    } catch {
      toast.error("Impossible de supprimer le repère.");
    }
  }

  function startEditLandmark(l: (typeof landmarks)[number]) {
    setEditingLandmarkId(l.id);
    setLandmarkIconChoice(l.icon);
    setLandmarkBonus(l.bonus_m2);
    setLandmarkAppearAfter(l.active_after_minutes);
    setLandmarkExpires(l.active_until_minutes != null);
    setLandmarkDisappearAfter(l.active_until_minutes ?? 30);
  }

  async function saveEditLandmark() {
    if (!editingLandmarkId || !isOwner) return;
    try {
      await updateLandmark(editingLandmarkId, {
        icon: landmarkIconChoice,
        bonus_m2: landmarkBonus,
        active_after_minutes: landmarkAppearAfter,
        active_until_minutes: landmarkExpires ? landmarkDisappearAfter : null,
      });
      setEditingLandmarkId(null);
      toast.success("Repère mis à jour.");
    } catch {
      toast.error("Impossible de mettre à jour le repère.");
    }
  }

  async function placeForbidden(lat: number, lng: number) {
    if (!gameId || !isOwner) return;
    try {
      await addForbiddenZone(gameId, lat, lng, forbiddenRadius, forbiddenPenalty);
      setPlacingMode("none");
      toast.success("Zone interdite placée.");
    } catch {
      toast.error("Impossible de placer la zone.");
    }
  }

  async function deleteForbidden(id: string) {
    if (!isOwner) return;
    try {
      await removeForbiddenZone(id);
    } catch {
      toast.error("Impossible de supprimer la zone.");
    }
  }

  async function saveTemplate(
    kind: "landmark" | "forbidden",
    lat: number,
    lng: number,
    radiusM: number,
    valueM2: number,
    icon?: string,
    appearAfterMinutes?: number,
    disappearAfterMinutes?: number | null,
  ) {
    if (!user) return;
    const name = window.prompt("Nom du modèle à enregistrer :");
    if (!name || !name.trim()) return;
    try {
      await saveSavedPoint(
        user.id,
        kind,
        name.trim(),
        lat,
        lng,
        radiusM,
        valueM2,
        icon,
        appearAfterMinutes,
        disappearAfterMinutes,
      );
      toast.success("Modèle enregistré !");
      if (kind === "landmark") void refreshLandmarkTemplates();
      else void refreshForbiddenTemplates();
    } catch {
      toast.error("Impossible d'enregistrer le modèle.");
    }
  }

  async function useTemplate(point: (typeof landmarkTemplates)[number]) {
    if (!gameId) return;
    try {
      await applySavedPoint(point, gameId);
      toast.success(`« ${point.name} » ajouté à la partie.`);
    } catch {
      toast.error("Impossible d'appliquer le modèle.");
    }
  }

  async function deleteTemplate(id: string, kind: "landmark" | "forbidden") {
    try {
      await deleteSavedPoint(id);
      if (kind === "landmark") void refreshLandmarkTemplates();
      else void refreshForbiddenTemplates();
    } catch {
      toast.error("Impossible de supprimer le modèle.");
    }
  }

  async function updateZoneRadius(next: number) {
    setZoneRadius(next);
    if (!gameId || !isOwner || game?.return_lat == null) return;
    await supabase.from("games").update({ return_radius_m: next }).eq("id", gameId);
  }

  async function clearZone() {
    if (!gameId || !isOwner) return;
    await supabase.from("games").update({ return_lat: null, return_lng: null }).eq("id", gameId);
  }

  async function askForPhoto() {
    if (!gameId || !isOwner) return;
    try {
      await requestPhotoCheck(gameId, photoDelay);
      toast.success(`Photo demandée à toutes les équipes (${photoDelay} min).`);
    } catch {
      toast.error("Impossible d'envoyer la demande.");
    }
  }

  async function createAnotherGame() {
    if (!user) return;
    setCreatingGame(true);
    try {
      for (let i = 0; i < 6; i++) {
        const c = randomCode();
        const { data, error } = await supabase
          .from("games")
          .insert({ code: c, owner_id: user.id })
          .select()
          .maybeSingle();
        if (!error && data) {
          await navigate({ to: "/prof/$code", params: { code: c } });
          return;
        }
      }
      toast.error("Impossible de créer la partie, réessayez.");
    } finally {
      setCreatingGame(false);
    }
  }

  async function sendMessage() {
    if (!gameId || !isOwner || !messageBody.trim()) return;
    const body = messageBody.trim();
    setMessageBody("");
    try {
      await sendProfMessage(gameId, body, messageTarget === "all" ? null : messageTarget);
    } catch {
      toast.error("Message non envoyé.");
    }
  }

  if (notFound) {
    return (
      <main className="min-h-screen px-5 py-10">
        <div className="mx-auto flex max-w-md flex-col gap-6">
          <Link to="/" className="nav-back" aria-label="Retour à l'accueil">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <header>
            <div className="pill">
              <MapPin className="h-3.5 w-3.5" /> Tableau de bord
            </div>
            <h1 className="page-title mt-4">
              Partie <em>{code}</em> introuvable
            </h1>
            <p className="mt-3 text-muted-foreground">
              Vérifiez le code à 4 chiffres ou créez une nouvelle partie depuis l'accueil.
            </p>
          </header>
          <Link to="/" className="btn-huge btn-huge-accent">
            Retour à l'accueil
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col">
      <div className="relative h-[45vh] min-h-[280px] w-full">
        <MapCanvas
          center={center}
          teams={teams}
          territories={mapTerritories}
          returnZone={returnZone}
          landmarks={mapLandmarks}
          forbiddenZones={mapForbiddenZones}
          mapStyle={game?.map_style}
          onMapClick={
            placingMode === "zone"
              ? placeZone
              : placingMode === "landmark"
                ? placeLandmark
                : placingMode === "forbidden"
                  ? placeForbidden
                  : undefined
          }
        />
        <div className="pointer-events-none absolute left-3 top-3 z-[1000] flex items-center gap-2">
          <Link to="/" className="nav-back pointer-events-auto" aria-label="Retour à l'accueil">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          {isOwner && (
            <button
              className="nav-back pointer-events-auto"
              aria-label="Lancer une nouvelle partie"
              disabled={creatingGame}
              onClick={() => void createAnotherGame()}
            >
              <Plus className="h-5 w-5" />
            </button>
          )}
          <div className="hud-badge px-3 py-2">
            <div className="label-xs">Code</div>
            <div className="display text-2xl tracking-[0.3em]">{code}</div>
          </div>
          <div className="hud-badge px-3 py-2">
            <div className="label-xs">Temps</div>
            <div className="display text-2xl tabular-nums">{formatCountdown(remaining)}</div>
          </div>
        </div>
        {placingMode !== "none" && (
          <div className="panel pointer-events-none absolute inset-x-3 bottom-3 z-[1000] px-4 py-3 text-center text-sm font-semibold">
            {placingMode === "zone"
              ? "Touchez la carte pour placer le centre de la zone de retour"
              : placingMode === "landmark"
                ? "Touchez la carte pour placer le repère bonus"
                : "Touchez la carte pour placer la zone interdite"}
          </div>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-4">
        <header className="panel flex flex-col gap-4 p-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <div className="min-w-0">
              <div className="pill">
                <MapPin className="h-3.5 w-3.5" /> Tableau de bord
              </div>
              <h1 className="page-title mt-3 truncate">
                Partie <em>{code}</em>
              </h1>
            </div>
            <span className={`chip ${running ? "chip-accent" : finished ? "chip-muted" : ""}`}>
              {running ? "En cours" : finished ? "Terminée" : "Lobby"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="stat">
              <span className="label-xs">Temps</span>
              <span className="stat-value">{formatCountdown(remaining)}</span>
            </div>
            <div className="stat">
              <span className="label-xs">Groupes</span>
              <span className="stat-value">{teams.length}</span>
            </div>
            <div className="stat">
              <span className="label-xs">Leader</span>
              <span className="stat-value truncate">{ranked[0]?.name ?? "—"}</span>
            </div>
          </div>
        </header>

        {!isOwner && (
          <div className="panel px-4 py-3 text-sm font-semibold text-muted-foreground">
            Vous consultez cette partie en lecture seule : {t.readOnlyNotice} piloter.
          </div>
        )}

        <section className="panel flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <span className="section-title">Durée</span>
            <div className="flex items-center gap-3">
              <button
                aria-label="Réduire"
                className="icon-btn"
                onClick={() => setDurationValue((v) => Math.max(1, v - UNIT_STEP[durationUnit]))}
              >
                <Minus className="h-5 w-5" />
              </button>
              <span className="display w-16 text-center text-2xl">{durationValue}</span>
              <button
                aria-label="Augmenter"
                className="icon-btn"
                onClick={() =>
                  setDurationValue((v) =>
                    Math.min(UNIT_MAX[durationUnit], v + UNIT_STEP[durationUnit]),
                  )
                }
              >
                <Plus className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(["minutes", "heures", "jours"] as DurationUnit[]).map((u) => (
              <button
                key={u}
                className="seg-btn"
                data-active={durationUnit === u}
                onClick={() => {
                  setDurationUnit(u);
                  setDurationValue(UNIT_DEFAULT[u]);
                }}
              >
                {u}
              </button>
            ))}
          </div>

          {durationUnit !== "minutes" && (
            <p className="text-xs text-muted-foreground">
              Mode Challenge : idéal pour un défi inter-classes sur plusieurs jours. Pensez à ne pas
              définir de zone de retour (ci-dessous) pour ne pas bloquer les retardataires.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button className="btn-huge btn-huge-accent" disabled={!isOwner} onClick={start}>
              {running ? "Relancer" : "Démarrer"}
            </button>
            <button className="btn-huge" disabled={!isOwner} onClick={stop}>
              Terminer
            </button>
          </div>
        </section>

        <section className="panel flex flex-col items-center gap-3 p-4">
          <div className="flex w-full items-center justify-between">
            <div className="section-title">
              <QrCode className="h-4 w-4" /> Rejoindre
            </div>
            <button
              aria-label="Agrandir le QR code"
              className="icon-btn"
              onClick={() => setQrFullscreen(true)}
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
          {joinUrl && <JoinQRCode url={joinUrl} />}
          <p className="text-sm text-muted-foreground">
            Ou tapez le code <span className="font-bold text-foreground">{code}</span> sur{" "}
            {typeof window !== "undefined" ? window.location.host : ""}
          </p>
        </section>

        {qrFullscreen && (
          <div
            className="fixed inset-0 z-[2000] flex flex-col items-center justify-center gap-6 bg-background p-6"
            onClick={() => setQrFullscreen(false)}
          >
            {joinUrl && <JoinQRCode url={joinUrl} size={320} />}
            <div className="display text-5xl tracking-[0.3em]">{code}</div>
            <p className="text-muted-foreground">Touchez l'écran pour fermer</p>
          </div>
        )}

        <section className="panel flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <div className="section-title">
              <MapPin className="h-4 w-4" /> Zone de retour
            </div>
            {returnZone && isOwner && (
              <button aria-label="Supprimer la zone" className="icon-btn" onClick={clearZone}>
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {returnZone ? (
            <p className="text-sm text-muted-foreground">
              Les équipes doivent être revenues dans cette zone quand le temps s'écoule pour que
              leur territoire compte au classement.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucune zone définie : tous les territoires capturés comptent, quelle que soit la
              position finale des équipes.
            </p>
          )}
          {isOwner && (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">Rayon</span>
                <div className="flex items-center gap-3">
                  <button
                    aria-label="Réduire le rayon"
                    className="icon-btn"
                    onClick={() => void updateZoneRadius(Math.max(10, zoneRadius - 10))}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="display w-16 text-center text-lg">{zoneRadius} m</span>
                  <button
                    aria-label="Augmenter le rayon"
                    className="icon-btn"
                    onClick={() => void updateZoneRadius(Math.min(300, zoneRadius + 10))}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <button
                className={`btn-huge ${placingMode === "zone" ? "btn-huge-accent" : "btn-huge-dark"}`}
                onClick={() => setPlacingMode((p) => (p === "zone" ? "none" : "zone"))}
              >
                {placingMode === "zone"
                  ? "Touchez la carte..."
                  : returnZone
                    ? "Déplacer la zone"
                    : "Placer sur la carte"}
              </button>
            </>
          )}
        </section>

        <section className="panel flex flex-col gap-3 p-4">
          <div className="section-title">
            <Star className="h-4 w-4" /> Repères bonus
          </div>
          <p className="text-sm text-muted-foreground">
            La première équipe qui passe à proximité d'un repère gagne des points bonus au
            classement final.
          </p>
          {isOwner && (
            <>
              <LandmarkFields
                icon={landmarkIconChoice}
                onIcon={setLandmarkIconChoice}
                bonus={landmarkBonus}
                onBonus={setLandmarkBonus}
                appearAfter={landmarkAppearAfter}
                onAppearAfter={setLandmarkAppearAfter}
                expires={landmarkExpires}
                onExpires={setLandmarkExpires}
                disappearAfter={landmarkDisappearAfter}
                onDisappearAfter={setLandmarkDisappearAfter}
              />

              <button
                className={`btn-huge ${placingMode === "landmark" ? "btn-huge-accent" : "btn-huge-dark"}`}
                onClick={() => setPlacingMode((p) => (p === "landmark" ? "none" : "landmark"))}
              >
                <Star className="h-5 w-5" />{" "}
                {placingMode === "landmark" ? "Touchez la carte..." : "Ajouter un repère"}
              </button>
            </>
          )}
          {landmarks.length > 0 && (
            <div className="flex flex-col gap-1">
              {landmarks.map((l) => {
                const elapsedMin = game?.started_at
                  ? (now - new Date(game.started_at).getTime()) / 60000
                  : 0;
                const status = l.claimed_by_team_id
                  ? `Pris par ${teams.find((t) => t.id === l.claimed_by_team_id)?.name ?? "une équipe"}`
                  : elapsedMin < l.active_after_minutes
                    ? `Apparaît dans ${Math.ceil(l.active_after_minutes - elapsedMin)} min`
                    : l.active_until_minutes != null && elapsedMin > l.active_until_minutes
                      ? "Expiré"
                      : "Disponible";
                return (
                  <div key={l.id} className="border-b border-border py-2 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-lg shrink-0">{l.icon}</span>
                      <span className="flex-1 text-sm">{status}</span>
                      <span className="text-sm font-semibold text-muted-foreground">
                        {formatArea(l.bonus_m2)}
                      </span>
                      {isOwner && (
                        <>
                          <button
                            aria-label="Modifier le repère"
                            onClick={() =>
                              editingLandmarkId === l.id
                                ? setEditingLandmarkId(null)
                                : startEditLandmark(l)
                            }
                          >
                            <Pencil className="h-4 w-4 text-muted-foreground" />
                          </button>
                          <button
                            aria-label="Enregistrer comme modèle"
                            onClick={() =>
                              void saveTemplate(
                                "landmark",
                                l.lat,
                                l.lng,
                                0,
                                l.bonus_m2,
                                l.icon,
                                l.active_after_minutes,
                                l.active_until_minutes,
                              )
                            }
                          >
                            <Bookmark className="h-4 w-4 text-muted-foreground" />
                          </button>
                          <button
                            aria-label="Supprimer le repère"
                            onClick={() => void deleteLandmark(l.id)}
                          >
                            <X className="h-4 w-4 text-muted-foreground" />
                          </button>
                        </>
                      )}
                    </div>
                    {isOwner && editingLandmarkId === l.id && (
                      <div className="mt-2 flex flex-col gap-3 rounded-xl bg-muted/40 p-3">
                        <LandmarkFields
                          icon={landmarkIconChoice}
                          onIcon={setLandmarkIconChoice}
                          bonus={landmarkBonus}
                          onBonus={setLandmarkBonus}
                          appearAfter={landmarkAppearAfter}
                          onAppearAfter={setLandmarkAppearAfter}
                          expires={landmarkExpires}
                          onExpires={setLandmarkExpires}
                          disappearAfter={landmarkDisappearAfter}
                          onDisappearAfter={setLandmarkDisappearAfter}
                        />
                        <div className="flex gap-2">
                          <button
                            className="btn-huge-accent flex-1 rounded-xl py-2 text-sm font-bold"
                            onClick={() => void saveEditLandmark()}
                          >
                            Enregistrer
                          </button>
                          <button
                            className="flex-1 rounded-xl bg-muted py-2 text-sm font-semibold"
                            onClick={() => setEditingLandmarkId(null)}
                          >
                            Annuler
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {isOwner && landmarkTemplates.length > 0 && (
            <div className="mt-1 flex flex-col gap-1 border-t border-border pt-2">
              <span className="label-xs">Mes modèles</span>
              {landmarkTemplates.map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-1">
                  <Bookmark className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 text-sm">{p.name}</span>
                  <button className="mini-btn" onClick={() => void useTemplate(p)}>
                    Réutiliser
                  </button>
                  <button
                    aria-label="Supprimer le modèle"
                    onClick={() => void deleteTemplate(p.id, "landmark")}
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel flex flex-col gap-3 p-4">
          <div className="section-title">
            <ShieldAlert className="h-4 w-4" /> Zones interdites
          </div>
          <p className="text-sm text-muted-foreground">
            Une équipe qui pénètre dans une zone interdite perd des points sur son score final.
          </p>
          {isOwner && (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">Rayon</span>
                <div className="flex items-center gap-3">
                  <button
                    aria-label="Réduire le rayon"
                    className="icon-btn"
                    onClick={() => setForbiddenRadius((r) => Math.max(5, r - 5))}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="display w-16 text-center text-lg">{forbiddenRadius} m</span>
                  <button
                    aria-label="Augmenter le rayon"
                    className="icon-btn"
                    onClick={() => setForbiddenRadius((r) => Math.min(200, r + 5))}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">Pénalité</span>
                <div className="flex items-center gap-3">
                  <button
                    aria-label="Réduire la pénalité"
                    className="icon-btn"
                    onClick={() => setForbiddenPenalty((p) => Math.max(10, p - 10))}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="display w-24 text-center text-lg">
                    -{formatArea(forbiddenPenalty)}
                  </span>
                  <button
                    aria-label="Augmenter la pénalité"
                    className="icon-btn"
                    onClick={() => setForbiddenPenalty((p) => Math.min(500, p + 10))}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <button
                className={`btn-huge ${placingMode === "forbidden" ? "btn-huge-accent" : "btn-huge-dark"}`}
                onClick={() => setPlacingMode((p) => (p === "forbidden" ? "none" : "forbidden"))}
              >
                <ShieldAlert className="h-5 w-5" />{" "}
                {placingMode === "forbidden" ? "Touchez la carte..." : "Ajouter une zone interdite"}
              </button>
            </>
          )}
          {forbiddenZones.length > 0 && (
            <div className="flex flex-col gap-1">
              {forbiddenZones.map((z) => (
                <div
                  key={z.id}
                  className="flex items-center gap-3 border-b border-border py-2 last:border-0"
                >
                  <ShieldAlert className="h-4 w-4 shrink-0 text-destructive" />
                  <span className="flex-1 text-sm">Rayon {z.radius_m} m</span>
                  <span className="text-sm font-semibold text-muted-foreground">
                    -{formatArea(z.penalty_m2)}
                  </span>
                  {isOwner && (
                    <>
                      <button
                        aria-label="Enregistrer comme modèle"
                        onClick={() =>
                          void saveTemplate("forbidden", z.lat, z.lng, z.radius_m, z.penalty_m2)
                        }
                      >
                        <Bookmark className="h-4 w-4 text-muted-foreground" />
                      </button>
                      <button
                        aria-label="Supprimer la zone"
                        onClick={() => void deleteForbidden(z.id)}
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
          {isOwner && forbiddenTemplates.length > 0 && (
            <div className="mt-1 flex flex-col gap-1 border-t border-border pt-2">
              <span className="label-xs">Mes modèles</span>
              {forbiddenTemplates.map((p) => (
                <div key={p.id} className="flex items-center gap-3 py-1">
                  <Bookmark className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 text-sm">{p.name}</span>
                  <button className="mini-btn" onClick={() => void useTemplate(p)}>
                    Réutiliser
                  </button>
                  <button
                    aria-label="Supprimer le modèle"
                    onClick={() => void deleteTemplate(p.id, "forbidden")}
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="panel flex flex-col gap-3 p-4">
          <div className="section-title">
            <Camera className="h-4 w-4" /> Photo de contrôle
          </div>
          {game?.photo_requested_at ? (
            <p className="text-sm text-muted-foreground">
              {photoDeadlineRemaining !== null && photoDeadlineRemaining > 0
                ? `Il reste ${formatClock(photoDeadlineRemaining)}`
                : "Délai écoulé"}{" "}
              — {currentSubmissions.length}/{teams.length} équipe(s) ont répondu.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Demandez une photo à toutes les équipes pour vérifier que chaque groupe est bien au
              complet.
            </p>
          )}
          {isOwner && (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">Délai</span>
                <div className="flex items-center gap-3">
                  <button
                    aria-label="Réduire le délai"
                    className="icon-btn"
                    onClick={() => setPhotoDelay((d) => Math.max(1, d - 1))}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="display w-16 text-center text-lg">{photoDelay} min</span>
                  <button
                    aria-label="Augmenter le délai"
                    className="icon-btn"
                    onClick={() => setPhotoDelay((d) => Math.min(30, d + 1))}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <button
                className="btn-huge btn-huge-dark"
                disabled={teams.length === 0}
                onClick={askForPhoto}
              >
                <Camera className="h-5 w-5" /> Demander une photo à toutes les équipes
              </button>
            </>
          )}
          {currentSubmissions.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {currentSubmissions.map((s) => {
                const team = teams.find((t) => t.id === s.team_id);
                return (
                  <div key={s.id} className="flex flex-col items-center gap-1">
                    {photoUrls[s.id] ? (
                      <img
                        src={photoUrls[s.id]}
                        alt={team?.name ?? "équipe"}
                        className="h-20 w-20 rounded-xl object-cover"
                      />
                    ) : (
                      <div className="h-20 w-20 rounded-xl bg-muted" />
                    )}
                    <span className="max-w-full truncate text-xs font-semibold">
                      {team?.name ?? "Équipe"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {game?.photo_requested_at && teams.length > respondedTeamIds.size && (
            <p className="text-sm text-muted-foreground">
              En attente :{" "}
              {teams
                .filter((t) => !respondedTeamIds.has(t.id))
                .map((t) => t.name)
                .join(", ")}
            </p>
          )}
        </section>

        <section className="panel flex flex-col gap-1 p-4">
          <div className="section-title mb-2">
            <Trophy className="h-4 w-4" /> Classement final ({teams.length} groupes)
          </div>
          {ranked.length === 0 && (
            <p className="py-4 text-center text-muted-foreground">
              En attente des groupes… Donnez le code {code}.
            </p>
          )}
          {(finished ? validatedRanked : ranked).map((t, i) => (
            <div
              key={t.id}
              className={`flex items-center gap-3 rounded-xl border-b border-border px-2 py-3 last:border-0 ${
                i === 0 ? "rank-gold" : ""
              }`}
            >
              <span className="display w-6 text-xl text-muted-foreground">
                {i < 3 ? <span className="medal-spin">{["🥇", "🥈", "🥉"][i]}</span> : i + 1}
              </span>
              <span
                className="h-6 w-6 shrink-0 rounded-full border-2 border-foreground"
                style={{ backgroundColor: t.color }}
              />
              <span className="flex-1 truncate text-lg font-semibold">
                {t.name}
                {t.penalty_m2 > 0 && (
                  <span className="ml-2 text-xs font-semibold text-destructive">
                    -{formatArea(t.penalty_m2)}
                  </span>
                )}
              </span>
              <span className="display text-xl tabular-nums">{formatArea(t.score_m2)}</span>
            </div>
          ))}
          {finished && unvalidated.length > 0 && (
            <div className="mt-3 flex flex-col gap-1 border-t border-border pt-3">
              <span className="label-xs">Hors classement — pas revenues dans la zone à temps</span>
              {unvalidated.map((t) => (
                <div key={t.id} className="flex items-center gap-3 py-2 opacity-60">
                  <span
                    className="h-5 w-5 shrink-0 rounded-full border-2 border-foreground"
                    style={{ backgroundColor: t.color }}
                  />
                  <span className="flex-1 truncate font-semibold">{t.name}</span>
                  <span className="display text-base tabular-nums line-through">
                    {formatArea(t.score_m2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {ranked.length > 0 && (
          <section className="panel flex flex-col gap-1 p-4">
            <div className="section-title mb-2">
              <Medal className="h-4 w-4" /> Total conquis (indicatif)
            </div>
            <p className="mb-1 text-xs text-muted-foreground">
              Toute la surface jamais enfermée par chaque équipe, même reprise depuis. Ne compte pas
              pour le classement final.
            </p>
            {totalCapturedRanked.map((t, i) => (
              <div
                key={t.id}
                className="flex items-center gap-3 border-b border-border py-2 last:border-0 opacity-80"
              >
                <span className="w-6 text-center text-sm text-muted-foreground">{i + 1}</span>
                <span
                  className="h-5 w-5 shrink-0 rounded-full border-2 border-foreground"
                  style={{ backgroundColor: t.color }}
                />
                <span className="flex-1 truncate font-semibold">{t.name}</span>
                <span className="display text-base tabular-nums">
                  {formatArea(t.total_captured_m2)}
                </span>
              </div>
            ))}
          </section>
        )}

        <section className="panel flex flex-col gap-3 p-4">
          <div className="section-title">Messages</div>
          <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
            {messages.length === 0 && (
              <p className="py-2 text-center text-sm text-muted-foreground">Aucun message.</p>
            )}
            {messages.map((m) => {
              const label =
                m.sender === "prof"
                  ? m.team_id
                    ? `→ ${teams.find((t) => t.id === m.team_id)?.name ?? "équipe"}`
                    : "📢 À toutes les équipes"
                  : `${teams.find((t) => t.id === m.team_id)?.name ?? "Équipe"} →`;
              return (
                <div key={m.id} className="rounded-xl bg-muted px-3 py-2 text-sm">
                  <div className="label-xs">{label}</div>
                  <div>{m.body}</div>
                </div>
              );
            })}
          </div>
          {isOwner && (
            <div className="flex flex-col gap-2">
              <select
                className="field"
                value={messageTarget}
                onChange={(e) => setMessageTarget(e.target.value)}
              >
                <option value="all">Toutes les équipes</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  className="field"
                  placeholder="Votre message..."
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void sendMessage()}
                />
                <button
                  aria-label="Envoyer"
                  className="rounded-xl bg-primary p-3 text-primary-foreground"
                  onClick={sendMessage}
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
