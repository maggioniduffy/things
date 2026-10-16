import { QueryClientProvider, type InfiniteData } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ItemsPage } from "@/lib/items/queries";
import { itemsQueryKey } from "@/lib/items/queries";
import { makeItem, makeTestQueryClient } from "@/test/fixtures";
import {
  CanvasLayoutSaver,
  keepaliveFetch,
  LAYOUT_SAVE_ERROR,
  nodeToCanvasRect,
  normalizeRect,
  useCanvasLayoutSaver,
  type CanvasRect,
} from "./save";
import { itemsToNodes } from "./layout";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@supabase/ssr", () => ({ createBrowserClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/supabase/env", () => ({
  getSupabaseEnv: () => ({ url: "http://localhost", publishableKey: "key" }),
}));

type SaveFn = (layout: CanvasRect[]) => Promise<void>;
const rect = (id: string, x: number, y = 0): CanvasRect => ({ id, x, y, w: 280, h: 240, z: 0 });

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.useFakeTimers();
  mocks.rpc.mockReset();
  mocks.toast.error.mockReset();
});
afterEach(() => vi.useRealTimers());

describe("normalizeRect", () => {
  it("rounds positions and sizes to 0.1 and z to an integer", () => {
    expect(normalizeRect({ id: "a", x: 1.234, y: -5.678, w: 280.04, h: 240.06, z: 2.4 })).toEqual({
      id: "a",
      x: 1.2,
      y: -5.7,
      w: 280,
      h: 240.1,
      z: 2,
    });
  });
});

describe("nodeToCanvasRect", () => {
  it("reads the node's position, size and z", () => {
    const [node] = itemsToNodes([makeItem({ id: "a", canvas_x: 10, canvas_y: 20, canvas_z: 3 })]);
    expect(nodeToCanvasRect(node!)).toEqual({ id: "a", x: 10, y: 20, w: 240, h: 160, z: 3 });
  });
});

