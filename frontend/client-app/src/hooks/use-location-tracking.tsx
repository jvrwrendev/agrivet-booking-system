import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { useAuth } from "./use-auth";
import {
  updateMyAgentLocation,
  updateMyTrackingState,
} from "@/services/location.service";

const BACKGROUND_TASK = "agrivet-agent-location-task";
const MIN_SEND_MS = 12_000;
const RETRY_MS = 20_000;

type TrackingStatus =
  | "idle"
  | "requesting_permission"
  | "tracking"
  | "denied"
  | "gps_unavailable"
  | "error"
  | "stopped";

interface LocationTrackingContextValue {
  status: TrackingStatus;
  lastSentAt: string | null;
  error: string | null;
  permissionGranted: boolean;
  startTracking: () => Promise<void>;
  stopTracking: () => Promise<void>;
}

type PendingLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  recordedAt: string;
};

const LocationTrackingContext = createContext<LocationTrackingContextValue | null>(null);

type TaskData = { locations?: Location.LocationObject[] };
try {
  TaskManager.defineTask(BACKGROUND_TASK, async ({ data, error }) => {
    if (error) return;
    const locations = (data as TaskData | undefined)?.locations;
    const latest = locations?.[locations.length - 1];
    if (!latest) return;
    try {
      const nonNeg = (v: number | null | undefined) =>
        v !== null && v !== undefined && Number.isFinite(v) && v >= 0 ? v : null;
      await updateMyAgentLocation({
        latitude: latest.coords.latitude,
        longitude: latest.coords.longitude,
        accuracy: nonNeg(latest.coords.accuracy),
        speed: nonNeg(latest.coords.speed),
        heading: nonNeg(latest.coords.heading),
        recordedAt: new Date(latest.timestamp).toISOString(),
        gpsAvailable: true,
        isTracking: true,
      });
    } catch {
      // best effort; foreground/watch will retry on next update
    }
  });
} catch {
  // Task definition can fail in unsupported runtimes; foreground tracking still works.
}

function numOrNull(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function toPending(loc: Location.LocationObject): PendingLocation {
  return {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    accuracy: numOrNull(loc.coords.accuracy),
    speed: numOrNull(loc.coords.speed),
    heading: numOrNull(loc.coords.heading),
    recordedAt: new Date(loc.timestamp).toISOString(),
  };
}

export function LocationTrackingProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [status, setStatus] = useState<TrackingStatus>("idle");
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const lastSentRef = useRef(0);
  const startingRef = useRef(false);
  const pendingRef = useRef<PendingLocation | null>(null);
  const sendingRef = useRef(false);

  const canTrack = isAuthenticated && user?.role === "AGENT" && Boolean(user?.emailVerified);

  const flushPending = useCallback(async (force = false) => {
    if (!canTrack || sendingRef.current) return;
    const pending = pendingRef.current;
    if (!pending) return;
    const now = Date.now();
    if (!force && now - lastSentRef.current < MIN_SEND_MS) return;

    sendingRef.current = true;
    try {
      await updateMyAgentLocation({
        ...pending,
        gpsAvailable: true,
        isTracking: true,
      });
      lastSentRef.current = Date.now();
      setLastSentAt(new Date().toISOString());
      setError(null);
      setStatus("tracking");
      pendingRef.current = null;
      if (__DEV__) console.log("[location] sent", pending.latitude, pending.longitude);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to send location";
      setError(message);
      if (__DEV__) console.warn("[location] send failed", message);
    } finally {
      sendingRef.current = false;
    }
  }, [canTrack]);

  const queueLocation = useCallback((loc: Location.LocationObject, force = false) => {
    pendingRef.current = toPending(loc);
    void flushPending(force);
  }, [flushPending]);

  const stopTracking = useCallback(async () => {
    startingRef.current = false;
    if (watchRef.current) {
      watchRef.current.remove();
      watchRef.current = null;
    }
    try {
      const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TASK);
      if (started) await Location.stopLocationUpdatesAsync(BACKGROUND_TASK);
    } catch {
      // ignore
    }
    if (user?.role === "AGENT" && isAuthenticated) {
      try {
        await updateMyTrackingState({ isTracking: false });
      } catch {
        // ignore - session may be gone during logout
      }
    }
    setStatus("stopped");
  }, [isAuthenticated, user?.role]);

  const startTracking = useCallback(async () => {
    if (!canTrack || startingRef.current) return;
    startingRef.current = true;
    setError(null);
    setStatus("requesting_permission");

    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setStatus("gps_unavailable");
        setError("Location services are disabled. Enable GPS to start tracking.");
        await updateMyTrackingState({ isTracking: false, gpsAvailable: false }).catch(() => undefined);
        return;
      }

      const fg = await Location.requestForegroundPermissionsAsync();
      if (fg.status !== "granted") {
        setPermissionGranted(false);
        setStatus("denied");
        setError("Location permission was denied.");
        await updateMyTrackingState({ isTracking: false, gpsAvailable: false }).catch(() => undefined);
        return;
      }

      setPermissionGranted(true);
      const bg = await Location.requestBackgroundPermissionsAsync().catch(() => null);

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      queueLocation(current, true);

      if (watchRef.current) {
        watchRef.current.remove();
        watchRef.current = null;
      }

      watchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 12_000,
          distanceInterval: 15,
        },
        (loc) => {
          queueLocation(loc);
        },
      );

      if (bg?.status === "granted") {
        try {
          const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TASK);
          if (!started) {
            await Location.startLocationUpdatesAsync(BACKGROUND_TASK, {
              accuracy: Location.Accuracy.Balanced,
              timeInterval: 15_000,
              distanceInterval: 20,
              pausesUpdatesAutomatically: true,
              showsBackgroundLocationIndicator: true,
              foregroundService: {
                notificationTitle: "Agrivet location tracking active",
                notificationBody: "Your location is being shared during your active work session.",
              },
            });
          }
        } catch (e) {
          if (__DEV__) console.warn("[location] background task unavailable", e);
        }
      }

      setStatus("tracking");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Unable to start location tracking.");
      if (__DEV__) console.warn("[location] start failed", e);
    } finally {
      startingRef.current = false;
    }
  }, [canTrack, queueLocation]);

  useEffect(() => {
    if (canTrack) {
      void startTracking();
    } else {
      void stopTracking();
    }
    return () => {
      if (watchRef.current) {
        watchRef.current.remove();
        watchRef.current = null;
      }
    };
  }, [canTrack, startTracking, stopTracking]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && canTrack) {
        void flushPending(true);
        if (status !== "tracking" && status !== "requesting_permission") {
          void startTracking();
        }
      }
    });
    return () => sub.remove();
  }, [canTrack, flushPending, startTracking, status]);

  useEffect(() => {
    if (!canTrack) return;
    const timer = setInterval(() => {
      void flushPending(false);
    }, RETRY_MS);
    return () => clearInterval(timer);
  }, [canTrack, flushPending]);

  const value = useMemo<LocationTrackingContextValue>(
    () => ({ status, lastSentAt, error, permissionGranted, startTracking, stopTracking }),
    [status, lastSentAt, error, permissionGranted, startTracking, stopTracking],
  );

  return <LocationTrackingContext.Provider value={value}>{children}</LocationTrackingContext.Provider>;
}

export function useLocationTracking() {
  const ctx = useContext(LocationTrackingContext);
  if (!ctx) throw new Error("useLocationTracking must be used within LocationTrackingProvider");
  return ctx;
}
