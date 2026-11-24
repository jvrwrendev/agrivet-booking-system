import { request } from "@/lib/api-client";

export interface AgentLocationUpdate {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
  locationLabel?: string | null;
  recordedAt?: string;
  gpsAvailable?: boolean;
  isTracking?: boolean;
}

export async function updateMyAgentLocation(payload: AgentLocationUpdate) {
  return request<{ location: unknown }>("/agents/location", {
    method: "POST",
    body: payload,
  });
}

export async function updateMyTrackingState(payload: {
  isTracking: boolean;
  gpsAvailable?: boolean;
}) {
  return request<{ location: unknown }>("/agents/location/state", {
    method: "POST",
    body: payload,
  });
}
