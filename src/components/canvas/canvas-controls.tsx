"use client";

import { Panel, useReactFlow } from "@xyflow/react";
import { MapIcon, MaximizeIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { IconButton } from "@/components/ui/icon-button";
import { useUiStore } from "@/stores/ui-store";

const ANIMATION_MS = 200;

/** Zoom in/out, fit all and the minimap toggle. Viewport moves skip their animation when reduced. */
export function CanvasControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const reduced = useReducedMotion() ?? false;
  const minimap = useUiStore((state) => state.canvasMinimap);
  const toggleMinimap = useUiStore((state) => state.toggleCanvasMinimap);
  const duration = reduced ? 0 : ANIMATION_MS;

  return (
    <Panel position="bottom-left" className="flex flex-col gap-1">
      <IconButton size="sm" label="Zoom in" onClick={() => void zoomIn({ duration })}>
        <ZoomInIcon />
      </IconButton>
      <IconButton size="sm" label="Zoom out" onClick={() => void zoomOut({ duration })}>
        <ZoomOutIcon />
      </IconButton>
      <IconButton
        size="sm"
        label="Fit all items"
        onClick={() => void fitView({ duration, padding: 0.2, maxZoom: 1 })}
      >
        <MaximizeIcon />
      </IconButton>
      <IconButton
        size="sm"
        variant={minimap ? "outline" : "ghost"}
        label={minimap ? "Hide minimap" : "Show minimap"}
        aria-pressed={minimap}
        onClick={toggleMinimap}
      >
        <MapIcon />
      </IconButton>
    </Panel>
  );
}
