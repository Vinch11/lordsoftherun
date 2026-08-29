export type MapStyleId = "classic" | "cartoon" | "neon" | "tactical" | "arcade";

export type MapStyleSpec = {
  id: MapStyleId;
  label: string;
  description: string;
  /** Class applied on the map container (drives tile filters + overlays in CSS). */
  containerClass: string;
  /** Basemap tiles used for this style. */
  tiles: { url: string; attribution: string; subdomains: string; maxZoom: number };
  territory: {
    weight: number;
    fillOpacity: number;
    dashArray?: string;
    className: string;
  };
  trail: { weight: number; opacity: number; className: string };
  /** Team blip marker HTML builder. */
  blip: (color: string) => string;
  landmarkEmoji: string;
  zone: { weight: number; dashArray: string; fillOpacity: number };
};

const blipClassic = (color: string) => `<div style="
  width:16px;height:16px;border-radius:50%;
  background:${color};border:2px solid #ffffff;
  box-shadow:0 0 4px 2px rgba(0,0,0,.6), 0 0 14px 4px ${color};
"></div>`;

const blipNeon = (color: string) => `<div class="blip-neon" style="--blip:${color}">
  <span class="blip-neon-core"></span><span class="blip-neon-ring"></span>
</div>`;

const blipTactical = (color: string) => `<div class="blip-tactical" style="--blip:${color}">
  <span class="blip-tactical-cross"></span>
</div>`;

const blipArcade = (color: string) => `<div style="
  width:22px;height:22px;border-radius:50%;
  background:${color};border:4px solid #ffffff;
  box-shadow:0 3px 0 rgba(0,0,0,.35);
"></div>`;

const OSM_TILES = {
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: "© OpenStreetMap contributors",
  subdomains: "abc",
  maxZoom: 19,
};

// Tuiles Humanitarian OSM (OSM France) : gratuites, sans clé API, rendu
// coloré et lisible proche d'un plan de ville type Waze.
const CARTOON_TILES = {
  url: "https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png",
  attribution: "© OpenStreetMap contributors, Humanitarian OSM Team",
  subdomains: "ab",
  maxZoom: 19,
};

const blipCartoon = (color: string) => `<div style="
  width:20px;height:20px;border-radius:50%;
  background:${color};border:3px solid #ffffff;
  box-shadow:0 2px 6px rgba(0,0,0,.35);
"></div>`;

export const MAP_STYLES: Record<MapStyleId, MapStyleSpec> = {
  classic: {
    id: "classic",
    label: "Classique",
    description: "Carte OSM standard, lisible partout.",
    containerClass: "map-style-classic",
    tiles: OSM_TILES,
    territory: { weight: 3, fillOpacity: 0.4, className: "territory-glow" },
    trail: { weight: 6, opacity: 0.95, className: "" },
    blip: blipClassic,
    landmarkEmoji: "⭐",
    zone: { weight: 3, dashArray: "8 8", fillOpacity: 0.12 },
  },
  cartoon: {
    id: "cartoon",
    label: "Cartoon (Waze-like)",
    description: "Tuiles pastel colorées, très lisibles, style plan de ville.",
    containerClass: "map-style-cartoon",
    tiles: CARTOON_TILES,
    territory: { weight: 5, fillOpacity: 0.5, className: "territory-cartoon" },
    trail: { weight: 8, opacity: 1, className: "trail-cartoon" },
    blip: blipCartoon,
    landmarkEmoji: "📍",
    zone: { weight: 4, dashArray: "10 8", fillOpacity: 0.14 },
  },
  neon: {
    id: "neon",
    label: "Néon cyberpunk",
    description: "Carte sombre, territoires lumineux. Idéal en soirée.",
    containerClass: "map-style-neon",
    tiles: OSM_TILES,
    territory: { weight: 4, fillOpacity: 0.28, className: "territory-neon" },
    trail: { weight: 7, opacity: 1, className: "trail-neon" },
    blip: blipNeon,
    landmarkEmoji: "✦",
    zone: { weight: 3, dashArray: "10 6", fillOpacity: 0.1 },
  },
  tactical: {
    id: "tactical",
    label: "Tactique militaire",
    description: "Gris-vert, contours techniques, ambiance mission.",
    containerClass: "map-style-tactical",
    tiles: OSM_TILES,
    territory: { weight: 2, fillOpacity: 0.22, dashArray: "1 0", className: "territory-tactical" },
    trail: { weight: 4, opacity: 0.9, className: "trail-tactical" },
    blip: blipTactical,
    landmarkEmoji: "◎",
    zone: { weight: 2, dashArray: "6 6", fillOpacity: 0.1 },
  },
  arcade: {
    id: "arcade",
    label: "Arcade Paper.io",
    description: "Couleurs vives, contours blancs épais. Top en plein soleil.",
    containerClass: "map-style-arcade",
    tiles: OSM_TILES,
    territory: { weight: 6, fillOpacity: 0.65, className: "territory-arcade" },
    trail: { weight: 9, opacity: 1, className: "trail-arcade" },
    blip: blipArcade,
    landmarkEmoji: "⭐",
    zone: { weight: 5, dashArray: "12 8", fillOpacity: 0.15 },
  },
};

export const MAP_STYLE_LIST = Object.values(MAP_STYLES);

export function resolveMapStyle(id: string | null | undefined): MapStyleSpec {
  return MAP_STYLES[(id ?? "classic") as MapStyleId] ?? MAP_STYLES.classic;
}
