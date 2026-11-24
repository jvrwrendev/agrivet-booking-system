/**
 * Agent location tracking domain types.
 */

export type LocationStatus =
  | "online"
  | "inactive"
  | "offline"
  | "gps_unavailable";

export interface AgentLocation {
  agentId: string;
  agentName: string;
  avatar?: string | null;
  latitude: number | null;
  longitude: number | null;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
  locationLabel?: string | null;
  status: LocationStatus;
  isLive: boolean;
  isTracking?: boolean;
  gpsAvailable?: boolean;
  lastSeenAt?: string | null;
  /** ISO timestamp of the last known position report. */
  lastUpdated: string | null;
  recordedAt?: string | null;
}

export interface AgentLocationHistoryPoint {
  id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  locationLabel: string | null;
  status: LocationStatus;
  recordedAt: string;
}

export type LocationStatusFilter = LocationStatus | "all";

export interface LocationService {
  listLocations(): Promise<AgentLocation[]>;
  getLocation?(agentId: string): Promise<AgentLocation | null>;
  getHistory?(
    agentId: string,
    params?: { limit?: number },
  ): Promise<AgentLocationHistoryPoint[]>;
  subscribe(onUpdate: (locations: AgentLocation[]) => void): () => void;
}
