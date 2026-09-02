export type TeamColor = { name: string; hex: string };

export const TEAM_COLORS: TeamColor[] = [
  { name: "Rouge", hex: "#e63946" },
  { name: "Bleu", hex: "#1d6fe0" },
  { name: "Vert", hex: "#2a9d3f" },
  { name: "Orange", hex: "#f77f00" },
  { name: "Violet", hex: "#8338ec" },
  { name: "Cyan", hex: "#0bb4c4" },
  { name: "Rose", hex: "#ef476f" },
  { name: "Jaune", hex: "#e9c500" },
  { name: "Turquoise", hex: "#06d6a0" },
  { name: "Indigo", hex: "#3a0ca3" },
  { name: "Marron", hex: "#7f4f24" },
  { name: "Gris", hex: "#495057" },
  { name: "Lime", hex: "#a3e635" },
  { name: "Bordeaux", hex: "#9d0208" },
  { name: "Bleu ciel", hex: "#48cae4" },
  { name: "Magenta", hex: "#b5179e" },
];

export const MIN_LOOP_DISTANCE_M = 100;
export const CLOSE_RADIUS_M = 20;

/** "auto" closes a loop by itself once it returns near its start; "manual"
 * requires the player to confirm — useful when there's no minimum distance
 * to force a walk, so a false auto-detection near home wouldn't surprise them. */
export type LoopCloseMode = "auto" | "manual";
export const DEFAULT_LOOP_CLOSE_MODE: LoopCloseMode = "auto";

/** Default speed (km/h) above which a closed loop counts as "run"; configurable per game. */
export const DEFAULT_RUNNING_BONUS_SPEED_KMH = 8;
/** A loop closed at or above this average speed (~8 km/h, a brisk jog) counts as "run". */
export const RUNNING_SPEED_MS = kmhToMs(DEFAULT_RUNNING_BONUS_SPEED_KMH);
/** Extra score credit multiplier applied to a loop closed while running. */
export const RUNNING_BONUS_MULTIPLIER = 1.5;

export function kmhToMs(kmh: number): number {
  return kmh / 3.6;
}

export const LANDMARK_CLAIM_RADIUS_M = 15;
export const DEFAULT_LANDMARK_BONUS_M2 = 30;
export const LANDMARK_ICONS = ["⭐", "🏆", "💎", "🔥", "🎯", "🚩", "🎁", "👑"] as const;
export const DEFAULT_LANDMARK_ICON: string = LANDMARK_ICONS[0];

export const DEFAULT_FORBIDDEN_RADIUS_M = 15;
export const DEFAULT_FORBIDDEN_PENALTY_M2 = 30;
/** Re-entering an already-penalized forbidden zone only counts again after this long. */
export const FORBIDDEN_PENALTY_COOLDOWN_MS = 30_000;

export type GameMode = "territoire" | "capture_drapeau" | "grille" | "circuit";

export const GAME_MODE_LABELS: Record<GameMode, string> = {
  territoire: "Territoire",
  capture_drapeau: "Capture du drapeau",
  grille: "Grille",
  circuit: "Circuit",
};

export const GAME_MODE_DESCRIPTIONS: Record<GameMode, string> = {
  territoire: "Les équipes ferment des boucles GPS pour capturer du territoire.",
  capture_drapeau:
    "Chaque équipe défend un drapeau et doit capturer ceux des autres pour les ramener à la zone de dépôt.",
  grille:
    "La zone de jeu est divisée en cases : chaque case prend la couleur de la dernière équipe qui l'a traversée.",
  circuit:
    "Course chronométrée façon Mario Kart : bouclez le circuit dessiné par le prof, ramassez des objets, le temps le plus rapide gagne.",
};

export type CircuitItemKind = "shield" | "boost" | "banana" | "lightning";

export const CIRCUIT_ITEM_KINDS: CircuitItemKind[] = ["shield", "boost", "banana", "lightning"];

export const CIRCUIT_ITEM_LABELS: Record<CircuitItemKind, string> = {
  shield: "Bouclier",
  boost: "Boost",
  banana: "Banane",
  lightning: "Foudre",
};

export const CIRCUIT_ITEM_ICONS: Record<CircuitItemKind, string> = {
  shield: "🛡️",
  boost: "🚀",
  banana: "🍌",
  lightning: "⚡",
};

export const DEFAULT_CIRCUIT_CHECKPOINT_COUNT = 8;
export const MIN_CIRCUIT_CHECKPOINT_COUNT = 4;
export const MAX_CIRCUIT_CHECKPOINT_COUNT = 20;
export const DEFAULT_CIRCUIT_LAP_COUNT = 3;
export const DEFAULT_CIRCUIT_CAPTURE_RADIUS_M = 12;
export const DEFAULT_CIRCUIT_ITEM_COOLDOWN_S = 8;
export const DEFAULT_CIRCUIT_BANANA_PENALTY_S = 15;
export const DEFAULT_CIRCUIT_BOOST_BONUS_S = 10;
export const DEFAULT_CIRCUIT_LIGHTNING_PENALTY_S = 20;
/** How close a team must get to a mystery box or a dropped banana to trigger it. */
export const CIRCUIT_ITEM_RADIUS_M = 10;

export type CaptureConsequence =
  "time_penalty" | "return_to_base" | "flag_dropped" | "organizer_replaces";

