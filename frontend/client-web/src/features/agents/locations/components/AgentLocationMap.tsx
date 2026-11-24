import { Suspense, lazy, useMemo, useState } from "react";
import { Crosshair } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { MapLegend } from "./MapLegend";
import { MapStyleToggle, getMapTileConfig, type MapStyleId } from "./map-styles";
import type { MapMarker } from "./MapCanvas";

export type { MapMarker } from "./MapCanvas";

const MapCanvas = lazy(() => import("./MapCanvas"));

interface AgentLocationMapProps {
  markers: MapMarker[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  initialCenter: { latitude: number; longitude: number };
  initialZoom: number;
  selectedZoom?: number;
  fitSignal?: number;
  className?: string;
  showRecenter?: boolean;
  onRecenterClick?: () => void;
  recenterLabel?: string;
  showLegend?: boolean;
}

export function AgentLocationMap({
  markers,
  selectedId,
  onSelect,
  initialCenter,
  initialZoom,
  selectedZoom,
  fitSignal = 0,
  className,
  showRecenter = true,
  onRecenterClick,
  recenterLabel = "Recenter",
  showLegend = true,
}: AgentLocationMapProps) {
  const [mapStyle, setMapStyle] = useState<MapStyleId>("street");
  const tile = useMemo(() => getMapTileConfig(mapStyle), [mapStyle]);

  return (
    <div className={cn("relative overflow-hidden rounded-lg border bg-muted/40", className)}>
      <Suspense
        fallback={
          <div className="flex h-full w-full items-center justify-center bg-muted/40" aria-busy="true">
            <Spinner className="h-5 w-5" label="Loading map" />
          </div>
        }
      >
        <MapCanvas
          markers={markers}
          selectedId={selectedId}
          onSelect={onSelect}
          initialCenter={initialCenter}
          initialZoom={initialZoom}
          selectedZoom={selectedZoom}
          fitSignal={fitSignal}
          tileUrl={tile.url}
          tileAttribution={tile.attribution}
          tileMaxZoom={tile.maxZoom}
          tileMaxNativeZoom={tile.maxNativeZoom}
          className="h-full w-full"
        />
      </Suspense>

      {showLegend && <MapLegend />}

      <div className="absolute right-3 top-3 z-[500] flex items-center gap-2">
        <MapStyleToggle value={mapStyle} onChange={setMapStyle} />
        {showRecenter ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onRecenterClick}
            className="h-8 gap-1.5 bg-background px-2.5 text-xs shadow-sm"
          >
            <Crosshair className="h-3.5 w-3.5" aria-hidden />
            <span className="hidden sm:inline">{recenterLabel}</span>
            <span className="sr-only sm:hidden">{recenterLabel}</span>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
