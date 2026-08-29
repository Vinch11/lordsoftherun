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

type Props = {
  center: [number, number] | null;
  teams: MapTeam[];
  territories: MapTerritory[];
  trail?: [number, number][];
  trailColor?: string;
  follow?: boolean;
};

const DEFAULT_CENTER: [number, number] = [48.8566, 2.3522];

export default function GameMap({
  center,
  teams,
  territories,
  trail = [],
  trailColor = "#e63946",
  follow = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const territoryLayer = useRef<L.LayerGroup | null>(null);
  const teamLayer = useRef<L.LayerGroup | null>(null);
  const trailLine = useRef<L.Polyline | null>(null);
  const didInitialFit = useRef(false);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = L.map(containerRef.current, {
      center: center ?? DEFAULT_CENTER,
      zoom: 17,
      zoomControl: false,
      attributionControl: true,
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap",
    }).addTo(map);
    L.control.zoom({ position: "bottomleft" }).addTo(map);
    territoryLayer.current = L.layerGroup().addTo(map);
    teamLayer.current = L.layerGroup().addTo(map);
    trailLine.current = L.polyline([], { color: trailColor, weight: 6, opacity: 0.95 }).addTo(
      map,
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
          fillOpacity: 0.35,
        },
      }).addTo(layer);
    }
  }, [territories]);

  useEffect(() => {
    const layer = teamLayer.current;
    if (!layer) return;
    layer.clearLayers();
    for (const t of teams) {
      if (t.lat == null || t.lng == null) continue;
      L.circleMarker([t.lat, t.lng], {
        radius: 10,
        color: "#ffffff",
        weight: 3,
        fillColor: t.color,
        fillOpacity: 1,
      })
        .bindTooltip(t.name, { permanent: true, direction: "top", offset: [0, -10] })
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
