import { Fragment, useEffect, useMemo, useRef } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { cn, relativeTime } from "@/lib/utils";
import { LOCATION_STATUS_LABEL, LOCATION_STATUS_META } from "./LocationStatusBadge";
import type { LocationStatus } from "../types";

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  name: string;
  initials: string;
  status: LocationStatus;
  lastUpdated: string | null;
  place: string;
  isLive?: boolean;
}

interface MapCanvasProps {
  markers: MapMarker[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  initialCenter: { latitude: number; longitude: number };
  initialZoom: number;
  selectedZoom?: number;
  fitSignal?: number;
  tileUrl?: string;
  tileAttribution?: string;
  tileMaxZoom?: number;
  tileMaxNativeZoom?: number;
  className?: string;
}

function MapController({
  markers,
  selectedId,
  selectedZoom,
  fitSignal,
  initialCenter,
  initialZoom,
}: {
  markers: MapMarker[];
  selectedId: string | null;
  selectedZoom: number;
  fitSignal: number;
  initialCenter: { latitude: number; longitude: number };
  initialZoom: number;
}) {
  const map = useMap();
  const prevSelectedId = useRef<string | null>(null);
  const prevCoords = useRef<string | null>(null);

  const selected = markers.find((m) => m.id === selectedId) ?? null;
  const selectedCoords = selected ? `${selected.latitude},${selected.longitude}` : null;
  const markerKey = markers.map((m) => m.id).join(",");

  useEffect(() => {
    if (selected) {
      const selectionChanged = prevSelectedId.current !== selectedId;
      const coordsChanged = prevCoords.current !== selectedCoords;

      if (selectionChanged) {
        map.flyTo([selected.latitude, selected.longitude], Math.max(map.getZoom(), selectedZoom), {
          duration: 0.8,
        });
      } else if (coordsChanged) {
        // Keep selected agent centered as live updates arrive, without jarring zoom changes.
        map.panTo([selected.latitude, selected.longitude], { animate: true, duration: 0.6 });
      }

      prevSelectedId.current = selectedId;
      prevCoords.current = selectedCoords;
      return;
    }

    prevSelectedId.current = null;
    prevCoords.current = null;

    if (markers.length === 0) {
      map.setView([initialCenter.latitude, initialCenter.longitude], initialZoom);
      return;
    }

    const bounds = L.latLngBounds(markers.map((m) => [m.latitude, m.longitude] as [number, number]));
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 });
    }
  }, [
    map,
    markerKey,
    selectedId,
    selectedCoords,
    selectedZoom,
    fitSignal,
    initialCenter,
    initialZoom,
    markers,
    selected,
  ]);

  return null;
}

const DEFAULT_TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const DEFAULT_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export default function MapCanvas({
  markers,
  selectedId,
  onSelect,
  initialCenter,
  initialZoom,
  selectedZoom = 14,
  fitSignal = 0,
  tileUrl = DEFAULT_TILE_URL,
  tileAttribution = DEFAULT_TILE_ATTRIBUTION,
  tileMaxZoom = 20,
  tileMaxNativeZoom = 19,
  className,
}: MapCanvasProps) {
  const selected = useMemo(
    () => markers.find((m) => m.id === selectedId) ?? null,
    [markers, selectedId],
  );

  return (
    <div
      className={cn("relative h-full w-full", className)}
      role="application"
      aria-label={`Agent location map with ${markers.length} agent${markers.length === 1 ? "" : "s"}`}
    >
      <MapContainer
        center={[initialCenter.latitude, initialCenter.longitude]}
        zoom={initialZoom}
        maxZoom={tileMaxZoom}
        style={{ width: "100%", height: "100%" }}
        scrollWheelZoom
        className="z-0"
      >
        <TileLayer
          key={tileUrl}
          attribution={tileAttribution}
          url={tileUrl}
          maxZoom={tileMaxZoom}
          maxNativeZoom={tileMaxNativeZoom}
        />
        <MapController
          markers={markers}
          selectedId={selectedId}
          selectedZoom={selectedZoom}
          fitSignal={fitSignal}
          initialCenter={initialCenter}
          initialZoom={initialZoom}
        />

        {markers.map((marker) => {
          const isSelected = marker.id === selectedId;
          const meta = LOCATION_STATUS_META[marker.status];
          const color = meta.marker;

          return (
            <Fragment key={marker.id}>
              {isSelected ? (
                <CircleMarker
                  center={[marker.latitude, marker.longitude]}
                  radius={18}
                  pathOptions={{
                    color,
                    weight: 1.5,
                    fillColor: color,
                    fillOpacity: 0.12,
                    interactive: false,
                  }}
                />
              ) : null}
              <CircleMarker
                center={[marker.latitude, marker.longitude]}
                radius={isSelected ? 11 : 8}
                pathOptions={{
                  color: "#FFFFFF",
                  weight: isSelected ? 3 : 2,
                  fillColor: color,
                  fillOpacity: marker.status === "offline" ? 0.72 : 0.95,
                }}
                eventHandlers={{
                  click: () => onSelect(marker.id),
                }}
              >
                <Popup>
                  <div className="space-y-1 text-sm">
                    <div className="font-semibold">{marker.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {LOCATION_STATUS_LABEL[marker.status]}
                      {marker.isLive ? " · Live" : " · Last known"}
                    </div>
                    <div className="text-xs">{marker.place}</div>
                    <div className="text-xs tabular-nums">
                      {marker.latitude.toFixed(5)}, {marker.longitude.toFixed(5)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {marker.lastUpdated ? `Updated ${relativeTime(marker.lastUpdated)}` : "No updates yet"}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            </Fragment>
          );
        })}
      </MapContainer>

      {selected ? (
        <div className="absolute bottom-3 left-3 z-[500] hidden rounded-md border bg-background/95 px-3 py-2 text-xs shadow-sm backdrop-blur-sm sm:block">
          <div className="font-medium text-foreground">{selected.name}</div>
          <div className="text-muted-foreground">
            {LOCATION_STATUS_LABEL[selected.status]} · {selected.isLive ? "Live" : "Last known"}
          </div>
        </div>
      ) : null}
    </div>
  );
}
