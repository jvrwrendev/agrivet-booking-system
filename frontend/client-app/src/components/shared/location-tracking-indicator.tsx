import React from "react";
import { View } from "react-native";
import { MapPin, MapPinOff } from "lucide-react-native";
import { Text } from "@/components/ui/text";
import { useLocationTracking } from "@/hooks/use-location-tracking";

export function LocationTrackingIndicator() {
  const { status, error } = useLocationTracking();

  if (status === "idle" || status === "stopped") return null;

  const active = status === "tracking";
  const denied = status === "denied" || status === "gps_unavailable" || status === "error";
  const label =
    status === "tracking"
      ? "GPS tracking active"
      : status === "requesting_permission"
        ? "Requesting GPS permission..."
        : status === "denied"
          ? "Location permission denied"
          : status === "gps_unavailable"
            ? "GPS unavailable"
            : status === "error"
              ? "Location tracking error"
              : "GPS tracking stopped";

  return (
    <View
      className={`mt-3 flex-row items-center gap-2 rounded-md border px-3 py-2 ${
        active
          ? "border-primary/20 bg-primary/5"
          : denied
            ? "border-danger/20 bg-danger/5"
            : "border-border bg-secondary/40"
      }`}
    >
      {active ? (
        <MapPin size={14} color="#16A34A" />
      ) : (
        <MapPinOff size={14} color={denied ? "#DC2626" : "#64748B"} />
      )}
      <View className="flex-1">
        <Text className={`text-[12px] font-medium ${active ? "text-primary" : denied ? "text-danger" : "text-muted-foreground"}`}>
          {label}
        </Text>
        {error && !active ? (
          <Text className="mt-0.5 text-[11px] text-muted-foreground">{error}</Text>
        ) : null}
      </View>
    </View>
  );
}
