import { initials } from "@/lib/utils";
import type { MapMarker } from "./MapCanvas";
import type { AgentLocation } from "../types";

export function toMapMarkers(locations: AgentLocation[]): MapMarker[] {
  const markers: MapMarker[] = [];
  for (const location of locations) {
    if (location.latitude === null || location.longitude === null) continue;
    markers.push({
      id: location.agentId,
      latitude: location.latitude,
      longitude: location.longitude,
      name: location.agentName,
      initials: initials(location.agentName),
      status: location.status,
      lastUpdated: location.lastUpdated,
      place:
        location.locationLabel ||
        `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`,
      isLive: location.isLive,
    });
  }
  return markers;
}

export function toMapMarker(location: AgentLocation): MapMarker | null {
  if (location.latitude === null || location.longitude === null) return null;
  return {
    id: location.agentId,
    latitude: location.latitude,
    longitude: location.longitude,
    name: location.agentName,
    initials: initials(location.agentName),
    status: location.status,
    lastUpdated: location.lastUpdated,
    place:
      location.locationLabel ||
      `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`,
    isLive: location.isLive,
  };
}
