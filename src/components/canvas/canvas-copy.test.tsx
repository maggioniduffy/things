import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { activeCanvasPlacer } from "@/lib/canvas/placement";
import { makeItem, renderWithQuery } from "@/test/fixtures";
import { useCanvasClipboard } from "@/stores/canvas-clipboard";
import { CanvasView } from "./canvas-view";

const mocks = vi.hoisted(() => ({
  pasteCopies: vi.fn(),
  duplicateCards: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/components/providers/viewer-provider", () => ({
  useViewer: () => ({ userId: "u1", isGuest: false }),
}));
vi.mock("@/lib/canvas/viewport", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/canvas/viewport")>()),
  useInitialViewport: () => ({ ready: true, viewport: null }),
  useViewportSaver: () => () => {},
}));
vi.mock("@/lib/canvas/save", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/canvas/save")>()),
  useCanvasLayoutSaver: () => ({ enqueue: vi.fn(), hasSeen: () => true }),
}));
vi.mock("./use-canvas-actions", () => ({
  useCanvasActions: (collectionId: string | null) => ({
    collectionId,
    createNote: vi.fn(),
    moveItems: vi.fn(),
    pasteCopies: mocks.pasteCopies,
    duplicateCards: mocks.duplicateCards,
  }),
}));

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  Element.prototype.scrollIntoView = () => {};
  vi.stubGlobal(
    "DOMMatrixReadOnly",
    class {
      m22 = 1;
      constructor() {}
    },
  );
});

beforeEach(() => {
  vi.clearAllMocks();
  useCanvasClipboard.getState().setClipboard(null);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 1000,
    bottom: 800,
    width: 1000,
    height: 800,
    toJSON: () => ({}),
  });
});

afterEach(() => vi.restoreAllMocks());

const items = [
  makeItem({ id: "a", kind: "note", note: "Alpha", canvas_x: 0, canvas_y: 0, canvas_z: 0 }),
  makeItem({ id: "b", kind: "note", note: "Beta", canvas_x: 300, canvas_y: 100, canvas_z: 2 }),
];

function renderCanvas() {
  return renderWithQuery(
    <CanvasView items={items} persist={{ type: "collection", collectionId: "c1" }} />,
  );
}

async function selectCard(id: string) {
  const node = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);
  if (!node) throw new Error("No node.");
  fireEvent.click(node);
  await act(async () => {});
}

function copyEvent() {
  const data = new Map<string, string>();
  const event = new Event("copy", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", {
    value: { setData: (type: string, text: string) => data.set(type, text) },
  });
  fireEvent(document.body, event);
  return { event, data };
}

describe("canvas copy, paste and duplicate", () => {
  it("does not copy without a selection", () => {
    renderCanvas();
    const { event } = copyEvent();
    expect(event.defaultPrevented).toBe(false);
    expect(useCanvasClipboard.getState().clipboard).toBeNull();
  });

  it("copies the selection to both clipboards on a copy event", async () => {
    renderCanvas();
    await selectCard("b");
    const { event, data } = copyEvent();
    expect(event.defaultPrevented).toBe(true);
    const clip = useCanvasClipboard.getState().clipboard;
    expect(clip?.entries.map((entry) => entry.id).sort()).toEqual(["b"]);
    expect(data.get("text/plain")).toBe(clip?.text);
  });

  it("leaves a copy inside a field alone", async () => {
    renderCanvas();
    await selectCard("b");
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    const { event } = copyEvent();
    expect(event.defaultPrevented).toBe(false);
    input.remove();
  });

  it("registers a placer that pastes at the viewport center when the pointer is outside", () => {
    renderCanvas();
    const clip = { entries: [{ id: "a", dx: 0, dy: 0 }], text: "x", width: 10, height: 10 };
    activeCanvasPlacer()?.pasteCopies?.(clip);
    expect(mocks.pasteCopies).toHaveBeenCalledTimes(1);
    expect(mocks.pasteCopies.mock.calls[0]?.[0]).toBe(clip);
  });

  it("duplicates the selection on Cmd+D and cancels the browser default", async () => {
    renderCanvas();
    await selectCard("b");
    const event = new KeyboardEvent("keydown", {
      key: "d",
      metaKey: true,
      cancelable: true,
      bubbles: true,
    });
    act(() => {
      document.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(mocks.duplicateCards).toHaveBeenCalledTimes(1);
    const cards = mocks.duplicateCards.mock.calls[0]?.[0] as { item: { id: string } }[];
    expect(cards.map((card) => card.item.id).sort()).toEqual(["b"]);
  });

  it("leaves Cmd+C's keydown alone so the copy event fires", async () => {
    renderCanvas();
    await selectCard("b");
    const event = new KeyboardEvent("keydown", {
      key: "c",
      metaKey: true,
      cancelable: true,
      bubbles: true,
    });
    act(() => {
      document.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(false);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
