import { describe, expect, it } from "vitest";
import { cascade, centerOfViewport, useCanvasPlacer } from "./placement";

describe("cascade", () => {
  it("keeps the first item on the point and steps 24 px diagonally", () => {
    expect(cascade({ x: 10, y: 20 }, 0)).toEqual({ x: 10, y: 20 });
    expect(cascade({ x: 10, y: 20 }, 1)).toEqual({ x: 34, y: 44 });
    expect(cascade({ x: 10, y: 20 }, 3)).toEqual({ x: 82, y: 92 });
  });
});

describe("centerOfViewport", () => {
  it("maps the screen center to flow coordinates", () => {
    expect(centerOfViewport({ x: 0, y: 0, zoom: 1 }, { width: 800, height: 600 })).toEqual({
      x: 400,
      y: 300,
    });
  });
  it("accounts for pan and zoom", () => {
    expect(centerOfViewport({ x: -100, y: 50, zoom: 2 }, { width: 800, height: 600 })).toEqual({
      x: 250,
      y: 125,
    });
  });
});

describe("useCanvasPlacer", () => {
  it("holds and clears the registered placer", () => {
    const placer = () => ({ x: 1, y: 2 });
    useCanvasPlacer.getState().setPlacer(placer);
    expect(useCanvasPlacer.getState().placer).toBe(placer);
    useCanvasPlacer.getState().setPlacer(null);
    expect(useCanvasPlacer.getState().placer).toBeNull();
  });
});
