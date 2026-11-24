import { StatusBadge } from "@/components/common/StatusBadge";
import type { StatusVariant } from "@/lib/status";
import type { LocationStatus } from "../types";

export const LOCATION_STATUS_META: Record<
  LocationStatus,
  { label: string; short: string; variant: StatusVariant; dot: string; marker: string }
> = {
  online: {
    label: "Online",
    short: "Online",
    variant: "success",
    dot: "bg-success",
    marker: "#16A34A",
  },
  inactive: {
    label: "Inactive",
    short: "Inactive",
    variant: "warning",
    dot: "bg-warning",
    marker: "#F59E0B",
  },
  offline: {
    label: "Offline",
    short: "Offline",
    variant: "muted",
    dot: "bg-muted-foreground",
    marker: "#64748B",
  },
  gps_unavailable: {
    label: "GPS Unavailable",
    short: "GPS Unavailable",
    variant: "destructive",
    dot: "bg-destructive",
    marker: "#DC2626",
  },
};

export const LOCATION_STATUS_LABEL: Record<LocationStatus, string> = {
  online: LOCATION_STATUS_META.online.label,
  inactive: LOCATION_STATUS_META.inactive.label,
  offline: LOCATION_STATUS_META.offline.label,
  gps_unavailable: LOCATION_STATUS_META.gps_unavailable.label,
};

export function getLocationStatusVariant(status: LocationStatus): StatusVariant {
  return LOCATION_STATUS_META[status].variant;
}

export function LocationStatusBadge({ status }: { status: LocationStatus }) {
  return (
    <StatusBadge
      variant={getLocationStatusVariant(status)}
      label={LOCATION_STATUS_META[status].short}
    />
  );
}

export function LocationStatusDot({
  status,
  className,
}: {
  status: LocationStatus;
  className?: string;
}) {
  return (
    <span
      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${LOCATION_STATUS_META[status].dot} ${className ?? ""}`}
      aria-hidden
    />
  );
}

export const LOCATION_STATUS_MARKER_COLOR: Record<LocationStatus, string> = {
  online: "bg-success",
  inactive: "bg-warning",
  offline: "bg-muted-foreground",
  gps_unavailable: "bg-destructive",
};
