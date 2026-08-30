import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bike,
  Bookmark,
  Camera,
  Download,
  Eye,
  EyeOff,
  Flag,
  Gamepad2,
  Grid3x3,
  Maximize2,
  MapPin,
  Medal,
  Minus,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Plus,
  QrCode,
  Send,
  Shield,
  ShieldAlert,
  Shuffle,
  Star,
  Timer,
  Trophy,
  Upload,
  Users,
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
import {
  deleteMessageTemplate,
  saveMessageTemplate,
  useMessageTemplates,
} from "@/lib/messageTemplates";
import { notifyMessage, requestNotificationPermission } from "@/lib/notify";
import { getPhotoUrl, requestPhotoCheck, usePhotoSubmissions } from "@/lib/photoCheck";
import {
  addLandmark,
  isLandmarkActive,
  removeLandmark,
  updateLandmark,
  useLandmarks,
  type LandmarkKind,
} from "@/lib/landmarks";
import { addForbiddenZone, removeForbiddenZone, useForbiddenZones } from "@/lib/forbiddenZones";
import { placeFlag, useFlags } from "@/lib/flags";
import { cellCenter, useGridCells } from "@/lib/grid";
import { resolveGraceStatus } from "@/lib/grace";
import {
  assignStudentTeam,
  downloadCsv,
  importRoster,
  parseIdoceoRoster,
  setStudentPresent,
  shuffleTeams,
  useStudents,
} from "@/lib/students";
import {
  applySavedPoint,
  deleteSavedPoint,
  saveSavedPoint,
  useSavedPoints,
} from "@/lib/savedPoints";
import {
  CAPTURE_CONSEQUENCE_LABELS,
  DEFAULT_CTF_CAPTURE_RADIUS_M,
  DEFAULT_CTF_TIME_PENALTY_M2,
  DEFAULT_FORBIDDEN_PENALTY_M2,
  DEFAULT_FORBIDDEN_RADIUS_M,
  DEFAULT_GRACE_MINUTES,
  DEFAULT_GRACE_PENALTY_PER_SECOND_M2,
  DEFAULT_GRID_CELL_SIZE_M,
  DEFAULT_GRID_HEIGHT_M,
  DEFAULT_GRID_RADIUS_M,
  DEFAULT_GRID_WIDTH_M,
  DEFAULT_LANDMARK_BONUS_M2,
  DEFAULT_LANDMARK_ICON,
  DEFAULT_RUNNING_BONUS_SPEED_KMH,
  DEFAULT_VEHICLE_PENALTY_M2,
  DEFAULT_VEHICLE_SPEED_THRESHOLD_KMH,
  GAME_MODE_DESCRIPTIONS,
  GAME_MODE_LABELS,
  GRID_CELL_SIZE_WARNING_THRESHOLD_M,
  LANDMARK_ICONS,
  MAX_GRID_CELL_SIZE_M,
  MAX_GRID_RADIUS_M,
  MAX_GRID_SIDE_M,
  MIN_GRID_CELL_SIZE_M,
  MIN_GRID_RADIUS_M,
  MIN_GRID_SIDE_M,
  TEAM_COLORS,
  formatArea,
  formatClock,
  formatCountdown,
  haversine,
  randomCode,
  type CaptureConsequence,
  type GameMode,
  type GridShape,
  type GracePenaltyMode,
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
  kind: LandmarkKind;
  onKind: (kind: LandmarkKind) => void;
  showShieldOption: boolean;
  bonus: number;
  onBonus: (updater: (b: number) => number) => void;
  shieldDuration: number;
  onShieldDuration: (updater: (s: number) => number) => void;
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
  kind,
  onKind,
  showShieldOption,
  bonus,
  onBonus,
  shieldDuration,
  onShieldDuration,
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
      {showShieldOption && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="seg-btn"
            data-active={kind === "points"}
            onClick={() => onKind("points")}
          >
            Points bonus
          </button>
          <button
            type="button"
            className="seg-btn"
            data-active={kind === "shield"}
            onClick={() => onKind("shield")}
          >
            Bouclier
          </button>
        </div>
      )}
      {!showShieldOption || kind === "points" ? (
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
      ) : (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">Durée d'immunité</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Réduire la durée"
              className="icon-btn"
              onClick={() => onShieldDuration((s) => Math.max(5, s - 5))}
            >
              <Minus className="h-4 w-4" />
            </button>
            <span className="display w-16 text-center text-lg">{shieldDuration}s</span>
            <button
              type="button"
              aria-label="Augmenter la durée"
              className="icon-btn"
              onClick={() => onShieldDuration((s) => Math.min(120, s + 5))}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
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
  const [panelOpen, setPanelOpen] = useState(true);

  const [gameId, setGameId] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("minutes");
  const [durationValue, setDurationValue] = useState(UNIT_DEFAULT.minutes);
  const [now, setNow] = useState(() => Date.now());
  const [placingMode, setPlacingMode] = useState<
    "none" | "zone" | "landmark" | "forbidden" | "grid_zone"
  >("none");
  const [zoneRadius, setZoneRadius] = useState(DEFAULT_ZONE_RADIUS);
  const [landmarkBonus, setLandmarkBonus] = useState(DEFAULT_LANDMARK_BONUS_M2);
  const [landmarkIconChoice, setLandmarkIconChoice] = useState<string>(DEFAULT_LANDMARK_ICON);
  const [landmarkKind, setLandmarkKind] = useState<LandmarkKind>("points");
  const [landmarkShieldDuration, setLandmarkShieldDuration] = useState(30);
  const [landmarkAppearAfter, setLandmarkAppearAfter] = useState(0);
  const [landmarkExpires, setLandmarkExpires] = useState(false);
  const [landmarkDisappearAfter, setLandmarkDisappearAfter] = useState(30);
  const [gameMode, setGameModeState] = useState<GameMode>("territoire");
  const [ctfConsequence, setCtfConsequence] = useState<CaptureConsequence>("return_to_base");
  const [ctfTimePenalty, setCtfTimePenalty] = useState(DEFAULT_CTF_TIME_PENALTY_M2);
  const [ctfCaptureRadius, setCtfCaptureRadius] = useState(DEFAULT_CTF_CAPTURE_RADIUS_M);
  const [gridRadius, setGridRadius] = useState(DEFAULT_GRID_RADIUS_M);
  const [gridShape, setGridShape] = useState<GridShape>("circle");
  const [gridWidth, setGridWidth] = useState(DEFAULT_GRID_WIDTH_M);
  const [gridHeight, setGridHeight] = useState(DEFAULT_GRID_HEIGHT_M);
  const [gridCellSize, setGridCellSize] = useState(DEFAULT_GRID_CELL_SIZE_M);
  const [gridShowOverlay, setGridShowOverlay] = useState(true);
  const [graceEnabled, setGraceEnabled] = useState(false);
  const [graceMinutes, setGraceMinutes] = useState(DEFAULT_GRACE_MINUTES);
  const [gracePenaltyMode, setGracePenaltyMode] = useState<GracePenaltyMode>("cancel");
  const [gracePenaltyPerSecond, setGracePenaltyPerSecond] = useState(
    DEFAULT_GRACE_PENALTY_PER_SECOND_M2,
  );
  const [vehicleAllowed, setVehicleAllowed] = useState(true);
  const [vehicleSpeedThreshold, setVehicleSpeedThreshold] = useState(
    DEFAULT_VEHICLE_SPEED_THRESHOLD_KMH,
  );
  const [vehiclePenalty, setVehiclePenalty] = useState(DEFAULT_VEHICLE_PENALTY_M2);
  const [placingFlagForTeam, setPlacingFlagForTeam] = useState<string | null>(null);
  const [editingLandmarkId, setEditingLandmarkId] = useState<string | null>(null);
  const [forbiddenRadius, setForbiddenRadius] = useState(DEFAULT_FORBIDDEN_RADIUS_M);
  const [forbiddenPenalty, setForbiddenPenalty] = useState(DEFAULT_FORBIDDEN_PENALTY_M2);
  const [forbiddenRunningOnly, setForbiddenRunningOnly] = useState(false);
  const [runningBonusEnabled, setRunningBonusEnabled] = useState(true);
  const [runningBonusSpeedKmh, setRunningBonusSpeedKmh] = useState(DEFAULT_RUNNING_BONUS_SPEED_KMH);
  const [messageBody, setMessageBody] = useState("");
  const [messageTarget, setMessageTarget] = useState<string>("all");
  const [selfPos, setSelfPos] = useState<[number, number] | null>(null);
  const [photoDelay, setPhotoDelay] = useState(3);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [view, setView] = useState<"dashboard" | "overview">("dashboard");
  const [teamCount, setTeamCount] = useState(4);
  const [rosterBusy, setRosterBusy] = useState(false);
  const stoppedRef = useRef(false);
  const radiusInitRef = useRef(false);
  const runningConfigInitRef = useRef(false);
  const ctfConfigInitRef = useRef(false);
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
  const { flags } = useFlags(gameId);
  const { cells: gridCells } = useGridCells(gameId);
  const { students } = useStudents(gameId);
  const { points: landmarkTemplates, refresh: refreshLandmarkTemplates } = useSavedPoints(
    user?.id ?? null,
    "landmark",
  );
  const { points: forbiddenTemplates, refresh: refreshForbiddenTemplates } = useSavedPoints(
    user?.id ?? null,
    "forbidden",
  );
  const { templates: messageTemplates, refresh: refreshMessageTemplates } = useMessageTemplates(
    user?.id ?? null,
  );

  useEffect(() => {
    if (!radiusInitRef.current && game?.return_radius_m != null) {
      setZoneRadius(game.return_radius_m);
      radiusInitRef.current = true;
    }
  }, [game?.return_radius_m]);

  useEffect(() => {
    if (!runningConfigInitRef.current && game != null) {
      setRunningBonusEnabled(game.running_bonus_enabled);
      setRunningBonusSpeedKmh(game.running_bonus_speed_kmh);
      setForbiddenRunningOnly(game.forbidden_zone_running_only);
      runningConfigInitRef.current = true;
    }
  }, [game]);

  useEffect(() => {
    if (!ctfConfigInitRef.current && game != null) {
      setGameModeState(game.mode);
      setCtfConsequence(game.ctf_capture_consequence);
      setCtfTimePenalty(game.ctf_time_penalty_m2);
      setCtfCaptureRadius(game.ctf_capture_radius_m);
      setGridRadius(game.grid_radius_m);
      setGridShape(game.grid_shape);
      setGridWidth(game.grid_width_m);
      setGridHeight(game.grid_height_m);
      setGridCellSize(game.grid_cell_size_m);
      setGridShowOverlay(game.grid_show_overlay);
      setGraceEnabled(game.grace_enabled);
      setGraceMinutes(game.grace_minutes);
      setGracePenaltyMode(game.grace_penalty_mode);
      setGracePenaltyPerSecond(game.grace_penalty_per_second_m2);
      setVehicleAllowed(game.vehicle_allowed);
      setVehicleSpeedThreshold(game.vehicle_speed_threshold_kmh);
      setVehiclePenalty(game.vehicle_penalty_m2);
      ctfConfigInitRef.current = true;
    }
  }, [game]);

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

    const useGrace = graceEnabled && game?.return_lat != null && game.return_lng != null;
    if (useGrace) {
      const graceEndsAt = new Date(Date.now() + graceMinutes * 60_000).toISOString();
      await supabase
        .from("games")
        .update({ status: "finished", grace_ends_at: graceEndsAt })
        .eq("id", gameId);
      const consequence =
        gracePenaltyMode === "cancel"
          ? "votre score sera annulé"
          : `votre score diminuera de ${gracePenaltyPerSecond} point${gracePenaltyPerSecond > 1 ? "s" : ""} par seconde de retard`;
      await sendProfMessage(
        gameId,
        `⏱️ La partie est terminée, les scores sont définitifs. Vous avez ${graceMinutes} minute${graceMinutes > 1 ? "s" : ""} pour revenir dans la zone de retour, sinon ${consequence}.`,
        null,
      );
    } else {
      // The return-zone-at-the-final-whistle rule is a territory-mode concept;
      // capture-the-flag and grille already reflect a team's real performance
      // in their score without it, so nobody gets excluded from the ranking.
      await Promise.all(
        teams.map((t) =>
          supabase
            .from("teams")
            .update({ validated: gameMode !== "territoire" ? true : withinReturnZone(t) })
            .eq("id", t.id),
        ),
      );
      await supabase.from("games").update({ status: "finished" }).eq("id", gameId);
    }
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

  const gridScoreByTeam = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of gridCells) m.set(c.owner_team_id, (m.get(c.owner_team_id) ?? 0) + 1);
    return m;
  }, [gridCells]);
  const graceStatusFor = (t: (typeof teams)[number]) =>
    game
      ? resolveGraceStatus(game, t, now)
      : { validated: t.validated, penalty: 0, remainingS: null };
  const isTeamValidated = (t: (typeof teams)[number]) =>
    game?.grace_ends_at ? graceStatusFor(t).validated : t.validated;
  const teamScore = (t: (typeof teams)[number]) => {
    // In grille mode, score_m2 is never touched by the game itself (cell
    // count is the real score), but penalty_m2 IS used there for flat
    // penalties (vehicle check) — so it has to be subtracted here instead
    // of relying on score_m2 already reflecting it, unlike territoire/CTF.
    const base =
      gameMode === "grille" ? (gridScoreByTeam.get(t.id) ?? 0) - t.penalty_m2 : t.score_m2;
    return Math.max(0, base - graceStatusFor(t).penalty);
  };
  const ranked = useMemo(
    () => [...teams].sort((a, b) => teamScore(b) - teamScore(a)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [teams, gameMode, gridScoreByTeam, game, now],
  );
  const finished = game?.status === "finished";
  const validatedRanked = useMemo(
    () => ranked.filter(isTeamValidated),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ranked, game, now],
  );
  const unvalidated = useMemo(
    () => ranked.filter((t) => !isTeamValidated(t)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ranked, game, now],
  );
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
        .map((l) => ({ id: l.id, lat: l.lat, lng: l.lng, icon: l.icon, kind: l.kind })),
    [landmarks, game?.started_at, now],
  );

  const mapForbiddenZones = useMemo(
    () => forbiddenZones.map((z) => ({ id: z.id, lat: z.lat, lng: z.lng, radiusM: z.radius_m })),
    [forbiddenZones],
  );

  const mapFlags = useMemo(
    () =>
      flags
        .filter((f) => f.status !== "awaiting_placement")
        .map((f) => {
          const owner = teams.find((tm) => tm.id === f.team_id);
          const carrier = f.carried_by_team_id
            ? teams.find((tm) => tm.id === f.carried_by_team_id)
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

  const gridZone = useMemo(
    () =>
      game?.grid_center_lat != null && game.grid_center_lng != null
        ? {
            lat: game.grid_center_lat,
            lng: game.grid_center_lng,
            shape: game.grid_shape,
            radiusM: game.grid_radius_m,
            widthM: game.grid_width_m,
            heightM: game.grid_height_m,
          }
        : null,
    [
      game?.grid_center_lat,
      game?.grid_center_lng,
      game?.grid_radius_m,
      game?.grid_shape,
      game?.grid_width_m,
      game?.grid_height_m,
    ],
  );

  const mapGridCells = useMemo(() => {
    if (game?.grid_center_lat == null || game.grid_center_lng == null) return [];
    const center: [number, number] = [game.grid_center_lat, game.grid_center_lng];
    const cellSize = game.grid_cell_size_m;
    return gridCells.map((c) => {
      const [lat, lng] = cellCenter(center, cellSize, c.row, c.col);
      const owner = teams.find((tm) => tm.id === c.owner_team_id);
      return { id: c.id, lat, lng, sizeM: cellSize, color: owner?.color ?? "#888" };
    });
  }, [gridCells, game?.grid_center_lat, game?.grid_center_lng, game?.grid_cell_size_m, teams]);

  const joinUrl =
    typeof window !== "undefined" ? `${window.location.origin}/rejoindre/${code}` : "";

  async function importRosterFile(file: File) {
    if (!gameId) return;
    setRosterBusy(true);
    try {
      const names = parseIdoceoRoster(await file.text());
      if (names.length === 0) {
        toast.error("Aucun élève trouvé dans ce fichier.");
        return;
      }
      await importRoster(gameId, names);
      toast.success(`${names.length} élèves importés.`);
    } catch {
      toast.error("Échec de l'import du CSV.");
    } finally {
      setRosterBusy(false);
    }
  }

  async function onShuffleTeams() {
    if (!gameId) return;
    setRosterBusy(true);
    try {
      await shuffleTeams(gameId, students, teamCount);
      toast.success(`${teamCount} équipes créées.`);
    } catch {
      toast.error("Échec de la répartition.");
    } finally {
      setRosterBusy(false);
    }
  }

  function exportIdoceoCsv() {
    const maxScore = Math.max(0, ...teams.map((tm) => teamScore(tm)));
    // iDoceo lit la 2e colonne comme une note numérique : pas de "%" ni de
    // virgule décimale, sinon la cellule est importée comme texte vide.
    const rows: string[][] = [["Élève", "Conquête (/100)"]];
    for (const s of students) {
      if (!s.present || !s.team_id) continue;
      const team = teams.find((tm) => tm.id === s.team_id);
      if (!team) continue;
      const pct = maxScore > 0 ? Math.round((teamScore(team) / maxScore) * 100) : 0;
      rows.push([s.name, String(pct)]);
    }

    downloadCsv(`conquete-${code}.csv`, rows);
  }

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
    const kind: LandmarkKind = gameMode === "capture_drapeau" ? landmarkKind : "points";
    try {
      await addLandmark(
        gameId,
        lat,
        lng,
        landmarkBonus,
        landmarkIconChoice,
        landmarkAppearAfter,
        landmarkExpires ? landmarkDisappearAfter : null,
        kind,
        landmarkShieldDuration,
      );
      setPlacingMode("none");
      toast.success(kind === "shield" ? "Bouclier placé !" : "Repère bonus placé !");
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
    setLandmarkKind(l.kind);
    setLandmarkBonus(l.bonus_m2);
    setLandmarkShieldDuration(l.shield_duration_s);
    setLandmarkAppearAfter(l.active_after_minutes);
    setLandmarkExpires(l.active_until_minutes != null);
    setLandmarkDisappearAfter(l.active_until_minutes ?? 30);
  }

  async function saveEditLandmark() {
    if (!editingLandmarkId || !isOwner) return;
    try {
      await updateLandmark(editingLandmarkId, {
        icon: landmarkIconChoice,
        kind: gameMode === "capture_drapeau" ? landmarkKind : "points",
        bonus_m2: landmarkBonus,
        shield_duration_s: landmarkShieldDuration,
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

  async function placeGridZone(lat: number, lng: number) {
    if (!gameId || !isOwner) return;
    await supabase
      .from("games")
      .update({
        grid_center_lat: lat,
        grid_center_lng: lng,
        grid_radius_m: gridRadius,
        grid_width_m: gridWidth,
        grid_height_m: gridHeight,
      })
      .eq("id", gameId);
    setPlacingMode("none");
    toast.success("Zone de jeu placée.");
  }

  async function updateGridRadius(next: number) {
    setGridRadius(next);
    if (!gameId || !isOwner || game?.grid_center_lat == null) return;
    await supabase.from("games").update({ grid_radius_m: next }).eq("id", gameId);
  }

  async function updateGridShape(next: GridShape) {
    setGridShape(next);
    if (!gameId || !isOwner) return;
    await supabase.from("games").update({ grid_shape: next }).eq("id", gameId);
  }

  async function updateGridWidth(next: number) {
    setGridWidth(next);
    if (!gameId || !isOwner || game?.grid_center_lat == null) return;
    await supabase.from("games").update({ grid_width_m: next }).eq("id", gameId);
  }

  async function updateGridHeight(next: number) {
    setGridHeight(next);
    if (!gameId || !isOwner || game?.grid_center_lat == null) return;
    await supabase.from("games").update({ grid_height_m: next }).eq("id", gameId);
  }

  async function updateGridCellSize(next: number) {
    setGridCellSize(next);
    if (!gameId || !isOwner) return;
    await supabase.from("games").update({ grid_cell_size_m: next }).eq("id", gameId);
  }

  async function updateGridShowOverlay(next: boolean) {
    setGridShowOverlay(next);
    if (!gameId || !isOwner) return;
    await supabase.from("games").update({ grid_show_overlay: next }).eq("id", gameId);
  }

  async function clearGridZone() {
    if (!gameId || !isOwner) return;
    await supabase
      .from("games")
      .update({ grid_center_lat: null, grid_center_lng: null })
      .eq("id", gameId);
  }

  async function updateGraceEnabled(next: boolean) {
    setGraceEnabled(next);
    if (!gameId || !isOwner) return;
    await supabase.from("games").update({ grace_enabled: next }).eq("id", gameId);
  }

  async function updateGraceMinutes(next: number) {
    setGraceMinutes(next);
    if (!gameId || !isOwner) return;
    await supabase.from("games").update({ grace_minutes: next }).eq("id", gameId);
  }

  async function updateGracePenaltyMode(next: GracePenaltyMode) {
    setGracePenaltyMode(next);
    if (!gameId || !isOwner) return;
    await supabase.from("games").update({ grace_penalty_mode: next }).eq("id", gameId);
  }

  async function updateGracePenaltyPerSecond(next: number) {
    setGracePenaltyPerSecond(next);
    if (!gameId || !isOwner) return;
    await supabase.from("games").update({ grace_penalty_per_second_m2: next }).eq("id", gameId);
  }

  async function updateVehicleAllowed(next: boolean) {
    setVehicleAllowed(next);
    if (!gameId || !isOwner) return;
    await supabase.from("games").update({ vehicle_allowed: next }).eq("id", gameId);
  }

  async function updateVehicleSpeedThreshold(next: number) {
    setVehicleSpeedThreshold(next);
    if (!gameId || !isOwner) return;
    await supabase.from("games").update({ vehicle_speed_threshold_kmh: next }).eq("id", gameId);
  }

  async function updateVehiclePenalty(next: number) {
    setVehiclePenalty(next);
    if (!gameId || !isOwner) return;
    await supabase.from("games").update({ vehicle_penalty_m2: next }).eq("id", gameId);
  }

  async function updateRunningBonusEnabled(next: boolean) {
    setRunningBonusEnabled(next);
    if (!gameId || !isOwner) return;
    await supabase.from("games").update({ running_bonus_enabled: next }).eq("id", gameId);
  }

  async function updateRunningBonusSpeed(next: number) {
    setRunningBonusSpeedKmh(next);
    if (!gameId || !isOwner) return;
    await supabase.from("games").update({ running_bonus_speed_kmh: next }).eq("id", gameId);
  }

  async function updateForbiddenRunningOnly(next: boolean) {
    setForbiddenRunningOnly(next);
    if (!gameId || !isOwner) return;
    await supabase.from("games").update({ forbidden_zone_running_only: next }).eq("id", gameId);
  }

  async function updateMode(next: GameMode) {
    setGameModeState(next);
    if (!gameId || !isOwner) return;
    await supabase.from("games").update({ mode: next }).eq("id", gameId);
  }

  async function updateCtfConsequence(next: CaptureConsequence) {
    setCtfConsequence(next);
    if (!gameId || !isOwner) return;
    await supabase.from("games").update({ ctf_capture_consequence: next }).eq("id", gameId);
  }

  async function updateCtfTimePenalty(next: number) {
    setCtfTimePenalty(next);
    if (!gameId || !isOwner) return;
    await supabase.from("games").update({ ctf_time_penalty_m2: next }).eq("id", gameId);
  }

  async function updateCtfCaptureRadius(next: number) {
    setCtfCaptureRadius(next);
    if (!gameId || !isOwner) return;
    await supabase.from("games").update({ ctf_capture_radius_m: next }).eq("id", gameId);
  }

  async function placeTeamFlag(lat: number, lng: number) {
    if (!gameId || !isOwner || !placingFlagForTeam) return;
    try {
      await placeFlag(gameId, placingFlagForTeam, lat, lng);
      setPlacingFlagForTeam(null);
      toast.success("Drapeau placé !");
    } catch {
      toast.error("Impossible de placer le drapeau.");
    }
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

  async function saveMessageAsTemplate() {
    if (!user || !messageBody.trim()) return;
    try {
      await saveMessageTemplate(user.id, messageBody.trim());
      toast.success("Message enregistré comme modèle !");
      void refreshMessageTemplates();
    } catch {
      toast.error("Impossible d'enregistrer le modèle.");
    }
  }

  async function removeMessageTemplate(id: string) {
    try {
      await deleteMessageTemplate(id);
      void refreshMessageTemplates();
    } catch {
      toast.error("Impossible de supprimer le modèle.");
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

  if (view === "overview") {
    return (
      <main className="relative h-[100dvh] w-full overflow-hidden">
        <div className="absolute inset-0">
          <MapCanvas
            center={center}
            teams={teams}
            territories={mapTerritories}
            returnZone={returnZone}
            landmarks={mapLandmarks}
            forbiddenZones={mapForbiddenZones}
            flags={mapFlags}
            gridZone={gridZone}
            gridCells={mapGridCells}
            mapStyle={game?.map_style}
          />
        </div>

        <div
          className="pointer-events-none absolute inset-x-3 z-[1000] flex flex-wrap items-center gap-2"
          style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <button
            className="nav-back pointer-events-auto"
            aria-label="Retour au tableau de bord"
            onClick={() => setView("dashboard")}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="hud-badge px-3 py-2">
            <div className="label-xs">Code</div>
            <div className="display text-2xl tracking-[0.3em]">{code}</div>
          </div>
          <div className="hud-badge px-3 py-2">
            <div className="label-xs">Temps</div>
            <div className="display text-2xl tabular-nums">{formatCountdown(remaining)}</div>
          </div>
        </div>

        <div
          className="pointer-events-auto absolute inset-x-0 bottom-0 z-[1000] mx-auto flex w-full max-w-md flex-col gap-2 p-3"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="panel flex max-h-40 flex-col gap-1 overflow-y-auto p-3">
            {ranked.length === 0 && (
              <p className="py-2 text-center text-sm text-muted-foreground">
                En attente des groupes…
              </p>
            )}
            {ranked.map((team, i) => (
              <div key={team.id} className="flex items-center gap-2 py-1">
                <span className="w-5 text-center text-sm text-muted-foreground">{i + 1}</span>
                <span
                  className="h-4 w-4 shrink-0 rounded-full border-2 border-foreground"
                  style={{ backgroundColor: team.color }}
                />
                <span className="flex-1 truncate text-sm font-semibold">{team.name}</span>
                <span className="display text-sm tabular-nums">
                  {gameMode === "capture_drapeau"
                    ? `🚩 ${team.flags_captured}`
                    : gameMode === "grille"
                      ? `${Math.round(teamScore(team))} cases`
                      : formatArea(teamScore(team))}
                </span>
              </div>
            ))}
          </div>
          {isOwner && (
            <div className="panel flex flex-col gap-2 p-3">
              <select
                className="field"
                value={messageTarget}
                onChange={(e) => setMessageTarget(e.target.value)}
              >
                <option value="all">Toutes les équipes</option>
                {teams.map((tm) => (
                  <option key={tm.id} value={tm.id}>
                    {tm.name}
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
                  className="icon-btn h-12 w-12 shrink-0 bg-primary text-primary-foreground"
                  onClick={sendMessage}
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col lg:h-[100dvh] lg:flex-row lg:overflow-hidden">
      <div
        className={`relative h-[45vh] min-h-[280px] w-full lg:h-full lg:shrink-0 lg:transition-[width] lg:duration-300 ${panelOpen ? "lg:w-2/5" : "lg:w-full"}`}
      >
        <MapCanvas
          center={center}
          teams={teams}
          territories={mapTerritories}
          returnZone={returnZone}
          landmarks={mapLandmarks}
          forbiddenZones={mapForbiddenZones}
          flags={mapFlags}
          gridZone={gridZone}
          gridCells={mapGridCells}
          mapStyle={game?.map_style}
          onMapClick={
            placingFlagForTeam
              ? placeTeamFlag
              : placingMode === "zone"
                ? placeZone
                : placingMode === "landmark"
                  ? placeLandmark
                  : placingMode === "forbidden"
                    ? placeForbidden
                    : placingMode === "grid_zone"
                      ? placeGridZone
                      : undefined
          }
        />
        <div
          className="pointer-events-none absolute inset-x-3 z-[1000] flex flex-wrap items-center gap-2"
          style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <Link to="/" className="nav-back pointer-events-auto" aria-label="Retour à l'accueil">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <button
            className="nav-back pointer-events-auto hidden lg:inline-flex"
            aria-label={panelOpen ? "Masquer le menu" : "Afficher le menu"}
            aria-pressed={!panelOpen}
            onClick={() => setPanelOpen((o) => !o)}
          >
            {panelOpen ? (
              <PanelRightClose className="h-5 w-5" />
            ) : (
              <PanelRightOpen className="h-5 w-5" />
            )}
          </button>
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
          {running && (
            <button
              className="nav-back pointer-events-auto"
              aria-label="Vue d'ensemble"
              onClick={() => setView("overview")}
            >
              <Eye className="h-5 w-5" />
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
        {(placingMode !== "none" || placingFlagForTeam) && (
          <div
            className="panel pointer-events-none absolute inset-x-3 z-[1000] px-4 py-3 text-center text-sm font-semibold"
            style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          >
            {placingFlagForTeam
              ? "Touchez la carte pour placer le drapeau de cette équipe"
              : placingMode === "zone"
                ? "Touchez la carte pour placer le centre de la zone de retour"
                : placingMode === "landmark"
                  ? "Touchez la carte pour placer le repère bonus"
                  : placingMode === "grid_zone"
                    ? "Touchez la carte pour placer le centre de la zone de jeu"
                    : "Touchez la carte pour placer la zone interdite"}
          </div>
        )}
      </div>

      <div
        className={`mx-auto flex w-full max-w-md flex-1 flex-col gap-5 p-4 lg:mx-0 lg:max-w-2xl lg:overflow-y-auto [&>*]:shrink-0 ${panelOpen ? "" : "lg:hidden"}`}
      >
        <header className="panel flex flex-col gap-4 p-4">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <div className="min-w-0">
              <div className="pill">
                <MapPin className="h-3.5 w-3.5" /> Tableau de bord
              </div>
              <h1 className="page-title mt-3 truncate text-3xl">
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
          <div className="section-title">
            <Gamepad2 className="h-4 w-4" /> Mode de jeu
          </div>
          {isOwner && game?.status === "lobby" ? (
            <div className="grid grid-cols-3 gap-2">
              <button
                className="seg-btn"
                data-active={gameMode === "territoire"}
                onClick={() => void updateMode("territoire")}
              >
                Territoire
              </button>
              <button
                className="seg-btn"
                data-active={gameMode === "capture_drapeau"}
                onClick={() => void updateMode("capture_drapeau")}
              >
                Drapeau
              </button>
              <button
                className="seg-btn"
                data-active={gameMode === "grille"}
                onClick={() => void updateMode("grille")}
              >
                Grille
              </button>
            </div>
          ) : (
            <p className="text-sm font-semibold">
              {GAME_MODE_LABELS[gameMode]}
              {game?.status !== "lobby" && isOwner && " (verrouillé après le lancement)"}
            </p>
          )}
          <p className="text-xs text-muted-foreground">{GAME_MODE_DESCRIPTIONS[gameMode]}</p>
        </section>

        {isOwner && game?.status === "lobby" && (
          <section className="panel flex flex-col gap-3 p-4">
            <div className="section-title">
              <Users className="h-4 w-4" /> Élèves
              {students.length > 0 && (
                <span className="ml-auto text-xs font-normal text-muted-foreground">
                  {students.filter((s) => s.present).length}/{students.length} présents
                </span>
              )}
            </div>

            {students.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Importez la liste de classe (export CSV iDoceo) pour prendre la présence et répartir
                les équipes automatiquement.
              </p>
            ) : (
              <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
                {students.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      checked={s.present}
                      onChange={(e) => void setStudentPresent(s.id, e.target.checked)}
                    />
                    <span
                      className={`flex-1 truncate text-sm ${
                        s.present ? "" : "text-muted-foreground line-through"
                      }`}
                    >
                      {s.name}
                    </span>
                    {teams.length > 0 && (
                      <select
                        className="field w-28 py-1 text-xs"
                        value={s.team_id ?? ""}
                        onChange={(e) => void assignStudentTeam(s.id, e.target.value || null)}
                      >
                        <option value="">—</option>
                        {teams.map((tm) => (
                          <option key={tm.id} value={tm.id}>
                            {tm.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            )}

            <label className="btn-huge btn-huge-dark cursor-pointer">
              <Upload className="h-5 w-5" />
              {students.length === 0 ? "Importer un CSV iDoceo" : "Réimporter un autre CSV"}
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                disabled={rosterBusy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void importRosterFile(file);
                  e.target.value = "";
                }}
              />
            </label>

            {students.length > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <span className="section-title">Nombre d'équipes</span>
                  <div className="flex items-center gap-3">
                    <button
                      aria-label="Réduire"
                      className="icon-btn"
                      onClick={() => setTeamCount((v) => Math.max(2, v - 1))}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="display w-10 text-center text-xl">{teamCount}</span>
                    <button
                      aria-label="Augmenter"
                      className="icon-btn"
                      onClick={() => setTeamCount((v) => Math.min(TEAM_COLORS.length, v + 1))}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <button
                  className="btn-huge btn-huge-dark"
                  disabled={rosterBusy}
                  onClick={() => void onShuffleTeams()}
                >
                  <Shuffle className="h-5 w-5" /> Répartir aléatoirement en {teamCount} équipes
                </button>
              </>
            )}
          </section>
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
              <MapPin className="h-4 w-4" />{" "}
              {gameMode === "capture_drapeau" ? "Zone de dépôt des drapeaux" : "Zone de retour"}
            </div>
            {returnZone && isOwner && (
              <button aria-label="Supprimer la zone" className="icon-btn" onClick={clearZone}>
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {gameMode === "capture_drapeau" ? (
            <p className="text-sm text-muted-foreground">
              {returnZone
                ? "Les équipes doivent ramener un drapeau capturé dans cette zone pour marquer un point."
                : "Aucune zone définie : chaque équipe doit ramener un drapeau capturé jusqu'à sa propre base."}
            </p>
          ) : gameMode === "grille" ? (
            <p className="text-sm text-muted-foreground">
              {returnZone
                ? "Utilisée uniquement pour le délai de retour en fin de partie (voir plus bas) ; sans effet pendant que la grille se joue."
                : "Optionnelle en mode Grille : ne sert qu'au délai de retour en fin de partie (voir plus bas)."}
            </p>
          ) : returnZone ? (
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
            <Timer className="h-4 w-4" /> Délai de retour en fin de partie
          </div>
          <p className="text-sm text-muted-foreground">
            À la fin du chrono, les équipes ont un délai pour revenir dans la zone de retour
            ci-dessus avant que leur score ne soit définitif.
          </p>
          {isOwner && (
            <>
              <label className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">Activer</span>
                <input
                  type="checkbox"
                  className="h-5 w-5 shrink-0"
                  checked={graceEnabled}
                  onChange={(e) => void updateGraceEnabled(e.target.checked)}
                />
              </label>
              {graceEnabled && !returnZone && (
                <p className="text-xs text-muted-foreground">
                  ⚠️ Placez d'abord une zone de retour ci-dessus : sans elle, ce délai n'a aucun
                  effet.
                </p>
              )}
              {graceEnabled && (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">Délai</span>
                    <div className="flex items-center gap-3">
                      <button
                        aria-label="Réduire le délai"
                        className="icon-btn"
                        onClick={() => void updateGraceMinutes(Math.max(1, graceMinutes - 1))}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="display w-16 text-center text-lg">{graceMinutes} min</span>
                      <button
                        aria-label="Augmenter le délai"
                        className="icon-btn"
                        onClick={() => void updateGraceMinutes(Math.min(30, graceMinutes + 1))}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-semibold">Si le délai est dépassé</span>
                    <select
                      className="field"
                      value={gracePenaltyMode}
                      onChange={(e) =>
                        void updateGracePenaltyMode(e.target.value as GracePenaltyMode)
                      }
                    >
                      <option value="cancel">Score annulé (hors classement)</option>
                      <option value="per_second">Pénalité par seconde de retard</option>
                    </select>
                  </label>
                  {gracePenaltyMode === "per_second" && (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold">Pénalité</span>
                      <div className="flex items-center gap-3">
                        <button
                          aria-label="Réduire la pénalité"
                          className="icon-btn"
                          onClick={() =>
                            void updateGracePenaltyPerSecond(Math.max(1, gracePenaltyPerSecond - 1))
                          }
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="display w-24 text-center text-lg">
                          -{gracePenaltyPerSecond}/s
                        </span>
                        <button
                          aria-label="Augmenter la pénalité"
                          className="icon-btn"
                          onClick={() =>
                            void updateGracePenaltyPerSecond(
                              Math.min(50, gracePenaltyPerSecond + 1),
                            )
                          }
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </section>

        <section className="panel flex flex-col gap-3 p-4">
          <div className="section-title">
            <Bike className="h-4 w-4" /> Véhicules
          </div>
          <p className="text-sm text-muted-foreground">
            {vehicleAllowed
              ? "Vélo, trottinette, voiture… autorisés sans restriction."
              : "Une équipe qui maintient une vitesse suspecte plusieurs secondes reçoit une grosse pénalité."}
          </p>
          {isOwner && (
            <>
              <label className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">Autoriser les véhicules</span>
                <input
                  type="checkbox"
                  className="h-5 w-5 shrink-0"
                  checked={vehicleAllowed}
                  onChange={(e) => void updateVehicleAllowed(e.target.checked)}
                />
              </label>
              {!vehicleAllowed && (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">Seuil de vitesse</span>
                    <div className="flex items-center gap-3">
                      <button
                        aria-label="Réduire le seuil"
                        className="icon-btn"
                        onClick={() =>
                          void updateVehicleSpeedThreshold(Math.max(10, vehicleSpeedThreshold - 1))
                        }
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="display w-20 text-center text-lg">
                        {vehicleSpeedThreshold} km/h
                      </span>
                      <button
                        aria-label="Augmenter le seuil"
                        className="icon-btn"
                        onClick={() =>
                          void updateVehicleSpeedThreshold(Math.min(40, vehicleSpeedThreshold + 1))
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Vitesse soutenue pendant au moins 5 secondes (pas un simple pic GPS). Une course
                    rapide peut ponctuellement dépasser {vehicleSpeedThreshold} km/h ; ne descendez
                    pas trop bas pour éviter les faux positifs.
                  </p>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">Pénalité</span>
                    <div className="flex items-center gap-3">
                      <button
                        aria-label="Réduire la pénalité"
                        className="icon-btn"
                        onClick={() => void updateVehiclePenalty(Math.max(50, vehiclePenalty - 50))}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="display w-24 text-center text-lg">
                        -{formatArea(vehiclePenalty)}
                      </span>
                      <button
                        aria-label="Augmenter la pénalité"
                        className="icon-btn"
                        onClick={() =>
                          void updateVehiclePenalty(Math.min(2000, vehiclePenalty + 50))
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </section>

        {gameMode === "grille" && (
          <section className="panel flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
              <div className="section-title">
                <Grid3x3 className="h-4 w-4" /> Zone de jeu
              </div>
              {gridZone && isOwner && (
                <button aria-label="Supprimer la zone" className="icon-btn" onClick={clearGridZone}>
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {gridZone
                ? "La grille recouvre cette zone : chaque case prend la couleur de la dernière équipe passée dessus."
                : "Placez le centre de la zone où la partie doit se dérouler (cour, terrain de sport…)."}
            </p>
            {isOwner && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="seg-btn"
                    data-active={gridShape === "circle"}
                    onClick={() => void updateGridShape("circle")}
                  >
                    Cercle
                  </button>
                  <button
                    className="seg-btn"
                    data-active={gridShape === "rectangle"}
                    onClick={() => void updateGridShape("rectangle")}
                  >
                    Rectangle / carré
                  </button>
                </div>
                {gridShape === "circle" ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">Rayon</span>
                    <div className="flex items-center gap-3">
                      <button
                        aria-label="Réduire le rayon"
                        className="icon-btn"
                        onClick={() =>
                          void updateGridRadius(Math.max(MIN_GRID_RADIUS_M, gridRadius - 10))
                        }
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="display w-16 text-center text-lg">{gridRadius} m</span>
                      <button
                        aria-label="Augmenter le rayon"
                        className="icon-btn"
                        onClick={() =>
                          void updateGridRadius(Math.min(MAX_GRID_RADIUS_M, gridRadius + 10))
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold">Largeur</span>
                      <div className="flex items-center gap-3">
                        <button
                          aria-label="Réduire la largeur"
                          className="icon-btn"
                          onClick={() =>
                            void updateGridWidth(Math.max(MIN_GRID_SIDE_M, gridWidth - 10))
                          }
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="display w-16 text-center text-lg">{gridWidth} m</span>
                        <button
                          aria-label="Augmenter la largeur"
                          className="icon-btn"
                          onClick={() =>
                            void updateGridWidth(Math.min(MAX_GRID_SIDE_M, gridWidth + 10))
                          }
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold">Hauteur</span>
                      <div className="flex items-center gap-3">
                        <button
                          aria-label="Réduire la hauteur"
                          className="icon-btn"
                          onClick={() =>
                            void updateGridHeight(Math.max(MIN_GRID_SIDE_M, gridHeight - 10))
                          }
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="display w-16 text-center text-lg">{gridHeight} m</span>
                        <button
                          aria-label="Augmenter la hauteur"
                          className="icon-btn"
                          onClick={() =>
                            void updateGridHeight(Math.min(MAX_GRID_SIDE_M, gridHeight + 10))
                          }
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Largeur = hauteur pour un carré.
                    </p>
                  </>
                )}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">Taille des cases</span>
                  <div className="flex items-center gap-3">
                    <button
                      aria-label="Réduire la taille des cases"
                      className="icon-btn"
                      onClick={() =>
                        void updateGridCellSize(Math.max(MIN_GRID_CELL_SIZE_M, gridCellSize - 1))
                      }
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="display w-16 text-center text-lg">{gridCellSize} m</span>
                    <button
                      aria-label="Augmenter la taille des cases"
                      className="icon-btn"
                      onClick={() =>
                        void updateGridCellSize(Math.min(MAX_GRID_CELL_SIZE_M, gridCellSize + 1))
                      }
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {gridCellSize < GRID_CELL_SIZE_WARNING_THRESHOLD_M && (
                  <p className="text-xs text-muted-foreground">
                    ⚠️ En dessous de {GRID_CELL_SIZE_WARNING_THRESHOLD_M} m, les cases peuvent
                    changer de couleur de façon erratique à cause de l'imprécision du GPS
                    (généralement 3 à 10 m).
                  </p>
                )}
                <div className="flex flex-col gap-2">
                  <span className="label-xs">Grille visible par les équipes</span>
                  <button
                    type="button"
                    aria-pressed={gridShowOverlay}
                    className={`btn-huge ${gridShowOverlay ? "btn-huge-accent" : "btn-huge-dark"}`}
                    onClick={() => void updateGridShowOverlay(!gridShowOverlay)}
                  >
                    {gridShowOverlay ? (
                      <span className="flex items-center justify-center gap-2">
                        <Eye className="h-5 w-5" /> Grille affichée
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <EyeOff className="h-5 w-5" /> Grille masquée
                      </span>
                    )}
                  </button>
                </div>

                {!gridShowOverlay && (
                  <p className="text-xs text-muted-foreground">
                    Les équipes ne verront plus les cases colorées sur leur carte, seulement leur
                    propre compteur de cases contrôlées : elles jouent au feeling GPS plutôt qu'en
                    regardant la grille se colorier en direct.
                  </p>
                )}
                <button
                  className={`btn-huge ${placingMode === "grid_zone" ? "btn-huge-accent" : "btn-huge-dark"}`}
                  onClick={() => setPlacingMode((p) => (p === "grid_zone" ? "none" : "grid_zone"))}
                >
                  {placingMode === "grid_zone"
                    ? "Touchez la carte..."
                    : gridZone
                      ? "Déplacer la zone"
                      : "Placer sur la carte"}
                </button>
              </>
            )}
          </section>
        )}

        {gameMode === "capture_drapeau" && (
          <section className="panel flex flex-col gap-3 p-4">
            <div className="section-title">
              <Flag className="h-4 w-4" /> Drapeaux
            </div>
            <p className="text-sm text-muted-foreground">
              Chaque équipe défend un drapeau. Les autres doivent le capturer et le ramener à la
              zone de dépôt sans se faire toucher.
            </p>
            {isOwner && (
              <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-semibold">Si l'équipe porteuse est touchée</span>
                  <select
                    className="field"
                    value={ctfConsequence}
                    onChange={(e) =>
                      void updateCtfConsequence(e.target.value as CaptureConsequence)
                    }
                  >
                    {Object.entries(CAPTURE_CONSEQUENCE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                {ctfConsequence === "time_penalty" && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">Pénalité</span>
                    <div className="flex items-center gap-3">
                      <button
                        aria-label="Réduire la pénalité"
                        className="icon-btn"
                        onClick={() => void updateCtfTimePenalty(Math.max(10, ctfTimePenalty - 10))}
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="display w-24 text-center text-lg">
                        -{formatArea(ctfTimePenalty)}
                      </span>
                      <button
                        aria-label="Augmenter la pénalité"
                        className="icon-btn"
                        onClick={() =>
                          void updateCtfTimePenalty(Math.min(500, ctfTimePenalty + 10))
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">Distance de capture</span>
                  <div className="flex items-center gap-3">
                    <button
                      aria-label="Réduire la distance"
                      className="icon-btn"
                      onClick={() => void updateCtfCaptureRadius(Math.max(3, ctfCaptureRadius - 1))}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="display w-16 text-center text-lg">{ctfCaptureRadius} m</span>
                    <button
                      aria-label="Augmenter la distance"
                      className="icon-btn"
                      onClick={() =>
                        void updateCtfCaptureRadius(Math.min(30, ctfCaptureRadius + 1))
                      }
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-1">
              {teams.length === 0 && (
                <p className="py-2 text-center text-sm text-muted-foreground">
                  En attente des groupes…
                </p>
              )}
              {teams.map((tm) => {
                const flag = flags.find((f) => f.team_id === tm.id);
                const label = !flag
                  ? "Pas encore placé"
                  : flag.status === "home"
                    ? "À la base"
                    : flag.status === "carried"
                      ? `Porté par ${teams.find((x) => x.id === flag.carried_by_team_id)?.name ?? "?"}`
                      : flag.status === "dropped"
                        ? "Au sol"
                        : "En attente de replacement";
                return (
                  <div
                    key={tm.id}
                    className="flex items-center gap-3 border-b border-border py-2 last:border-0"
                  >
                    <span
                      className="h-4 w-4 shrink-0 rounded-full border-2 border-foreground"
                      style={{ backgroundColor: tm.color }}
                    />
                    <span className="flex-1 text-sm font-semibold">{tm.name}</span>
                    <span className="text-sm text-muted-foreground">{label}</span>
                    {isOwner && (
                      <button
                        className="mini-btn"
                        onClick={() => setPlacingFlagForTeam((p) => (p === tm.id ? null : tm.id))}
                      >
                        {placingFlagForTeam === tm.id
                          ? "Touchez la carte…"
                          : flag
                            ? "Replacer"
                            : "Placer"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {gameMode === "territoire" && (
          <section className="panel flex flex-col gap-3 p-4">
            <div className="section-title">
              <Flag className="h-4 w-4" /> Bonus course
            </div>
            <p className="text-sm text-muted-foreground">
              Une boucle fermée en courant rapporte plus de points qu'une boucle marchée.
            </p>
            {isOwner ? (
              <>
                <label className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">Activer le bonus course</span>
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={runningBonusEnabled}
                    onChange={(e) => void updateRunningBonusEnabled(e.target.checked)}
                  />
                </label>
                {runningBonusEnabled && (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold">Vitesse minimale</span>
                    <div className="flex items-center gap-3">
                      <button
                        aria-label="Réduire la vitesse"
                        className="icon-btn"
                        onClick={() =>
                          void updateRunningBonusSpeed(Math.max(4, runningBonusSpeedKmh - 0.5))
                        }
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="display w-20 text-center text-lg">
                        {runningBonusSpeedKmh} km/h
                      </span>
                      <button
                        aria-label="Augmenter la vitesse"
                        className="icon-btn"
                        onClick={() =>
                          void updateRunningBonusSpeed(Math.min(20, runningBonusSpeedKmh + 0.5))
                        }
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {runningBonusEnabled
                  ? `Bonus actif à partir de ${runningBonusSpeedKmh} km/h.`
                  : "Bonus désactivé pour cette partie."}
              </p>
            )}
          </section>
        )}

        {gameMode !== "grille" && (
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
                  kind={landmarkKind}
                  onKind={setLandmarkKind}
                  showShieldOption={gameMode === "capture_drapeau"}
                  bonus={landmarkBonus}
                  onBonus={setLandmarkBonus}
                  shieldDuration={landmarkShieldDuration}
                  onShieldDuration={setLandmarkShieldDuration}
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
                        <span className="flex items-center gap-1 text-sm font-semibold text-muted-foreground">
                          {l.kind === "shield" ? (
                            <>
                              <Shield className="h-3.5 w-3.5" /> {l.shield_duration_s}s
                            </>
                          ) : (
                            formatArea(l.bonus_m2)
                          )}
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
                            kind={landmarkKind}
                            onKind={setLandmarkKind}
                            showShieldOption={gameMode === "capture_drapeau"}
                            bonus={landmarkBonus}
                            onBonus={setLandmarkBonus}
                            shieldDuration={landmarkShieldDuration}
                            onShieldDuration={setLandmarkShieldDuration}
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
        )}

        {gameMode !== "grille" && (
          <section className="panel flex flex-col gap-3 p-4">
            <div className="section-title">
              <ShieldAlert className="h-4 w-4" /> Zones interdites
            </div>
            <p className="text-sm text-muted-foreground">
              Une équipe qui pénètre dans une zone interdite perd des points sur son score final.
            </p>
            {isOwner && (
              <>
                <label className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">
                    Pénaliser seulement en cas de traversée en courant
                  </span>
                  <input
                    type="checkbox"
                    className="h-5 w-5 shrink-0"
                    checked={forbiddenRunningOnly}
                    onChange={(e) => void updateForbiddenRunningOnly(e.target.checked)}
                  />
                </label>
                {forbiddenRunningOnly && (
                  <p className="text-xs text-muted-foreground">
                    Une équipe qui marche dans une zone interdite (ex. traverser une rue au pas) ne
                    sera pas pénalisée ; seule une traversée en courant compte.
                  </p>
                )}
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
                  {placingMode === "forbidden"
                    ? "Touchez la carte..."
                    : "Ajouter une zone interdite"}
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
        )}

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
                {graceStatusFor(t).remainingS != null && (
                  <span className="ml-2 text-xs font-semibold text-accent">
                    ⏳ {formatClock(graceStatusFor(t).remainingS!)}
                  </span>
                )}
              </span>
              <span className="flex flex-col items-end">
                <span className="display text-xl tabular-nums">
                  {gameMode === "grille"
                    ? `${Math.round(teamScore(t))} case${Math.round(teamScore(t)) > 1 ? "s" : ""}`
                    : formatArea(teamScore(t))}
                </span>
                {gameMode === "capture_drapeau" && (
                  <span className="text-xs text-muted-foreground">🚩 {t.flags_captured}</span>
                )}
              </span>
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
                    {gameMode === "grille"
                      ? `${Math.round(teamScore(t))} case${Math.round(teamScore(t)) > 1 ? "s" : ""}`
                      : formatArea(teamScore(t))}
                  </span>
                </div>
              ))}
            </div>
          )}
          {finished && students.length > 0 && (
            <button className="btn-huge btn-huge-dark mt-2" onClick={exportIdoceoCsv}>
              <Download className="h-5 w-5" /> Exporter CSV (iDoceo)
            </button>
          )}
        </section>

        {ranked.length > 0 && gameMode === "territoire" && (
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
                  aria-label="Enregistrer comme modèle"
                  className="icon-btn"
                  disabled={!messageBody.trim()}
                  onClick={() => void saveMessageAsTemplate()}
                >
                  <Bookmark className="h-5 w-5" />
                </button>
                <button
                  aria-label="Envoyer"
                  className="rounded-xl bg-primary p-3 text-primary-foreground"
                  onClick={sendMessage}
                >
                  <Send className="h-5 w-5" />
                </button>
              </div>
              {messageTemplates.length > 0 && (
                <div className="mt-1 flex flex-col gap-1 border-t border-border pt-2">
                  <span className="label-xs">Mes modèles</span>
                  {messageTemplates.map((t) => (
                    <div key={t.id} className="flex items-center gap-3 py-1">
                      <Bookmark className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate text-sm">{t.body}</span>
                      <button className="mini-btn" onClick={() => setMessageBody(t.body)}>
                        Utiliser
                      </button>
                      <button
                        aria-label="Supprimer le modèle"
                        onClick={() => void removeMessageTemplate(t.id)}
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
