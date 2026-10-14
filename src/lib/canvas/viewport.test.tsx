import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { makeTestQueryClient } from "@/test/fixtures";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  VIEWPORT_LOAD_TIMEOUT_MS,
  ViewportSaver,
  useInitialViewport,
  inboxViewportKey,
  parseViewport,
  readInboxViewport,
  writeInboxViewport,
} from "./viewport";

const mocks = vi.hoisted(() => ({ maybeSingle: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) }),
  }),
}));

describe("useInitialViewport", () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={makeTestQueryClient()}>{children}</QueryClientProvider>
  );
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("gives up waiting for a collection's viewport and opens fitted", async () => {
    mocks.maybeSingle.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(
      () => useInitialViewport({ type: "collection", collectionId: "c1" }),
      { wrapper },
    );
    expect(result.current.ready).toBe(false);
    await act(() => vi.advanceTimersByTimeAsync(VIEWPORT_LOAD_TIMEOUT_MS + 10));
    expect(result.current).toEqual({ ready: true, viewport: null });
  });

  it("is ready with the saved viewport once it loads", async () => {
    mocks.maybeSingle.mockResolvedValue({
      data: { canvas_viewport: { x: 1, y: 2, zoom: 3 } },
      error: null,
    });
    const { result } = renderHook(
      () => useInitialViewport({ type: "collection", collectionId: "c1" }),
      { wrapper },
    );
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(result.current).toEqual({ ready: true, viewport: { x: 1, y: 2, zoom: 2 } });
  });

  it("is ready at once for the Inbox", () => {
    const { result } = renderHook(() => useInitialViewport({ type: "inbox", userId: "u1" }), {
      wrapper,
    });
    expect(result.current.ready).toBe(true);
  });
});

describe("parseViewport", () => {
  it("accepts finite numbers and clamps the zoom to 0.1 - 2", () => {
    expect(parseViewport({ x: -40, y: 12.5, zoom: 0.8 })).toEqual({ x: -40, y: 12.5, zoom: 0.8 });
    expect(parseViewport({ x: 0, y: 0, zoom: 50 })?.zoom).toBe(2);
    expect(parseViewport({ x: 0, y: 0, zoom: 0 })?.zoom).toBe(0.1);
  });

  it.each([
    null,
    undefined,
    "x",
    [],
    {},
    { x: 1, y: 2 },
    { x: "1", y: 2, zoom: 1 },
    { x: Number.NaN, y: 2, zoom: 1 },
    { x: 1, y: Infinity, zoom: 1 },
  ])("rejects %j", (value) => {
    expect(parseViewport(value)).toBeNull();
  });
});

describe("inbox viewport storage", () => {
  beforeEach(() => localStorage.clear());

  it("keeps one entry per user", () => {
    writeInboxViewport("u1", { x: 1, y: 2, zoom: 1 });
    writeInboxViewport("u2", { x: 3, y: 4, zoom: 0.5 });
    expect(inboxViewportKey("u1")).not.toBe(inboxViewportKey("u2"));
    expect(readInboxViewport("u1")).toEqual({ x: 1, y: 2, zoom: 1 });
    expect(readInboxViewport("u2")).toEqual({ x: 3, y: 4, zoom: 0.5 });
    expect(readInboxViewport("u3")).toBeNull();
  });

  it("ignores an invalid or unparsable stored value", () => {
    localStorage.setItem(inboxViewportKey("u1"), JSON.stringify({ x: 1, y: 2, zoom: "big" }));
    expect(readInboxViewport("u1")).toBeNull();
    localStorage.setItem(inboxViewportKey("u1"), "{not json");
    expect(readInboxViewport("u1")).toBeNull();
  });

  it("survives storage that throws", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readInboxViewport("u1")).toBeNull();
    spy.mockRestore();
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    expect(() => writeInboxViewport("u1", { x: 0, y: 0, zoom: 1 })).not.toThrow();
    set.mockRestore();
  });
});

describe("ViewportSaver", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("saves the last viewport 1 s after the last move", () => {
    const save = vi.fn();
    const saver = new ViewportSaver(save);
    saver.schedule({ x: 1, y: 1, zoom: 1 });
    vi.advanceTimersByTime(800);
    saver.schedule({ x: 2, y: 2, zoom: 1 });
    vi.advanceTimersByTime(800);
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ x: 2, y: 2, zoom: 1 });
  });

  it("flush saves at once, and only once", () => {
    const save = vi.fn();
    const saver = new ViewportSaver(save);
    saver.schedule({ x: 1, y: 1, zoom: 1 });
    saver.flush();
    saver.flush();
    vi.advanceTimersByTime(2000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("swallows a failing save", async () => {
    const saver = new ViewportSaver(() => Promise.reject(new Error("offline")));
    saver.schedule({ x: 1, y: 1, zoom: 1 });
    expect(() => saver.flush()).not.toThrow();
    await vi.advanceTimersByTimeAsync(0);
  });
});
