import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { activeCanvasPlacer } from "@/lib/canvas/placement";
import { makeItem, renderWithQuery } from "@/test/fixtures";
import { CanvasView } from "./canvas-view";

const mocks = vi.hoisted(() => ({
  enqueue: vi.fn(),
  createNote: vi.fn(),
  moveItems: vi.fn(),
  colorNotes: vi.fn(),
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
  useCanvasLayoutSaver: () => ({ enqueue: mocks.enqueue, hasSeen: () => true }),
}));
vi.mock("./use-canvas-actions", () => ({
  useCanvasActions: (collectionId: string | null) => ({
    collectionId,
    createNote: mocks.createNote,
    moveItems: mocks.moveItems,
    colorNotes: mocks.colorNotes,
  }),
}));

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverStub);
  // cmdk scrolls the highlighted row into view.
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
  // The pane is 1000 x 800 at the page origin.
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
  makeItem({ id: "a", kind: "note", title: "Alpha", canvas_x: 0, canvas_y: 0, canvas_z: 0 }),
  makeItem({ id: "b", kind: "note", title: "Beta", canvas_x: 300, canvas_y: 0, canvas_z: 2 }),
];

const target = { type: "collection", collectionId: "c1" } as const;

function renderCanvas() {
  return renderWithQuery(<CanvasView items={items} persist={target} />);
}

