import { fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ViewSpec } from "@/lib/views";
import type { DataTransferLike } from "./clipboard";
import { registerCanvasPlacer } from "@/lib/canvas/placement";
import { PasteListener } from "./paste-listener";

const capture = vi.hoisted(() => ({
  captureLink: vi.fn(async () => {}),
  captureNote: vi.fn(async () => {}),
  captureFile: vi.fn(async () => {}),
  captureText: vi.fn(async () => {}),
  retryEnrich: vi.fn(async () => {}),
}));
const useCapture = vi.hoisted(() => vi.fn());
vi.mock("@/lib/items/mutations", () => ({ useCapture }));
vi.mock("sonner", () => ({ toast: vi.fn() }));

const VIEW: ViewSpec = { type: "inbox" };

function clipboard(data: Record<string, string> = {}, files: File[] = []): DataTransferLike {
  return { files, getData: (format) => data[format] ?? "" };
}

/** Fires a paste at `target` and returns the event, so tests can read `defaultPrevented`. */
function paste(target: Element | Document, data: DataTransferLike): Event {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", { value: data });
  fireEvent(target, event);
  return event;
}

describe("PasteListener", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCapture.mockReturnValue(capture);
    document.body.innerHTML = "";
  });

  it("saves a pasted URL as a link and prevents the default paste", () => {
    render(<PasteListener view={VIEW} />);
    const event = paste(document.body, clipboard({ "text/plain": "https://example.com/post" }));
    expect(event.defaultPrevented).toBe(true);
    expect(capture.captureLink).toHaveBeenCalledWith("https://example.com/post");
  });

  it("saves pasted text as a note", () => {
    render(<PasteListener view={VIEW} />);
    paste(document.body, clipboard({ "text/plain": "Buy milk" }));
    expect(capture.captureNote).toHaveBeenCalledWith("Buy milk");
  });

  it("saves a pasted image as a file", () => {
    render(<PasteListener view={VIEW} />);
    const image = new File(["png"], "image.png", { type: "image/png" });
    paste(document.body, clipboard({}, [image]));
    expect(capture.captureFile).toHaveBeenCalledWith(image);
  });

  it("uses the view it was given", () => {
    const view: ViewSpec = { type: "collection", collectionId: "c1" };
    render(<PasteListener view={view} />);
    expect(useCapture).toHaveBeenCalledWith(view);
  });

  it.each([
    ["input", () => document.createElement("input")],
    ["textarea", () => document.createElement("textarea")],
    ["select", () => document.createElement("select")],
    [
      "contenteditable",
      () => {
        const div = document.createElement("div");
        div.setAttribute("contenteditable", "true");
        return div;
      },
    ],
  ])("ignores a paste into a %s", (_name, make) => {
    render(<PasteListener view={VIEW} />);
    const field = make();
    document.body.append(field);
    const event = paste(field, clipboard({ "text/plain": "hello" }));
    expect(event.defaultPrevented).toBe(false);
    expect(capture.captureNote).not.toHaveBeenCalled();
  });

  it("ignores a paste inside an element nested in an editable region", () => {
    render(<PasteListener view={VIEW} />);
    const editor = document.createElement("div");
    editor.setAttribute("contenteditable", "true");
    const inner = document.createElement("span");
    editor.append(inner);
    document.body.append(editor);
    paste(inner, clipboard({ "text/plain": "hello" }));
    expect(capture.captureNote).not.toHaveBeenCalled();
  });

  it("ignores a paste when an input is focused even if the event targets the body", () => {
    render(<PasteListener view={VIEW} />);
    const input = document.createElement("input");
    document.body.append(input);
    input.focus();
    paste(document.body, clipboard({ "text/plain": "hello" }));
    expect(capture.captureNote).not.toHaveBeenCalled();
  });

  it("does not treat contenteditable=false as editable", () => {
    render(<PasteListener view={VIEW} />);
    const div = document.createElement("div");
    div.setAttribute("contenteditable", "false");
    document.body.append(div);
    paste(div, clipboard({ "text/plain": "hello" }));
    expect(capture.captureNote).toHaveBeenCalledWith("hello");
  });

  it("ignores a paste while a dialog is open", () => {
    render(<PasteListener view={VIEW} />);
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.append(dialog);
    const event = paste(document.body, clipboard({ "text/plain": "hello" }));
    expect(event.defaultPrevented).toBe(false);
    expect(capture.captureNote).not.toHaveBeenCalled();
  });

  it("leaves an empty paste alone", () => {
    render(<PasteListener view={VIEW} />);
    const event = paste(document.body, clipboard({ "text/plain": "  " }));
    expect(event.defaultPrevented).toBe(false);
    expect(capture.captureNote).not.toHaveBeenCalled();
  });

  it("pastes at the viewport center of an active canvas", () => {
    const flowPointAt = vi.fn(() => ({ x: 40, y: 60 }));
    const unregister = registerCanvasPlacer({ flowPointAt });
    render(<PasteListener view={VIEW} />);
    paste(document.body, clipboard({ "text/plain": "https://example.com/post" }));
    expect(flowPointAt).toHaveBeenCalledWith(null);
    expect(capture.captureLink).toHaveBeenCalledWith("https://example.com/post", {
      canvasAt: { x: 40, y: 60 },
    });
    unregister();
  });

  it("stops listening once unmounted", () => {
    const { unmount } = render(<PasteListener view={VIEW} />);
    unmount();
    paste(document.body, clipboard({ "text/plain": "hello" }));
    expect(capture.captureNote).not.toHaveBeenCalled();
  });
});
