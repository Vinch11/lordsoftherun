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

export type MapCheckpoint = { id: string; lat: number; lng: number; seq: number };
export type MapCircuitBox = { id: string; lat: number; lng: number };
export type MapBanana = { id: string; lat: number; lng: number };
export type MapGridBonus = {
  id: string;
  lat: number;
  lng: number;
  radiusM: number;
  remainingS: number;
};

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
  checkpoints?: MapCheckpoint[];
  circuitBoxes?: MapCircuitBox[];
  bananas?: MapBanana[];
  gridBonuses?: MapGridBonus[];
  onMapClick?: ((lat: number, lng: number) => void | Promise<void>) | undefined;
  mapStyle?: MapStyleId | string | null | undefined;
  hudFrame?: boolean;
  /** Fires the moment the player drags the map by hand (not on programmatic pans). */
  onUserPan?: () => void;
  /** When provided, a "recenter on me" button appears while `follow` is false. */
  onRecenter?: () => void;
  /** While true, dragging the map instead draws a freehand stroke (organizer sketching a Circuit track). */
  drawingEnabled?: boolean;
  /** Fires once, with the full drawn path, when the organizer lifts their finger/mouse. */
  onFreehandDraw?: (path: [number, number][]) => void;
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
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });

const checkpointIcon = (seq: number) =>
  L.divIcon({
    html: `<div style="
      display:flex; align-items:center; justify-content:center;
      width:28px;height:28px;border-radius:50%;
      background:${seq === 0 ? "#e9c500" : "#1d6fe0"};
      border:3px solid #ffffff;
      box-shadow:0 0 4px 2px rgba(0,0,0,.6);
      font-size:13px; font-weight:800; color:#0a0a12; line-height:1;
    ">${seq === 0 ? "🏁" : seq}</div>`,
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

const boxIcon = () =>
  L.divIcon({
    html: `<div style="
      display:flex; align-items:center; justify-content:center;
      width:32px;height:32px;border-radius:8px;
      background:linear-gradient(160deg, #7c3aed, #4c1d95);
      border:2px solid #ffffff;
      box-shadow:0 0 6px 2px rgba(124,58,237,.7);
      font-size:17px; line-height:1;
    ">❓</div>`,
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

const bananaIcon = () =>
  L.divIcon({
    html: `<div style="
      display:flex; align-items:center; justify-content:center;
      width:26px;height:26px;border-radius:50%;
      background:#1a1c05;
      border:2px solid #e9c500;
      box-shadow:0 0 5px 2px rgba(233,197,0,.6);
      font-size:15px; line-height:1;
    ">🍌</div>`,
    className: "",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

const gridBonusIcon = (remainingS: number) =>
  L.divIcon({
    html: `<div style="
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      width:36px;height:36px;border-radius:50%;
      background:radial-gradient(circle at 35% 30%, #ff9d3d, #d6360f 70%);
      border:2px solid #ffffff;
      box-shadow:0 0 6px 2px rgba(214,54,15,.7);
      font-size:16px; line-height:1; color:#1a0500;
    "><span>💥</span><span style="font-size:9px;font-weight:800;">${Math.max(0, Math.ceil(remainingS))}s</span></div>`,
    className: "",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
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
  checkpoints = [],
  circuitBoxes = [],
  bananas = [],
  gridBonuses = [],
  onMapClick,
  mapStyle = "classic",
  hudFrame = false,
  onUserPan,
  onRecenter,
  drawingEnabled = false,
  onFreehandDraw,
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
  const checkpointLayer = useRef<L.LayerGroup | null>(null);
  const boxLayer = useRef<L.LayerGroup | null>(null);
  const bananaLayer = useRef<L.LayerGroup | null>(null);
  const gridBonusLayer = useRef<L.LayerGroup | null>(null);
  const drawLine = useRef<L.Polyline | null>(null);
  const trailLine = useRef<L.Polyline | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const didInitialFit = useRef(false);
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const onUserPanRef = useRef(onUserPan);
  onUserPanRef.current = onUserPan;
  const onFreehandDrawRef = useRef(onFreehandDraw);
  onFreehandDrawRef.current = onFreehandDraw;
  const drawingEnabledRef = useRef(drawingEnabled);
  drawingEnabledRef.current = drawingEnabled;
  const drawPathRef = useRef<[number, number][]>([]);
  const isDrawingRef = useRef(false);

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
    checkpointLayer.current = L.layerGroup().addTo(map);
    boxLayer.current = L.layerGroup().addTo(map);
    bananaLayer.current = L.layerGroup().addTo(map);
    gridBonusLayer.current = L.layerGroup().addTo(map);
    teamTrailLayer.current = L.layerGroup().addTo(map);
    teamLayer.current = L.layerGroup().addTo(map);
    trailLine.current = L.polyline([], { color: trailColor, weight: 6, opacity: 0.95 }).addTo(map);
    drawLine.current = L.polyline([], { color: "#f77f00", weight: 5, dashArray: "6 6" }).addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) =>
      onMapClickRef.current?.(e.latlng.lat, e.latlng.lng),
    );
    // "dragstart" only fires for a manual drag, never for panTo/setView, so
    // this can't misfire from our own auto-follow recentering below.
    map.on("dragstart", () => onUserPanRef.current?.());

    // Freehand circuit drawing: while enabled, a press-drag-release paints a
    // stroke instead of panning the map (dragging is disabled for the
    // duration so Leaflet doesn't fight the gesture).
    const container = map.getContainer();
    // Reuse Leaflet's own pixel->latlng conversion (same one behind the
    // "click" handler above) rather than hand-rolling it — it already
    // accounts for the container's border/client offsets, so a drawn stroke
    // lines up exactly with anything placed via a single click.
    const toLatLng = (e: PointerEvent): [number, number] => {
      const ll = map.mouseEventToLatLng(e as unknown as MouseEvent);
      return [ll.lat, ll.lng];
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!drawingEnabledRef.current) return;
      e.preventDefault();
      isDrawingRef.current = true;
      map.dragging.disable();
      drawPathRef.current = [toLatLng(e)];
      drawLine.current?.setLatLngs(drawPathRef.current);
      container.setPointerCapture(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDrawingRef.current) return;
      drawPathRef.current = [...drawPathRef.current, toLatLng(e)];
      drawLine.current?.setLatLngs(drawPathRef.current);
    };
    const onPointerUp = () => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      map.dragging.enable();
      const path = drawPathRef.current;
      drawPathRef.current = [];
      drawLine.current?.setLatLngs([]);
      if (path.length >= 2) onFreehandDrawRef.current?.(path);
    };
    container.addEventListener("pointerdown", onPointerDown);
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerup", onPointerUp);
    container.addEventListener("pointercancel", onPointerUp);

    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 200);

    // Leaflet caches the container's pixel size and never re-measures it on
    // its own — without this, toggling the desktop side panel, resizing the
    // window, or rotating a device leaves every pixel<->latlng conversion
    // (clicks, the freehand-drawn circuit, marker placement) silently
    // offset from what's actually on screen until a full page reload.
    const resizeObserver = new ResizeObserver(() => map.invalidateSize());
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      container.removeEventListener("pointerdown", onPointerDown);
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", onPointerUp);
      container.removeEventListener("pointercancel", onPointerUp);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dragging must stay disabled for the whole gesture even if the prop flips
  // mid-stroke (e.g. the organizer finishes drawing) — re-enable it once we
  // are not actively drawing. While drawing is armed we also kill the
  // browser's own touch gestures (scroll/zoom), otherwise a finger drag fires
  // pointercancel after one point and the stroke ends up "too short".
  useEffect(() => {
    if (!drawingEnabled && !isDrawingRef.current) mapRef.current?.dragging.enable();
    const container = mapRef.current?.getContainer();
    if (container) container.style.touchAction = drawingEnabled ? "none" : "";
  }, [drawingEnabled]);

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
    const layer = checkpointLayer.current;
    if (!layer) return;
    layer.clearLayers();
    const ordered = [...checkpoints].sort((a, b) => a.seq - b.seq);
    if (ordered.length >= 2) {
      L.polyline(
        [
          ...ordered.map((c): [number, number] => [c.lat, c.lng]),
          [ordered[0]!.lat, ordered[0]!.lng],
        ],
        { color: "#1d6fe0", weight: 4, opacity: 0.7, dashArray: "3 9" },
      ).addTo(layer);
    }
    for (const c of ordered) {
      L.marker([c.lat, c.lng], { icon: checkpointIcon(c.seq) })
        .bindTooltip(c.seq === 0 ? "Ligne de départ/arrivée" : `Checkpoint ${c.seq}`)
        .addTo(layer);
    }
  }, [checkpoints]);

  useEffect(() => {
    const layer = boxLayer.current;
    if (!layer) return;
    layer.clearLayers();
    for (const b of circuitBoxes) {
      L.marker([b.lat, b.lng], { icon: boxIcon() }).bindTooltip("Boîte mystère").addTo(layer);
    }
  }, [circuitBoxes]);

  useEffect(() => {
    const layer = bananaLayer.current;
    if (!layer) return;
    layer.clearLayers();
    for (const b of bananas) {
      L.circle([b.lat, b.lng], {
        radius: 10,
        color: "#e9c500",
        weight: 2,
        dashArray: "4 6",
        fillColor: "#e9c500",
        fillOpacity: 0.15,
      }).addTo(layer);
      L.marker([b.lat, b.lng], { icon: bananaIcon() }).bindTooltip("Banane").addTo(layer);
    }
  }, [bananas]);

  useEffect(() => {
    const layer = gridBonusLayer.current;
    if (!layer) return;
    layer.clearLayers();
    for (const b of gridBonuses) {
      L.circle([b.lat, b.lng], {
        radius: b.radiusM,
        color: "#d6360f",
        weight: 2,
        dashArray: "4 6",
        fillColor: "#ff9d3d",
        fillOpacity: 0.12,
      }).addTo(layer);
      L.marker([b.lat, b.lng], { icon: gridBonusIcon(b.remainingS) })
        .bindTooltip(`💥 Bonus — ${Math.max(0, Math.ceil(b.remainingS))}s`)
        .addTo(layer);
    }
  }, [gridBonuses]);

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
