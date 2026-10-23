"use client";

import { Panel, useReactFlow } from "@xyflow/react";
import {
  GridIcon,
  HandIcon,
  MapIcon,
  MaximizeIcon,
  MousePointer2Icon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useMemo } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { useT } from "@/i18n/client";
import { useUiStore } from "@/stores/ui-store";

const ANIMATION_MS = 200;

/**
 * The viewport moves behind the buttons and the keyboard shortcuts. They skip their animation
 * under reduced motion.
 */
export function useCanvasViewportActions() {
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow();
  const reduced = useReducedMotion() ?? false;
  const duration = reduced ? 0 : ANIMATION_MS;
  return useMemo(
    () => ({
      zoomIn: () => void zoomIn({ duration }),
      zoomOut: () => void zoomOut({ duration }),
      fitAll: () => void fitView({ duration, padding: 0.2, maxZoom: 1 }),
      /** 100%, around the center of the viewport. */
      zoomTo100: () => void zoomTo(1, { duration }),
    }),
    [zoomIn, zoomOut, zoomTo, fitView, duration],
  );
}

/** Zoom in/out, fit all, snap and the minimap toggle. */
export function CanvasControls() {
  const t = useT().items.canvas;
  const viewport = useCanvasViewportActions();
  const minimap = useUiStore((state) => state.canvasMinimap);
  const toggleMinimap = useUiStore((state) => state.toggleCanvasMinimap);
  const tool = useUiStore((state) => state.canvasTool);
  const setTool = useUiStore((state) => state.setCanvasTool);
  const snap = useUiStore((state) => state.canvasSnap);
  const toggleSnap = useUiStore((state) => state.toggleCanvasSnap);

  return (
    <Panel position="bottom-left" className="flex flex-col gap-1">
      <IconButton
        size="sm"
        variant={tool === "select" ? "outline" : "ghost"}
        label={t.select}
        aria-pressed={tool === "select"}
        aria-keyshortcuts="V"
        onClick={() => setTool("select")}
      >
        <MousePointer2Icon />
      </IconButton>
      <IconButton
        size="sm"
        variant={tool === "hand" ? "outline" : "ghost"}
        label={t.hand}
        aria-pressed={tool === "hand"}
        aria-keyshortcuts="H"
        onClick={() => setTool("hand")}
      >
        <HandIcon />
      </IconButton>
      <IconButton
        size="sm"
        label={t.zoomIn}
        aria-keyshortcuts="Control+= Meta+="
        onClick={viewport.zoomIn}
      >
        <ZoomInIcon />
      </IconButton>
      <IconButton
        size="sm"
        label={t.zoomOut}
        aria-keyshortcuts="Control+- Meta+-"
        onClick={viewport.zoomOut}
      >
        <ZoomOutIcon />
      </IconButton>
      <IconButton size="sm" label={t.fitAll} aria-keyshortcuts="Shift+1" onClick={viewport.fitAll}>
        <MaximizeIcon />
      </IconButton>
      <IconButton
        size="sm"
        variant={snap ? "outline" : "ghost"}
        label={t.snapToGrid}
        aria-pressed={snap}
        onClick={toggleSnap}
      >
        <GridIcon />
      </IconButton>
      <IconButton
        size="sm"
        variant={minimap ? "outline" : "ghost"}
        label={minimap ? t.hideMinimap : t.showMinimap}
        aria-pressed={minimap}
        onClick={toggleMinimap}
      >
        <MapIcon />
      </IconButton>
    </Panel>
  );
}
