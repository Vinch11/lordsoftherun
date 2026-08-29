import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MultiPolygon, Polygon } from "geojson";
import { resolveMapStyle, type MapStyleId, type MapStyleSpec } from "@/lib/mapStyles";

export type MapTeam = {
  id: string;
  name: string;
  color: string;
  lat: number | null;
  lng: number | null;
};

export type MapTerritory = {
  id: string;
  color: string;
  geometry: Polygon | MultiPolygon;
};

export type ReturnZone = { lat: number; lng: number; radiusM: number };

export type MapLandmark = { id: string; lat: number; lng: number; claimed: boolean };

export type MapForbiddenZone = { id: string; lat: number; lng: number; radiusM: number };

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
  onMapClick?: ((lat: number, lng: number) => void | Promise<void>) | undefined;
  mapStyle?: MapStyleId | string | null | undefined;
};

const landmarkIcon = (claimed: boolean, spec: MapStyleSpec) =>
  L.divIcon({
    html: `<div style="font-size:26px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,.5));opacity:${claimed ? 0.4 : 1}">${spec.landmarkEmoji}</div>`,
    className: "",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
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
  onMapClick,
  mapStyle = "classic",
}: Props) {
  const spec = resolveMapStyle(mapStyle);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const territoryLayer = useRef<L.LayerGroup | null>(null);
  const teamLayer = useRef<L.LayerGroup | null>(null);
  const zoneLayer = useRef<L.LayerGroup | null>(null);
  const landmarkLayer = useRef<L.LayerGroup | null>(null);
  const forbiddenLayer = useRef<L.LayerGroup | null>(null);
  const trailLine = useRef<L.Polyline | null>(null);
  const didInitialFit = useRef(false);
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = L.map(containerRef.current, {
      center: center ?? DEFAULT_CENTER,
      zoom: 17,
      zoomControl: false,
      attributionControl: true,
    });
    // Bright, colorful basemap, readable in full sunlight outdoors. CARTO's
    // free anonymous tiles now require an API key, so use standard OSM tiles
    // instead (no key needed, still colorful with green parks/blue water).
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      subdomains: "abc",
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);
    L.control.zoom({ position: "bottomleft" }).addTo(map);
    territoryLayer.current = L.layerGroup().addTo(map);
    zoneLayer.current = L.layerGroup().addTo(map);
    forbiddenLayer.current = L.layerGroup().addTo(map);
    landmarkLayer.current = L.layerGroup().addTo(map);
    teamLayer.current = L.layerGroup().addTo(map);
    trailLine.current = L.polyline([], { color: trailColor, weight: 6, opacity: 0.95 }).addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) =>
      onMapClickRef.current?.(e.latlng.lat, e.latlng.lng),
    );
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
      L.marker([lm.lat, lm.lng], { icon: landmarkIcon(lm.claimed, spec) })
        .bindTooltip(lm.claimed ? "Repère pris" : "Repère bonus")
        .addTo(layer);
    }
  }, [landmarks, spec]);

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

  return <div ref={containerRef} className="h-full w-full" />;
}
