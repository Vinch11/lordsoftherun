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
];

export const MIN_LOOP_DISTANCE_M = 100;
export const CLOSE_RADIUS_M = 20;

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

export type GameMode = "territoire" | "capture_drapeau" | "grille";

export const GAME_MODE_LABELS: Record<GameMode, string> = {
  territoire: "Territoire",
  capture_drapeau: "Capture du drapeau",
  grille: "Grille",
};

export const GAME_MODE_DESCRIPTIONS: Record<GameMode, string> = {
  territoire: "Les équipes ferment des boucles GPS pour capturer du territoire.",
  capture_drapeau:
    "Chaque équipe défend un drapeau et doit capturer ceux des autres pour les ramener à la zone de dépôt.",
  grille:
    "La zone de jeu est divisée en cases : chaque case prend la couleur de la dernière équipe qui l'a traversée.",
};

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
export const DEFAULT_GRID_CELL_SIZE_M = 6;
export const MIN_GRID_CELL_SIZE_M = 3;
export const MAX_GRID_CELL_SIZE_M = 15;
/** Below this cell size, GPS jitter alone can flip a cell's color; shown as a warning. */
export const GRID_CELL_SIZE_WARNING_THRESHOLD_M = 5;

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