export const CAPTURE_CONSEQUENCE_LABELS: Record<CaptureConsequence, string> = {
  time_penalty: "Pénalité de points",
  return_to_base: "Retour à la base (sans pénalité)",
  flag_dropped: "Le drapeau tombe sur place",
  organizer_replaces: "L'organisateur replace le drapeau",
};

/** Points a team scores for delivering a captured enemy flag. */
export const CTF_CAPTURE_POINTS = 100;
export const DEFAULT_CTF_TIME_PENALTY_M2 = 50;
export const DEFAULT_CTF_CAPTURE_RADIUS_M = 8;
/** How close a team must get to a flag (at its base or on the ground) to pick it up. */
export const FLAG_PICKUP_RADIUS_M = 15;

export const DEFAULT_GRID_RADIUS_M = 40;
export const MIN_GRID_RADIUS_M = 10;
export const MAX_GRID_RADIUS_M = 300;
export const DEFAULT_GRID_CELL_SIZE_M = 6;
export const MIN_GRID_CELL_SIZE_M = 3;
export const MAX_GRID_CELL_SIZE_M = 15;
/** Below this cell size, GPS jitter alone can flip a cell's color; shown as a warning. */
export const GRID_CELL_SIZE_WARNING_THRESHOLD_M = 5;
/** 0 = disabled (any speed captures a cell, as before); otherwise a cell only
 * counts while moving at least this fast, to discourage slow walking. */
export const DEFAULT_GRID_MIN_SPEED_KMH = 0;
export const MAX_GRID_MIN_SPEED_KMH = 15;

export type GridShape = "circle" | "rectangle";
export const DEFAULT_GRID_WIDTH_M = 80;
export const DEFAULT_GRID_HEIGHT_M = 80;
export const MIN_GRID_SIDE_M = 20;
export const MAX_GRID_SIDE_M = 300;

export type GracePenaltyMode = "cancel" | "per_second";
export const DEFAULT_GRACE_MINUTES = 5;
export const DEFAULT_GRACE_PENALTY_PER_SECOND_M2 = 2;

/** Above this sustained speed, a team is presumed to be on a bike/scooter/car. */
export const DEFAULT_VEHICLE_SPEED_THRESHOLD_KMH = 18;
export const DEFAULT_VEHICLE_PENALTY_M2 = 200;
/** How long a team must sustain the speed before it counts (filters GPS spikes). */
export const VEHICLE_SUSTAINED_MS = 5_000;

export function randomCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/** Distance in meters between two [lat, lng] points. */
export function haversine(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatArea(m2: number): string {
  if (m2 >= 10000) return `${(m2 / 10000).toFixed(2)} ha`;
  return `${Math.round(m2).toLocaleString("fr-FR")} m²`;
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Like formatClock, but switches to "Xj HHh" / "Xh MMm" for a multi-day Challenge. */
export function formatCountdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s >= 86400) {
    const days = Math.floor(s / 86400);
    const hours = Math.floor((s % 86400) / 3600);
    return `${days}j ${String(hours).padStart(2, "0")}h`;
  }
  if (s >= 3600) {
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }
  return formatClock(s);
}

export const teamStorageKey = (code: string) => `conquete:team:${code}`;
/** In async mode, remembers which student this device is playing as for a given team. */
export const studentStorageKey = (teamId: string) => `conquete:student:${teamId}`;

export type MyTeamEntry = { teamId: string; code: string };
const MY_TEAMS_KEY = "conquete:my-teams";
/** A device can accumulate teams across a whole school year — cap so the
 * home screen's resume list (and the storage itself) doesn't grow forever. */
const MAX_MY_TEAMS = 20;

/** Every team this device has joined or resumed, most recent last. */
export function getMyTeams(): MyTeamEntry[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(MY_TEAMS_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as MyTeamEntry[]) : [];
  } catch {
    return [];
  }
}

export function setMyTeams(entries: MyTeamEntry[]): void {
  localStorage.setItem(MY_TEAMS_KEY, JSON.stringify(entries));
}

/** Records that this device just joined/resumed a team, for the home screen's list. */
export function rememberMyTeam(teamId: string, code: string): void {
  const next = [...getMyTeams().filter((t) => t.teamId !== teamId), { teamId, code }].slice(
    -MAX_MY_TEAMS,
  );
  setMyTeams(next);
}

/**
 * Retries a Supabase query a few times before giving up — a transient
 * network hiccup (weak school WiFi, exactly the moment every device hits
 * the server at once when the prof starts the game) must not be mistaken
 * for "this team doesn't exist", which is what used to force a full
 * QR-code rejoin over what was really just one failed request.
 */
/**
 * Races a Supabase call against a timeout — the client has none built in,
 * so a stalled request (weak school WiFi) would otherwise hang forever
 * instead of failing and letting the caller retry on the next attempt.
 */
export function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Délai dépassé (${Math.round(ms / 1000)}s).`)), ms),
    ),
  ]);
}

export async function fetchWithRetry<T>(
  run: () => PromiseLike<{ data: T | null; error: unknown }>,
  attempts = 3,
  delayMs = 800,
): Promise<{ data: T | null; error: unknown }> {
  let last: { data: T | null; error: unknown } = { data: null, error: null };
  for (let i = 0; i < attempts; i++) {
    last = await run();
    if (!last.error) return last;
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
  }
  return last;
}
