import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MultiPolygon, Polygon } from "geojson";
import { LocateFixed } from "lucide-react";
import { resolveMapStyle, type MapStyleId, type MapStyleSpec } from "@/lib/mapStyles";

export type MapTeam = {
  id: string;
  name: string;
  color: string;
  lat: number | null;
  lng: number | null;
  current_trail?: [number, number][];
};

export type MapTerritory = {
  id: string;
  color: string;
  geometry: Polygon | MultiPolygon;
};

export type ReturnZone = { lat: number; lng: number; radiusM: number };

export type MapLandmark = {
  id: string;
  lat: number;
  lng: number;
  icon: string;
  kind: "points" | "shield";
};

export type MapForbiddenZone = { id: string; lat: number; lng: number; radiusM: number };

export type MapFlag = { id: string; lat: number; lng: number; color: string; label: string };

export type GridZone = {
  lat: number;
  lng: number;
  shape: "circle" | "rectangle";
  radiusM: number;
  widthM: number;
  heightM: number;
};

export type MapGridCell = { id: string; lat: number; lng: number; sizeM: number; color: string };

type Props = {
  center: [number, number] | null;
  teams: MapTeam[];
  territories: MapTerritory[];
  trail?: [number, number][];
  trailColor?: string;
  follow?: boolean;
  returnZone?: ReturnZone | null;
  landmarks?: MapLandmark[];
  forbiddenZones?: MapForbiddenZone[];
  flags?: MapFlag[];
  gridZone?: GridZone | null;
  gridCells?: MapGridCell[];
  onMapClick?: ((lat: number, lng: number) => void | Promise<void>) | undefined;
  mapStyle?: MapStyleId | string | null | undefined;
  hudFrame?: boolean;
  /** Fires the moment the player drags the map by hand (not on programmatic pans). */
  onUserPan?: () => void;
  /** When provided, a "recenter on me" button appears while `follow` is false. */
  onRecenter?: () => void;
};

const METERS_PER_DEG_LAT = 111320;

