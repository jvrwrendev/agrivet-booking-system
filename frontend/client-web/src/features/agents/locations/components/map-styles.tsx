import { Map as MapIcon, Layers } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Raster tile sources for the agent map.
 *
 * Defaults are public endpoints suitable for development/low volume.
 * Override with VITE_* env vars for licensed/production providers.
 */
const DEFAULT_SATELLITE_TILES =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const DEFAULT_STREET_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

const ESRI_ATTRIBUTION =
  "Tiles &copy; Esri &mdash; Esri, Maxar, Earthstar Geographics, and the GIS User Community";
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export type MapStyleId = "street" | "satellite";

export interface MapTileConfig {
  url: string;
  attribution: string;
  /** Highest zoom level the map can display (tiles may be scaled beyond native). */
  maxZoom: number;
  /** Highest zoom level where tiles actually exist. Beyond this, tiles are upscaled. */
  maxNativeZoom: number;
}

export const MAP_STYLE_OPTIONS: {
  id: MapStyleId;
  label: string;
  icon: typeof MapIcon;
}[] = [
  { id: "street", label: "Standard", icon: MapIcon },
  { id: "satellite", label: "Satellite", icon: Layers },
];

export function getMapTileConfig(id: MapStyleId): MapTileConfig {
  if (id === "satellite") {
    return {
      url: import.meta.env.VITE_SATELLITE_TILE_URL ?? DEFAULT_SATELLITE_TILES,
      attribution: ESRI_ATTRIBUTION,
      maxZoom: 20,
      maxNativeZoom: 19,
    };
  }
  return {
    url: import.meta.env.VITE_STREET_TILE_URL ?? DEFAULT_STREET_TILES,
    attribution: OSM_ATTRIBUTION,
    maxZoom: 20,
    maxNativeZoom: 19,
  };
}

export function MapStyleToggle({
  value,
  onChange,
  className,
}: {
  value: MapStyleId;
  onChange: (id: MapStyleId) => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Map base layer"
      className={cn("flex items-center rounded-md border bg-background p-0.5 shadow-sm", className)}
    >
      {MAP_STYLE_OPTIONS.map((option) => {
        const Icon = option.icon;
        const isActive = option.id === value;
        return (
          <Button
            key={option.id}
            type="button"
            size="sm"
            variant="ghost"
            aria-pressed={isActive}
            onClick={() => onChange(option.id)}
            className={cn(
              "h-7 gap-1.5 rounded-sm px-2.5 text-xs",
              isActive
                ? "bg-primary/10 font-medium text-primary hover:bg-primary/15"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">{option.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
