import { create } from "zustand";

/** A point in flow (canvas) coordinates, or a screen point where the name says so. */
export type CanvasPoint = { x: number; y: number };

/** Offset between items placed by one gesture, down and to the right. */
export const CASCADE_STEP = 24;

/** `point` shifted by `index` cascade steps; item 0 lands exactly on `point`. */
export function cascade(point: CanvasPoint, index: number): CanvasPoint {
  return { x: point.x + index * CASCADE_STEP, y: point.y + index * CASCADE_STEP };
}

/** The flow point at the center of a viewport (React Flow's x/y/zoom) of the given pixel size. */
export function centerOfViewport(
  viewport: { x: number; y: number; zoom: number },
  size: { width: number; height: number },
): CanvasPoint {
  return {
    x: (size.width / 2 - viewport.x) / viewport.zoom,
    y: (size.height / 2 - viewport.y) / viewport.zoom,
  };
}

/** Turns a screen point into a flow point; with no point, the center of the viewport. */
export type CanvasPlacer = (client?: CanvasPoint) => CanvasPoint;

type PlacerState = {
  /** Registered by the mounted, visible canvas; null in grid and list view. */
  placer: CanvasPlacer | null;
  setPlacer: (placer: CanvasPlacer | null) => void;
};

export const useCanvasPlacer = create<PlacerState>()((set) => ({
  placer: null,
  setPlacer: (placer) => set({ placer }),
}));
