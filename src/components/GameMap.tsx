import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { MultiPolygon, Polygon } from "geojson";

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
};

const landmarkIcon = (claimed: boolean) =>
  L.divIcon({
    html: `<div style="font-size:26px;line-height:1;filter:drop-shadow(0 2px 3px rgba(0,0,0,.5));opacity:${claimed ? 0.4 : 1}">⭐</div>`,
    className: "",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });

const blipIcon = (color: string) =>
  L.divIcon({
    html: `<div style="
      width:16px;height:16px;border-radius:50%;
      background:${color};
      border:2px solid #ffffff;
      box-shadow:0 0 4px 2px rgba(0,0,0,.6), 0 0 14px 4px ${color};
    "></div>`,
    className: "",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
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
}: Props) {
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
    // Bright, colorful "arcade" basemap: readable in full sunlight outdoors,
    // with saturated parks/roads/water so team territories still pop.
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      maxZoom: 20,
      subdomains: "abcd",
      attribution: "© OpenStreetMap contributors © CARTO",
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
          color: t.color,
          weight: 3,
          fillColor: t.color,
          fillOpacity: 0.4,
          className: "territory-glow",
        },
      }).addTo(layer);
    }
  }, [territories]);

  useEffect(() => {
    const layer = zoneLayer.current;
    if (!layer) return;
    layer.clearLayers();
    if (returnZone) {
      L.circle([returnZone.lat, returnZone.lng], {
        radius: returnZone.radiusM,
        color: "#0891b2",
        weight: 3,
        dashArray: "8 8",
        fillColor: "#0891b2",
        fillOpacity: 0.12,
        className: "zone-glow-cyan",
      })
        .bindTooltip("Zone de retour", { permanent: false })
        .addTo(layer);
    }
  }, [returnZone]);

  useEffect(() => {
    const layer = forbiddenLayer.current;
    if (!layer) return;
    layer.clearLayers();
    for (const z of forbiddenZones) {
      L.circle([z.lat, z.lng], {
        radius: z.radiusM,
        color: "#dc2626",
        weight: 2,
        dashArray: "4 6",
        fillColor: "#dc2626",
        fillOpacity: 0.18,
        className: "zone-glow-red",
      })
        .bindTooltip("⚠️ Zone interdite")
        .addTo(layer);
    }
  }, [forbiddenZones]);

  useEffect(() => {
    const layer = landmarkLayer.current;
    if (!layer) return;
    layer.clearLayers();
    for (const lm of landmarks) {
      L.marker([lm.lat, lm.lng], { icon: landmarkIcon(lm.claimed) })
        .bindTooltip(lm.claimed ? "Repère pris" : "Repère bonus")
        .addTo(layer);
    }
  }, [landmarks]);

  useEffect(() => {
    const layer = teamLayer.current;
    if (!layer) return;
    layer.clearLayers();
    for (const t of teams) {
      if (t.lat == null || t.lng == null) continue;
      L.marker([t.lat, t.lng], { icon: blipIcon(t.color) })
        .bindTooltip(t.name, { permanent: true, direction: "top", offset: [0, -12] })
        .addTo(layer);
    }
  }, [teams]);

  useEffect(() => {
    const line = trailLine.current;
    if (!line) return;
    line.setStyle({ color: trailColor });
    line.setLatLngs(trail);
  }, [trail, trailColor]);

  return <div ref={containerRef} className="h-full w-full" />;
}
