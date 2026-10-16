import type { Point } from "./layout";

/**
 * What a persisted canvas offers the capture code while it is mounted: turning a pointer
 * position (or the middle of the visible canvas) into flow coordinates.
 */
export type CanvasPlacer = {
  /** `null` means the center of the viewport. */
  flowPointAt(client: Point | null): Point;
};

let current: CanvasPlacer | null = null;

/** Registers `placer` as the active one. The returned function unregisters it, if still active. */
export function registerCanvasPlacer(placer: CanvasPlacer): () => void {
  current = placer;
  return () => {
    if (current === placer) current = null;
  };
}

/** The placer of the canvas on screen, or null when there is none (grid, list, styleguide demo). */
export function activeCanvasPlacer(): CanvasPlacer | null {
  return current;
}