describe("CanvasLayoutSaver", () => {
  function setup(save: SaveFn = vi.fn<SaveFn>(async () => {})) {
    const onFlush = vi.fn();
    const onFailure = vi.fn();
    const saver = new CanvasLayoutSaver({
      save,
      baseline: (id) => (id === "stored" ? rect("stored", 5, 5) : null),
      onFlush,
      onFailure,
    });
    return { saver, save, onFlush, onFailure };
  }

  it("sends nothing until 400 ms after the last enqueue, then one merged call", async () => {
    const { saver, save, onFlush } = setup();
    saver.enqueue([rect("a", 1), rect("b", 2)]);
    await vi.advanceTimersByTimeAsync(300);
    saver.enqueue([rect("a", 10)]);
    await vi.advanceTimersByTimeAsync(300);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith([rect("a", 10), rect("b", 2)]);
    expect(onFlush).toHaveBeenCalledWith([rect("a", 10), rect("b", 2)]);
  });

  it("holds changes made during a save for a second call after it", async () => {
    const first = deferred();
    const save = vi.fn<SaveFn>(() => first.promise);
    const { saver } = setup(save);
    saver.enqueue([rect("a", 1)]);
    await vi.advanceTimersByTimeAsync(400);
    expect(save).toHaveBeenCalledTimes(1);

    saver.enqueue([rect("a", 2), rect("b", 3)]);
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(1);

    first.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith([rect("a", 2), rect("b", 3)]);
  });

  it("leaves a change that arrives right as a save ends to its own debounce", async () => {
    const first = deferred();
    const save = vi.fn<SaveFn>(() => first.promise);
    const { saver } = setup(save);
    saver.enqueue([rect("a", 1)]);
    await vi.advanceTimersByTimeAsync(400);
    saver.enqueue([rect("b", 2)]);
    first.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(400);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("flush skips the debounce", async () => {
    const { saver, save } = setup();
    saver.enqueue([rect("a", 1)]);
    await saver.flush();
    expect(save).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("on failure reports the last saved layout of each node", async () => {
    const save = vi
      .fn<(layout: CanvasRect[]) => Promise<void>>()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("boom"));
    const { saver, onFailure } = setup(save);

    // "a" saves fine, then fails on its second move; "stored" fails from its stored baseline;
    // "fresh" was never saved.
    saver.enqueue([rect("a", 1)]);
    await saver.flush();
    saver.enqueue([rect("a", 9), rect("stored", 50), rect("fresh", 7)]);
    await saver.flush();

    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith({
      restore: [
        { id: "a", rect: rect("a", 1) },
        { id: "stored", rect: rect("stored", 5, 5) },
        { id: "fresh", rect: null },
      ],
      rollback: [rect("a", 1), rect("stored", 5, 5)],
    });
    expect(saver.hasSeen("fresh")).toBe(true);
  });

  it("does not roll back a node that has a newer change waiting", async () => {
    const attempt = deferred();
    const { saver, onFailure } = setup(vi.fn(() => attempt.promise));
    saver.enqueue([rect("stored", 50), rect("other", 3)]);
    await vi.advanceTimersByTimeAsync(400);
    saver.enqueue([rect("stored", 60)]);
    attempt.reject(new Error("boom"));
    await vi.advanceTimersByTimeAsync(0);
    expect(onFailure).toHaveBeenCalledWith({
      restore: [{ id: "other", rect: null }],
      rollback: [],
    });
  });
});

describe("useCanvasLayoutSaver", () => {
  const ITEM_ID = "11111111-1111-4111-8111-111111111111";
  const KEY = itemsQueryKey({ type: "inbox" }, "manual");

  function setup() {
    const client = makeTestQueryClient();
    const item = makeItem({ id: ITEM_ID, canvas_x: 5, canvas_y: 6, canvas_w: 280, canvas_h: 240 });
    const seeded: InfiniteData<ItemsPage> = {
      pages: [{ items: [item], nextCursor: null }],
      pageParams: [null],
    };
    client.setQueryData(KEY, seeded);
    const onRollback = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const view = renderHook(() => useCanvasLayoutSaver([item], onRollback), { wrapper });
    const cached = () => client.getQueryData<InfiniteData<ItemsPage>>(KEY)?.pages[0]?.items[0];
    return { client, item, onRollback, cached, ...view };
  }

  it("patches only the canvas columns of cached rows when a batch goes out", async () => {
    mocks.rpc.mockResolvedValue({ error: null });
    const { result, cached, item } = setup();
    act(() => result.current.enqueue([{ id: ITEM_ID, x: 100.04, y: 200, w: 300, h: 250, z: 1 }]));
    await act(() => vi.advanceTimersByTimeAsync(400));

    expect(mocks.rpc).toHaveBeenCalledWith("save_canvas_layout", {
      layout: [{ id: ITEM_ID, x: 100, y: 200, w: 300, h: 250, z: 1 }],
    });
    expect(cached()).toEqual({
      ...item,
      canvas_x: 100,
      canvas_y: 200,
      canvas_w: 300,
      canvas_h: 250,
      canvas_z: 1,
    });
    expect(cached()?.position).toBe(item.position);
  });

  it("restores the cache, rolls the node back and toasts when the save fails", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "nope" } });
    const { result, cached, item, onRollback } = setup();
    act(() => result.current.enqueue([{ id: ITEM_ID, x: 100, y: 200, w: 300, h: 250, z: 1 }]));
    await act(() => vi.advanceTimersByTimeAsync(400));

    expect(onRollback).toHaveBeenCalledWith([
      { id: ITEM_ID, x: 5, y: 6, w: 280, h: 240, z: item.canvas_z },
    ]);
    expect(cached()).toMatchObject({ canvas_x: 5, canvas_y: 6, canvas_w: 280, canvas_h: 240 });
    expect(mocks.toast.error).toHaveBeenCalledWith(LAYOUT_SAVE_ERROR);
  });

  it("flushes on unmount", async () => {
    mocks.rpc.mockResolvedValue({ error: null });
    const { result, unmount } = setup();
    act(() => result.current.enqueue([{ id: ITEM_ID, x: 1, y: 2, w: 280, h: 240, z: 0 }]));
    expect(mocks.rpc).not.toHaveBeenCalled();
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("flushes on pagehide", async () => {
    mocks.rpc.mockResolvedValue({ error: null });
    const { result } = setup();
    act(() => result.current.enqueue([{ id: ITEM_ID, x: 1, y: 2, w: 280, h: 240, z: 0 }]));
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("flushes when the page becomes hidden", async () => {
    mocks.rpc.mockResolvedValue({ error: null });
    const { result } = setup();
    act(() => result.current.enqueue([{ id: ITEM_ID, x: 1, y: 2, w: 280, h: 240, z: 0 }]));
    const hidden = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    hidden.mockRestore();
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("cancels in-flight item refetches before patching the cache and sending", async () => {
    mocks.rpc.mockResolvedValue({ error: null });
    const { result, client, cached } = setup();
    const order: string[] = [];
    vi.spyOn(client, "cancelQueries").mockImplementation(async () => {
      order.push(`cancel:${cached()?.canvas_x}`);
    });
    mocks.rpc.mockImplementation(async () => {
      order.push(`rpc:${cached()?.canvas_x}`);
      return { error: null };
    });
    act(() => result.current.enqueue([{ id: ITEM_ID, x: 100, y: 200, w: 300, h: 250, z: 1 }]));
    await act(() => vi.advanceTimersByTimeAsync(400));
    expect(client.cancelQueries).toHaveBeenCalledWith({ queryKey: ["items"] });
    expect(order).toEqual(["cancel:5", "rpc:100"]);
  });
});

describe("keepaliveFetch", () => {
  it("adds keepalive to a small request", async () => {
    const base = vi.fn(async () => new Response("{}"));
    await keepaliveFetch(base)("http://x/rpc", { method: "POST", body: "{}" });
    expect(base).toHaveBeenCalledWith("http://x/rpc", {
      method: "POST",
      body: "{}",
      keepalive: true,
    });
  });

  it("falls back to a normal request above 64 KiB", async () => {
    const base = vi.fn(async () => new Response("{}"));
    const init = { method: "POST", body: "x".repeat(70 * 1024) };
    await keepaliveFetch(base)("http://x/rpc", init);
    expect(base).toHaveBeenCalledWith("http://x/rpc", init);
  });
});
