import { describe, expect, it } from "vitest";
import { activeCanvasPlacer, registerCanvasPlacer, type CanvasPlacer } from "./placement";

const placer = (x: number): CanvasPlacer => ({ flowPointAt: () => ({ x, y: x }) });

describe("canvas placer registry", () => {
  it("has no placer until one registers", () => {
    expect(activeCanvasPlacer()).toBeNull();
  });

  it("returns the registered placer and clears it on unregister", () => {
    const a = placer(1);
    const unregister = registerCanvasPlacer(a);
    expect(activeCanvasPlacer()).toBe(a);
    unregister();
    expect(activeCanvasPlacer()).toBeNull();
  });

  it("only unregisters itself when it is still the active one", () => {
    const a = placer(1);
    const b = placer(2);
    const unregisterA = registerCanvasPlacer(a);
    const unregisterB = registerCanvasPlacer(b);
    unregisterA();
    expect(activeCanvasPlacer()).toBe(b);
    unregisterB();
    expect(activeCanvasPlacer()).toBeNull();
  });
});
