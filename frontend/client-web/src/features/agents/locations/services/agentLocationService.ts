import { io, type Socket } from "socket.io-client";
import { request } from "@/lib/api-client";
import type { AgentLocation, AgentLocationHistoryPoint, LocationService } from "../types";

interface LocationsResponse {
  locations: AgentLocation[];
}

interface LocationResponse {
  location: AgentLocation;
}

interface HistoryResponse {
  history: AgentLocationHistoryPoint[];
}

function normalize(location: AgentLocation): AgentLocation {
  return {
    ...location,
    lastUpdated: location.lastUpdated ?? location.recordedAt ?? location.lastSeenAt ?? null,
  };
}

export function createAgentLocationService(): LocationService {
  let socket: Socket | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  const listeners = new Set<(locations: AgentLocation[]) => void>();
  let current: AgentLocation[] = [];

  const emit = (locations: AgentLocation[]) => {
    current = locations.map(normalize);
    for (const listener of listeners) listener(current);
  };

  const refresh = async () => {
    const data = await request<LocationsResponse>("/agents/locations");
    emit(data.locations ?? []);
  };

  const ensureSocket = () => {
    if (socket) return;
    socket = io("/", {
      path: "/socket.io",
      withCredentials: true,
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    socket.on("agent:location:update", (payload: { location?: AgentLocation }) => {
      if (!payload?.location) return;
      const next = normalize(payload.location);
      const idx = current.findIndex((l) => l.agentId === next.agentId);
      if (idx === -1) {
        emit([...current, next].sort((a, b) => a.agentName.localeCompare(b.agentName)));
      } else {
        const copy = current.slice();
        copy[idx] = next;
        emit(copy);
      }
    });

    socket.on("connect_error", () => {
      // Polling fallback keeps UI usable if websocket fails.
    });
  };

  const ensurePolling = () => {
    if (pollTimer) return;
    pollTimer = setInterval(() => {
      void refresh().catch(() => undefined);
    }, 15000);
  };

  const stop = () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  };

  return {
    async listLocations() {
      const data = await request<LocationsResponse>("/agents/locations");
      current = (data.locations ?? []).map(normalize);
      return current;
    },
    async getLocation(agentId: string) {
      const data = await request<LocationResponse>(`/agents/${encodeURIComponent(agentId)}/location`);
      return data.location ? normalize(data.location) : null;
    },
    async getHistory(agentId: string, params) {
      const q = params?.limit ? `?limit=${params.limit}` : "";
      const data = await request<HistoryResponse>(`/agents/${encodeURIComponent(agentId)}/location/history${q}`);
      return data.history ?? [];
    },
    subscribe(onUpdate) {
      listeners.add(onUpdate);
      if (current.length > 0) onUpdate(current);
      ensureSocket();
      ensurePolling();
      void refresh().catch(() => undefined);
      return () => {
        listeners.delete(onUpdate);
        if (listeners.size === 0) stop();
      };
    },
  };
}

export const agentLocationService = createAgentLocationService();
