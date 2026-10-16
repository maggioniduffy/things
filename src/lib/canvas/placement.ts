import type { CanvasClipboard } from "@/stores/canvas-clipboard";
import type { CanvasTarget, Point } from "./layout";

/**
 * What a persisted canvas offers the capture code while it is mounted: turning a pointer
 * position (or the middle of the visible canvas) into flow coordinates.
 */
export type CanvasPlacer = {
  /** `null` means the center of the viewport. Includes the z that stacks a new card on top. */
  flowPointAt(client: Point | null): CanvasTarget;
  /**
   * Pastes the copied cards where the pointer last was over the canvas (the viewport center when
   * it was not). Left out by canvases that cannot paste.
   */
  pasteCopies?(clipboard: CanvasClipboard): void;
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
