import { act, fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ViewSpec } from "@/lib/views";
import { registerCanvasPlacer } from "@/lib/canvas/placement";
import { ExternalDropZone } from "./external-drop-zone";

const capture = vi.hoisted(() => ({
  captureLink: vi.fn(async () => {}),
  captureNote: vi.fn(async () => {}),
  captureFile: vi.fn(async () => {}),
}));
vi.mock("@/lib/items/mutations", () => ({ useCapture: () => capture }));
vi.mock("sonner", () => ({ toast: vi.fn() }));

const VIEW: ViewSpec = { type: "inbox" };

type DragData = {
  types: string[];
  data?: Record<string, string>;
  files?: File[];
};

/** A drag event carrying a fake DataTransfer (jsdom has no DragEvent/DataTransfer). */
function drag(type: string, target: EventTarget, { types, data = {}, files = [] }: DragData) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const dataTransfer = {
    types,
    files,
    dropEffect: "none",
    getData: (format: string) => data[format] ?? "",
  };
  Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
  act(() => {
    target.dispatchEvent(event);
  });
  return { event, dataTransfer };
}

const FILES: DragData = {
  types: ["Files"],
  files: [new File(["x"], "x.png", { type: "image/png" })],
};
const overlay = () => document.querySelector('[data-slot="drop-overlay"]');

describe("ExternalDropZone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = "";
  });

  it("shows the overlay on an external dragenter and allows the drop", () => {
    render(<ExternalDropZone view={VIEW} />);
    expect(overlay()).not.toBeInTheDocument();

    const enter = drag("dragenter", document.body, FILES);
    expect(enter.event.defaultPrevented).toBe(true);
    expect(overlay()).toBeInTheDocument();

    const over = drag("dragover", document.body, FILES);
    expect(over.event.defaultPrevented).toBe(true);
    expect(over.dataTransfer.dropEffect).toBe("copy");
  });

  it.each([
    ["links", { types: ["text/uri-list", "text/html"] }],
    ["text", { types: ["text/plain"] }],
  ])("also reacts to dragged %s", (_name, dragData) => {
    render(<ExternalDropZone view={VIEW} />);
    drag("dragenter", document.body, dragData);
    expect(overlay()).toBeInTheDocument();
  });

  it("ignores a drag without supported types", () => {
    render(<ExternalDropZone view={VIEW} />);
    const enter = drag("dragenter", document.body, { types: ["application/x-custom"] });
    expect(enter.event.defaultPrevented).toBe(false);
    expect(overlay()).not.toBeInTheDocument();
    const over = drag("dragover", document.body, { types: ["application/x-custom"] });
    expect(over.event.defaultPrevented).toBe(false);
  });

  it("stays visible while the pointer moves between child elements", () => {
    render(<ExternalDropZone view={VIEW} />);
    const child = document.createElement("div");
    document.body.append(child);
    drag("dragenter", document.body, FILES);
    drag("dragenter", child, FILES);
    drag("dragleave", document.body, FILES);
    expect(overlay()).toBeInTheDocument();
    drag("dragleave", child, FILES);
    expect(overlay()).not.toBeInTheDocument();
  });

  it("hides on Escape, on window blur and on dragend", () => {
    render(<ExternalDropZone view={VIEW} />);
    drag("dragenter", document.body, FILES);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(overlay()).not.toBeInTheDocument();

    drag("dragenter", document.body, FILES);
    fireEvent.blur(window);
    expect(overlay()).not.toBeInTheDocument();

    drag("dragenter", document.body, FILES);
    drag("dragend", document.body, FILES);
    expect(overlay()).not.toBeInTheDocument();
  });

  it("saves dropped files, hides the overlay and prevents navigation", () => {
    render(<ExternalDropZone view={VIEW} />);
    drag("dragenter", document.body, FILES);
    const drop = drag("drop", document.body, FILES);
    expect(drop.event.defaultPrevented).toBe(true);
    expect(overlay()).not.toBeInTheDocument();
    expect(capture.captureFile).toHaveBeenCalledWith(FILES.files?.[0]);
  });

  it("drops at the cursor of an active canvas", () => {
    const flowPointAt = vi.fn(() => ({ x: 7, y: 9 }));
    const unregister = registerCanvasPlacer({ flowPointAt });
    render(<ExternalDropZone view={VIEW} />);
    const event = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperties(event, {
      clientX: { value: 120 },
      clientY: { value: 80 },
      dataTransfer: { value: { types: FILES.types, files: FILES.files, getData: () => "" } },
    });
    act(() => {
      document.body.dispatchEvent(event);
    });
    expect(flowPointAt).toHaveBeenCalledWith({ x: 120, y: 80 });
    expect(capture.captureFile).toHaveBeenCalledWith(FILES.files?.[0], {
      canvasAt: { x: 7, y: 9 },
    });
    unregister();
  });

  it("saves a dropped link", () => {
    render(<ExternalDropZone view={VIEW} />);
    drag("dragenter", document.body, { types: ["text/uri-list"] });
    drag("drop", document.body, {
      types: ["text/uri-list", "text/plain"],
      data: { "text/uri-list": "https://example.com/a", "text/plain": "https://example.com/a" },
    });
    expect(capture.captureLink).toHaveBeenCalledWith("https://example.com/a");
    expect(capture.captureNote).not.toHaveBeenCalled();
  });

  it("does not save a drop it does not recognise", () => {
    render(<ExternalDropZone view={VIEW} />);
    const drop = drag("drop", document.body, { types: ["application/x-custom"] });
    expect(drop.event.defaultPrevented).toBe(false);
    expect(capture.captureFile).not.toHaveBeenCalled();
  });

  describe("with a dialog open", () => {
    beforeEach(() => {
      const dialog = document.createElement("div");
      dialog.setAttribute("role", "dialog");
      document.body.append(dialog);
    });

    it("shows no overlay, saves nothing, and keeps the browser from opening the file", () => {
      render(<ExternalDropZone view={VIEW} />);
      const enter = drag("dragenter", document.body, FILES);
      expect(enter.event.defaultPrevented).toBe(true);
      expect(overlay()).not.toBeInTheDocument();
      const drop = drag("drop", document.body, FILES);
      expect(drop.event.defaultPrevented).toBe(true);
      expect(capture.captureFile).not.toHaveBeenCalled();
    });

    it("leaves drags over a text field to the field", () => {
      render(<ExternalDropZone view={VIEW} />);
      const textarea = document.createElement("textarea");
      document.body.append(textarea);
      const over = drag("dragover", textarea, { types: ["text/plain"] });
      expect(over.event.defaultPrevented).toBe(false);
    });
  });

  it("ignores drags that started on the page, until that drag ends", () => {
    render(<ExternalDropZone view={VIEW} />);
    const TEXT: DragData = { types: ["text/plain"], data: { "text/plain": "selected words" } };
    drag("dragstart", document.body, TEXT);
    drag("dragenter", document.body, TEXT);
    expect(overlay()).not.toBeInTheDocument();
    const drop = drag("drop", document.body, TEXT);
    expect(drop.event.defaultPrevented).toBe(false);
    expect(capture.captureNote).not.toHaveBeenCalled();

    // The next drag from outside the page works again.
    drag("dragenter", document.body, FILES);
    expect(overlay()).toBeInTheDocument();
  });

  it("removes its listeners on unmount", () => {
    const { unmount } = render(<ExternalDropZone view={VIEW} />);
    unmount();
    const enter = drag("dragenter", document.body, FILES);
    expect(enter.event.defaultPrevented).toBe(false);
  });
});
