import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UI_STORE_KEY, useUiStore } from "./ui-store";

const initial = useUiStore.getState();

beforeEach(() => {
  localStorage.clear();
  useUiStore.setState(initial, true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("selection", () => {
  it("select replaces the selection by default", () => {
    useUiStore.getState().select("a");
    useUiStore.getState().select("b");
    expect(useUiStore.getState().selectedIds).toEqual(["b"]);
  });

  it("select with additive adds without duplicating", () => {
    const { select } = useUiStore.getState();
    select("a");
    select("b", { additive: true });
    select("b", { additive: true });
    expect(useUiStore.getState().selectedIds).toEqual(["a", "b"]);
  });

  it("toggle adds and removes", () => {
    const { toggle } = useUiStore.getState();
    toggle("a");
    toggle("b");
    toggle("a");
    expect(useUiStore.getState().selectedIds).toEqual(["b"]);
  });

  it("clearSelection empties the selection", () => {
    useUiStore.getState().select("a");
    useUiStore.getState().clearSelection();
    expect(useUiStore.getState().selectedIds).toEqual([]);
  });
});

describe("range selection", () => {
  const order = ["a", "b", "c", "d", "e", "f"];

  it("selects from the anchor to the target, in screen order", () => {
    const { select, selectRange } = useUiStore.getState();
    select("b");
    selectRange(order, "e");
    expect(useUiStore.getState().selectedIds).toEqual(["b", "c", "d", "e"]);
  });

  it("works backwards and keeps the anchor for the next range", () => {
    const { select, selectRange } = useUiStore.getState();
    select("d");
    selectRange(order, "b");
    expect(useUiStore.getState().selectedIds).toEqual(["b", "c", "d"]);
    expect(useUiStore.getState().anchorId).toBe("d");
    selectRange(order, "f");
    expect(useUiStore.getState().selectedIds).toEqual(["d", "e", "f"]);
  });

  it("selects the target alone and anchors there when there is no anchor", () => {
    useUiStore.getState().selectRange(order, "c");
    expect(useUiStore.getState().selectedIds).toEqual(["c"]);
    expect(useUiStore.getState().anchorId).toBe("c");
  });

  it("treats an anchor that left the list like no anchor", () => {
    useUiStore.getState().select("gone");
    useUiStore.getState().selectRange(order, "c");
    expect(useUiStore.getState().selectedIds).toEqual(["c"]);
  });

  it("ignores a target that is not in the list", () => {
    useUiStore.getState().select("a");
    useUiStore.getState().selectRange(order, "zzz");
    expect(useUiStore.getState().selectedIds).toEqual(["a"]);
  });

  it("additive keeps the cards selected outside the range", () => {
    const { select, toggle, selectRange } = useUiStore.getState();
    select("a");
    toggle("e"); // anchor moves to e
    selectRange(order, "c", { additive: true });
    expect(useUiStore.getState().selectedIds).toEqual(["a", "c", "d", "e"]);
  });

  it("toggle and select move the anchor, clearSelection resets it", () => {
    const { toggle, select, clearSelection } = useUiStore.getState();
    toggle("a");
    expect(useUiStore.getState().anchorId).toBe("a");
    select("b", { additive: true });
    expect(useUiStore.getState().anchorId).toBe("b");
    clearSelection();
    expect(useUiStore.getState()).toMatchObject({ selectedIds: [], anchorId: null });
  });
});

describe("layout flags", () => {
  it("toggles the sidebar and sets the mobile sidebar and palette", () => {
    const s = useUiStore.getState();
    s.toggleSidebar();
    s.setMobileSidebarOpen(true);
    s.setPaletteOpen(true);
    expect(useUiStore.getState()).toMatchObject({
      sidebarCollapsed: true,
      mobileSidebarOpen: true,
      paletteOpen: true,
    });
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState().sidebarCollapsed).toBe(false);
  });
});

describe("quick add", () => {
  it("opens and closes", () => {
    expect(useUiStore.getState().quickAddOpen).toBe(false);
    useUiStore.getState().setQuickAddOpen(true);
    expect(useUiStore.getState().quickAddOpen).toBe(true);
    useUiStore.getState().setQuickAddOpen(false);
    expect(useUiStore.getState().quickAddOpen).toBe(false);
  });
});

describe("persistence", () => {
  it("defaults to grid and does not read storage until rehydrated", () => {
    localStorage.setItem(UI_STORE_KEY, JSON.stringify({ state: { viewMode: "list" }, version: 0 }));
    expect(useUiStore.getState().viewMode).toBe("grid");
  });

  it("writes only viewMode", () => {
    const s = useUiStore.getState();
    s.setViewMode("list");
    s.select("a");
    s.toggleSidebar();
    s.setPaletteOpen(true);
    s.setQuickAddOpen(true);
    const stored = JSON.parse(localStorage.getItem(UI_STORE_KEY) ?? "null");
    expect(stored.state).toEqual({ viewMode: "list" });
  });

  it("rehydrate reads viewMode back", async () => {
    localStorage.setItem(UI_STORE_KEY, JSON.stringify({ state: { viewMode: "list" }, version: 0 }));
    await useUiStore.persist.rehydrate();
    expect(useUiStore.getState().viewMode).toBe("list");
  });

  it("keeps working when localStorage throws", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    await expect(useUiStore.persist.rehydrate()).resolves.not.toThrow();
    expect(() => useUiStore.getState().setViewMode("list")).not.toThrow();
    expect(useUiStore.getState().viewMode).toBe("list");
  });
});
