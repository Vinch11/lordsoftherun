export type MapStyleId = "classic";

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

const OSM_TILES = {
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: "© OpenStreetMap contributors",
  subdomains: "abc",
  maxZoom: 19,
};

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
};

export const MAP_STYLE_LIST = Object.values(MAP_STYLES);

export function resolveMapStyle(id: string | null | undefined): MapStyleSpec {
  return MAP_STYLES[(id ?? "classic") as MapStyleId] ?? MAP_STYLES.classic;
}
