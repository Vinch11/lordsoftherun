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

// Google-Maps-like locator: a soft halo that pulses, a white ring and a
// solid colored dot — instantly readable as "someone is here", even in sun.
const blipClassic = (color: string) => `<div class="gps-blip">
  <span class="gps-blip-halo" style="background:${color}"></span>
  <span class="gps-blip-dot" style="background:${color}"></span>
</div>`;

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
