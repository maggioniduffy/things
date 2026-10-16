import { beforeEach, describe, expect, it } from "vitest";
import { useCanvasClipboard } from "./canvas-clipboard";

describe("canvas clipboard store", () => {
  beforeEach(() => useCanvasClipboard.getState().setClipboard(null));

  it("starts empty, holds a copy and clears again", () => {
    expect(useCanvasClipboard.getState().clipboard).toBeNull();
    const clip = { entries: [{ id: "a", dx: 0, dy: 0 }], text: "a", width: 10, height: 10 };
    useCanvasClipboard.getState().setClipboard(clip);
    expect(useCanvasClipboard.getState().clipboard).toBe(clip);
    useCanvasClipboard.getState().setClipboard(null);
    expect(useCanvasClipboard.getState().clipboard).toBeNull();
  });
});