function rectBoundsMeters(
  lat: number,
  lng: number,
  widthM: number,
  heightM: number,
): L.LatLngBoundsExpression {
  const dLat = heightM / 2 / METERS_PER_DEG_LAT;
  const dLng = widthM / 2 / (METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
  return [
    [lat - dLat, lng - dLng],
    [lat + dLat, lng + dLng],
  ];
}

function cellRectBounds(lat: number, lng: number, sizeM: number): L.LatLngBoundsExpression {
  return rectBoundsMeters(lat, lng, sizeM, sizeM);
}

const LANDMARK_KIND_COLOR: Record<MapLandmark["kind"], string> = {
  points: "#e9c500",
  shield: "#33d0e8",
};

const landmarkIcon = (icon: string, kind: MapLandmark["kind"]) => {
  const color = LANDMARK_KIND_COLOR[kind];
  return L.divIcon({
    html: `<div style="position:relative; width:34px; height:34px;">
      <div class="hex-ring" style="border-color:${color}"></div>
      <div class="hex-core" style="
        background:linear-gradient(160deg, #121522, #05060b);
        border:1px solid ${color}aa;
        --hex-glow: ${color}99;
        font-size:16px;
      ">${icon}</div>
    </div>`,
    className: "",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
};

const flagIcon = (color: string) =>
  L.divIcon({
    html: `<div style="
      display:flex; align-items:center; justify-content:center;
      width:34px;height:34px;border-radius:50%;
      background:${color};
      border:3px solid #ffffff;
      box-shadow:0 0 4px 2px rgba(0,0,0,.6), 0 0 14px 4px ${color};
      font-size:18px;line-height:1;
    ">🚩</div>`,
    className: "",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });

const blipIcon = (color: string, spec: MapStyleSpec) =>
  L.divIcon({
    html: spec.blip(color),
    className: "",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });

const DEFAULT_CENTER: [number, number] = [48.8566, 2.3522];

export default function GameMap({
  center,
  teams,
  territories,
  trail = [],
  trailColor = "#e63946",
  follow = false,
  returnZone = null,
  landmarks = [],
  forbiddenZones = [],
  flags = [],
  gridZone = null,
  gridCells = [],
  onMapClick,
  mapStyle = "classic",
  hudFrame = false,
  onUserPan,
  onRecenter,
}: Props) {
  const spec = resolveMapStyle(mapStyle);
  const specRef = useRef(spec);
  specRef.current = spec;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const territoryLayer = useRef<L.LayerGroup | null>(null);
  const teamTrailLayer = useRef<L.LayerGroup | null>(null);
  const teamLayer = useRef<L.LayerGroup | null>(null);
  const zoneLayer = useRef<L.LayerGroup | null>(null);
  const landmarkLayer = useRef<L.LayerGroup | null>(null);
  const forbiddenLayer = useRef<L.LayerGroup | null>(null);
  const flagLayer = useRef<L.LayerGroup | null>(null);
  const gridZoneLayer = useRef<L.LayerGroup | null>(null);
  const gridCellLayer = useRef<L.LayerGroup | null>(null);
  const trailLine = useRef<L.Polyline | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const didInitialFit = useRef(false);
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const onUserPanRef = useRef(onUserPan);
  onUserPanRef.current = onUserPan;

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = L.map(containerRef.current, {
      center: center ?? DEFAULT_CENTER,
      zoom: 17,
      zoomControl: false,
      attributionControl: true,
    });
    // Basemap tiles depend on the selected style (all free, no API key).
    tileLayerRef.current = L.tileLayer(specRef.current.tiles.url, {
      maxZoom: specRef.current.tiles.maxZoom,
      subdomains: specRef.current.tiles.subdomains,
      attribution: specRef.current.tiles.attribution,
    }).addTo(map);
    L.control.zoom({ position: "bottomleft" }).addTo(map);
    territoryLayer.current = L.layerGroup().addTo(map);
    zoneLayer.current = L.layerGroup().addTo(map);
    forbiddenLayer.current = L.layerGroup().addTo(map);
    landmarkLayer.current = L.layerGroup().addTo(map);
    flagLayer.current = L.layerGroup().addTo(map);
    gridCellLayer.current = L.layerGroup().addTo(map);
    gridZoneLayer.current = L.layerGroup().addTo(map);
    teamTrailLayer.current = L.layerGroup().addTo(map);
    teamLayer.current = L.layerGroup().addTo(map);
    trailLine.current = L.polyline([], { color: trailColor, weight: 6, opacity: 0.95 }).addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) =>
      onMapClickRef.current?.(e.latlng.lat, e.latlng.lng),
    );
    // "dragstart" only fires for a manual drag, never for panTo/setView, so
    // this can't misfire from our own auto-follow recentering below.
    map.on("dragstart", () => onUserPanRef.current?.());
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 200);
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.classList.add(spec.containerClass);
    mapRef.current?.invalidateSize();
    return () => el.classList.remove(spec.containerClass);
  }, [spec.containerClass]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    tileLayerRef.current?.remove();
    tileLayerRef.current = L.tileLayer(spec.tiles.url, {
      maxZoom: spec.tiles.maxZoom,
      subdomains: spec.tiles.subdomains,
      attribution: spec.tiles.attribution,
    }).addTo(map);
    tileLayerRef.current.getContainer()?.classList.add("leaflet-base-tiles");
    if (tileLayerRef.current.getPane()) {
      map.getPane("tilePane")!.style.zIndex = "200";
    }
  }, [spec.tiles.url, spec.tiles.maxZoom, spec.tiles.subdomains, spec.tiles.attribution]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !center) return;
    if (!didInitialFit.current) {
      map.setView(center, 17);
      didInitialFit.current = true;
    } else if (follow) {
      map.panTo(center, { animate: true });
    }
  }, [center, follow]);

  useEffect(() => {
    const layer = territoryLayer.current;
    if (!layer) return;
    layer.clearLayers();
    for (const t of territories) {
      L.geoJSON(t.geometry, {
        style: {
          color: spec.territory.className === "territory-arcade" ? "#ffffff" : t.color,
          weight: spec.territory.weight,
          fillColor: t.color,
          fillOpacity: spec.territory.fillOpacity,
          className: spec.territory.className,
        },
      }).addTo(layer);
    }
  }, [territories, spec]);

  useEffect(() => {
    const layer = zoneLayer.current;
    if (!layer) return;
    layer.clearLayers();
    if (returnZone) {
      L.circle([returnZone.lat, returnZone.lng], {
        radius: returnZone.radiusM,
        color: "#0891b2",
        weight: spec.zone.weight,
        dashArray: spec.zone.dashArray,
        fillColor: "#0891b2",
        fillOpacity: spec.zone.fillOpacity,
        className: "zone-glow-cyan",
      })
        .bindTooltip("Zone de retour", { permanent: false })
        .addTo(layer);
    }
  }, [returnZone, spec]);

  useEffect(() => {
    const layer = forbiddenLayer.current;
    if (!layer) return;
    layer.clearLayers();
    for (const z of forbiddenZones) {
      L.circle([z.lat, z.lng], {
        radius: z.radiusM,
        color: "#dc2626",
        weight: spec.zone.weight,
        dashArray: "4 6",
        fillColor: "#dc2626",
        fillOpacity: 0.18,
        className: "zone-glow-red",
      })
        .bindTooltip("⚠️ Zone interdite")
        .addTo(layer);
    }
  }, [forbiddenZones, spec]);

  useEffect(() => {
    const layer = landmarkLayer.current;
    if (!layer) return;
    layer.clearLayers();
    for (const lm of landmarks) {
      L.marker([lm.lat, lm.lng], { icon: landmarkIcon(lm.icon, lm.kind) })
        .bindTooltip(lm.kind === "shield" ? "Bouclier" : "Repère bonus")
        .addTo(layer);
    }
  }, [landmarks]);

  useEffect(() => {
    const layer = flagLayer.current;
    if (!layer) return;
    layer.clearLayers();
    for (const f of flags) {
      L.marker([f.lat, f.lng], { icon: flagIcon(f.color) })
        .bindTooltip(f.label)
        .addTo(layer);
    }
  }, [flags]);

  useEffect(() => {
    const layer = gridCellLayer.current;
    if (!layer) return;
    layer.clearLayers();
    for (const c of gridCells) {
      L.rectangle(cellRectBounds(c.lat, c.lng, c.sizeM), {
        color: c.color,
        weight: 1,
        fillColor: c.color,
        fillOpacity: 0.55,
      }).addTo(layer);
    }
  }, [gridCells]);

  useEffect(() => {
    const layer = gridZoneLayer.current;
    if (!layer) return;
    layer.clearLayers();
    if (gridZone?.shape === "rectangle") {
      L.rectangle(rectBoundsMeters(gridZone.lat, gridZone.lng, gridZone.widthM, gridZone.heightM), {
        color: "#8338ec",
        weight: spec.zone.weight,
        dashArray: spec.zone.dashArray,
        fillOpacity: 0,
        className: "zone-glow-violet",
      })
        .bindTooltip("Zone de jeu")
        .addTo(layer);
    } else if (gridZone) {
      L.circle([gridZone.lat, gridZone.lng], {
        radius: gridZone.radiusM,
        color: "#8338ec",
        weight: spec.zone.weight,
        dashArray: spec.zone.dashArray,
        fillOpacity: 0,
        className: "zone-glow-violet",
      })
        .bindTooltip("Zone de jeu")
        .addTo(layer);
    }
  }, [gridZone, spec]);

  useEffect(() => {
    const layer = teamTrailLayer.current;
    if (!layer) return;
    layer.clearLayers();
    for (const t of teams) {
      if (!t.current_trail || t.current_trail.length < 2) continue;
      L.polyline(t.current_trail, {
        color: t.color,
        weight: 4,
        opacity: 0.5,
        dashArray: "2 8",
      }).addTo(layer);
    }
  }, [teams]);

  useEffect(() => {
    const layer = teamLayer.current;
    if (!layer) return;
    layer.clearLayers();
    for (const t of teams) {
      if (t.lat == null || t.lng == null) continue;
      L.marker([t.lat, t.lng], { icon: blipIcon(t.color, spec) })
        .bindTooltip(t.name, { permanent: true, direction: "top", offset: [0, -12] })
        .addTo(layer);
    }
  }, [teams, spec]);

  useEffect(() => {
    const line = trailLine.current;
    if (!line) return;
    line.setStyle({
      color: trailColor,
      weight: spec.trail.weight,
      opacity: spec.trail.opacity,
      className: spec.trail.className,
    });
    line.setLatLngs(trail);
  }, [trail, trailColor, spec]);

  const recenterButton = onRecenter && !follow && (
    <button
      type="button"
      aria-label="Recentrer sur ma position"
      className="nav-back absolute right-4 top-1/2 z-[600] -translate-y-1/2"
      onClick={onRecenter}
    >
      <LocateFixed className="h-5 w-5" />
    </button>
  );

  if (!hudFrame) {
    return (
      <div className="relative h-full w-full">
        <div ref={containerRef} className="h-full w-full" />
        {recenterButton}
      </div>
    );
  }
  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <div className="hud-bracket hud-bracket-tl" />
      <div className="hud-bracket hud-bracket-tr" />
      <div className="hud-bracket hud-bracket-bl" />
      <div className="hud-bracket hud-bracket-br" />
      <div className="hud-bracket-tick" />
      {recenterButton}
    </div>
  );
}
