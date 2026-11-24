import { cn } from "@/lib/utils";
import { LOCATION_STATUS_META } from "./LocationStatusBadge";
import type { LocationStatus } from "../types";

interface LocationStatsProps {
  counts: Record<LocationStatus, number>;
  total: number;
  className?: string;
}

const CARDS: Array<{ key: "total" | LocationStatus; label: string; dot: string }> = [
  { key: "total", label: "Total Agents", dot: "bg-foreground/60" },
  { key: "online", label: "Online Agents", dot: LOCATION_STATUS_META.online.dot },
  { key: "inactive", label: "Inactive Agents", dot: LOCATION_STATUS_META.inactive.dot },
  { key: "offline", label: "Offline Agents", dot: LOCATION_STATUS_META.offline.dot },
];

export function LocationStats({ counts, total, className }: LocationStatsProps) {
  return (
    <div
      className={cn("grid grid-cols-2 gap-3 sm:grid-cols-4", className)}
      role="group"
      aria-label="Agent location summary"
    >
      {CARDS.map((card) => (
        <div key={card.key} className="rounded-lg border bg-card px-4 py-3">
          <div className="flex items-center gap-1.5">
            <span className={cn("h-1.5 w-1.5 rounded-full", card.dot)} aria-hidden />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {card.label}
            </span>
          </div>
          <div className="mt-1 text-xl font-semibold tabular-nums text-foreground">
            {card.key === "total" ? total : (counts[card.key] ?? 0)}
          </div>
        </div>
      ))}
    </div>
  );
}
