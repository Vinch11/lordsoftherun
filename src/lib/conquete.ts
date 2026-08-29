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
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
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

export const teamStorageKey = (code: string) => `conquete:team:${code}`;