const node = (container: HTMLElement, id: string) =>
  container.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`)!;

function select(container: HTMLElement, id: string) {
  fireEvent.click(node(container, id));
  expect(node(container, id)).toHaveClass("selected");
}

function press(init: KeyboardEventInit, target: Element | Document = document.body) {
  fireEvent.keyDown(target, init);
}

describe("canvas tools", () => {
  it("creates a note at the flow point on a double-click on empty space", () => {
    const { container } = renderCanvas();
    const pane = container.querySelector(".react-flow__pane")!;
    fireEvent.doubleClick(pane, { clientX: 120, clientY: 80 });
    expect(mocks.createNote).toHaveBeenCalledWith({ x: 120, y: 80, snap: false, z: 3 });
  });

  it("does not create a note when the double-click lands on a card", () => {
    const { container } = renderCanvas();
    fireEvent.doubleClick(node(container, "a"), { clientX: 10, clientY: 10 });
    expect(mocks.createNote).not.toHaveBeenCalled();
  });

  it("N makes a note at the center of the viewport", () => {
    renderCanvas();
    press({ key: "n" });
    expect(mocks.createNote).toHaveBeenCalledWith({ x: 500, y: 400, snap: false, z: 3 });
  });

  it("leaves the zoom keys to the browser while focus is outside the canvas", () => {
    renderCanvas();
    const outside = document.createElement("button");
    document.body.append(outside);
    outside.focus();
    const zoom = new KeyboardEvent("keydown", {
      key: "=",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    outside.dispatchEvent(zoom);
    expect(zoom.defaultPrevented).toBe(false);
    outside.remove();
    const onCanvas = new KeyboardEvent("keydown", {
      key: "=",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    document.body.dispatchEvent(onCanvas);
    expect(onCanvas.defaultPrevented).toBe(true);
  });

  it("registers a placer while mounted and drops it on unmount", () => {
    const { unmount } = renderCanvas();
    expect(activeCanvasPlacer()?.flowPointAt(null)).toEqual({ x: 500, y: 400, snap: false, z: 3 });
    // A pointer outside the canvas falls back to the center.
    expect(activeCanvasPlacer()?.flowPointAt({ x: 5000, y: 5000 })).toEqual({
      x: 500,
      y: 400,
      snap: false,
      z: 3,
    });
    expect(activeCanvasPlacer()?.flowPointAt({ x: 100, y: 50 })).toEqual({
      x: 100,
      y: 50,
      snap: false,
      z: 3,
    });
    unmount();
    expect(activeCanvasPlacer()).toBeNull();
  });

  it("] brings the selection to front and [ sends it to back, saving the z", () => {
    const { container } = renderCanvas();
    select(container, "a");

    press({ key: "]" });
    expect(mocks.enqueue).toHaveBeenLastCalledWith([expect.objectContaining({ id: "a", z: 3 })]);
    // Position is the layout's x/y, not the grid order column.
    expect(mocks.enqueue.mock.calls.at(-1)?.[0][0]).toMatchObject({ x: 0, y: 0 });

    press({ key: "[" });
    expect(mocks.enqueue).toHaveBeenLastCalledWith([expect.objectContaining({ id: "a", z: 1 })]);
  });

  it("does nothing for ] without a selection", () => {
    renderCanvas();
    press({ key: "]" });
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it("M opens the move dialog for the selection, and does nothing without one", () => {
    const { container } = renderCanvas();
    press({ key: "m" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    select(container, "a");
    press({ key: "m" });
    expect(screen.getByRole("dialog", { name: "Move 1 item to…" })).toBeInTheDocument();
  });

  it("moves the selection to the collection picked in the dialog", () => {
    const { container, client } = renderCanvas();
    client.setQueryData(
      ["collections"],
      [
        { id: "c1", name: "Here", emoji: null, color: null, position: "a" },
        { id: "c2", name: "Reading", emoji: null, color: null, position: "b" },
      ],
    );
    select(container, "a");
    press({ key: "m" });
    expect(screen.getByRole("option", { name: "Here" })).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(screen.getByRole("option", { name: "Reading" }));
    expect(mocks.moveItems).toHaveBeenCalledWith(["a"], "c2", "Reading");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("ignores shortcuts while typing in a field", () => {
    renderCanvas();
    const input = document.createElement("input");
    document.body.append(input);
    press({ key: "n" }, input);
    expect(mocks.createNote).not.toHaveBeenCalled();
    input.remove();
  });

  it("shows the resize handles on the selected card only", () => {
    const { container } = renderCanvas();
    expect(container.querySelector(".react-flow__resize-control")).toBeNull();
    select(container, "a");
    expect(node(container, "a").querySelector(".react-flow__resize-control")).not.toBeNull();
    expect(node(container, "b").querySelector(".react-flow__resize-control")).toBeNull();
  });

  it("offers Bring to front, Send to back and Move to… on a card's context menu", async () => {
    const { container } = renderCanvas();
    fireEvent.contextMenu(node(container, "b"), { clientX: 10, clientY: 10 });
    expect(await screen.findByRole("menuitem", { name: /Bring to front/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Send to back/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /Move to…/ })).toBeInTheDocument();
    // The card under the pointer became the selection.
    expect(node(container, "b")).toHaveClass("selected");
  });

  it("colors the selected notes from the Color submenu, leaving other kinds out of the menu", async () => {
    const { container } = renderWithQuery(
      <CanvasView
        items={[
          ...items,
          makeItem({ id: "l", kind: "link", title: "Link", canvas_x: 600, canvas_y: 0 }),
        ]}
        persist={target}
      />,
    );
    fireEvent.contextMenu(node(container, "l"), { clientX: 10, clientY: 10 });
    await screen.findByRole("menuitem", { name: /Bring to front/ });
    expect(screen.queryByRole("menuitem", { name: /Color/ })).not.toBeInTheDocument();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });

    fireEvent.contextMenu(node(container, "b"), { clientX: 10, clientY: 10 });
    const trigger = await screen.findByRole("menuitem", { name: /Color/ });
    fireEvent.keyDown(trigger, { key: "ArrowRight" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Graphite" }));
    expect(mocks.colorNotes).toHaveBeenCalledWith(["b"], "graphite");
  });

  it("creates a note where the pane is right-clicked", async () => {
    const { container } = renderCanvas();
    fireEvent.contextMenu(container.querySelector(".react-flow__pane")!, {
      clientX: 200,
      clientY: 150,
    });
    fireEvent.click(await screen.findByRole("menuitem", { name: "New note here" }));
    expect(mocks.createNote).toHaveBeenCalledWith({ x: 200, y: 150, snap: false, z: 3 });
  });

  it("ignores a double-click on the pane of a canvas that is not persisted", () => {
    const { container } = renderWithQuery(<CanvasView items={items} />);
    fireEvent.doubleClick(container.querySelector(".react-flow__pane")!, {
      clientX: 1,
      clientY: 1,
    });
    expect(mocks.createNote).not.toHaveBeenCalled();
    act(() => press({ key: "n" }));
    expect(mocks.createNote).not.toHaveBeenCalled();
    expect(activeCanvasPlacer()).toBeNull();
  });
});
