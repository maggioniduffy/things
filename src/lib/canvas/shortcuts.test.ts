import { describe, expect, it } from "vitest";
import { canvasShortcut, type KeyLike } from "./shortcuts";

function key(init: Partial<KeyLike> & { key: string }): KeyLike {
  return {
    code: "",
    shiftKey: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    repeat: false,
    ...init,
  };
}

describe("canvasShortcut", () => {
  it.each([
    [{ key: "=", metaKey: true }, "zoomIn"],
    [{ key: "=", ctrlKey: true }, "zoomIn"],
    [{ key: "+", ctrlKey: true, shiftKey: true }, "zoomIn"],
    [{ key: "-", metaKey: true }, "zoomOut"],
    [{ key: "-", ctrlKey: true }, "zoomOut"],
    [{ key: "!", code: "Digit1", shiftKey: true }, "fitAll"],
    [{ key: "1", code: "Digit1", shiftKey: true }, "fitAll"],
    [{ key: ")", code: "Digit0", shiftKey: true }, "zoomTo100"],
    [{ key: "n" }, "newNote"],
    [{ key: "N" }, "newNote"],
    [{ key: "]" }, "bringToFront"],
    [{ key: "[" }, "sendToBack"],
    [{ key: "m" }, "move"],
    [{ key: "M" }, "move"],
    [{ key: "c", metaKey: true }, "copy"],
    [{ key: "c", ctrlKey: true }, "copy"],
    [{ key: "d", metaKey: true }, "duplicate"],
    [{ key: "d", ctrlKey: true }, "duplicate"],
    [{ key: "D", ctrlKey: true }, "duplicate"],
  ] as const)("%j -> %s", (init, action) => {
    expect(canvasShortcut(key(init))).toBe(action);
  });

  it.each([
    ["a plain =", { key: "=" }],
    ["a plain -", { key: "-" }],
    ["Shift+2", { key: "@", code: "Digit2", shiftKey: true }],
    ["plain 1", { key: "1", code: "Digit1" }],
    ["Cmd+1", { key: "1", code: "Digit1", metaKey: true }],
    ["Alt+N", { key: "n", altKey: true }],
    ["Cmd+N", { key: "n", metaKey: true }],
    ["Ctrl+M", { key: "m", ctrlKey: true }],
    ["Cmd+]", { key: "]", metaKey: true }],
    ["Cmd+V (a paste event)", { key: "v", metaKey: true }],
    ["plain c", { key: "c" }],
    ["plain d", { key: "d" }],
    ["Cmd+Shift+C", { key: "c", metaKey: true, shiftKey: true }],
    ["Cmd+Alt+D", { key: "d", metaKey: true, altKey: true }],
    ["space (pan)", { key: " " }],
    ["a letter that is not bound", { key: "x" }],
    ["Alt with zoom", { key: "=", metaKey: true, altKey: true }],
  ] as const)("ignores %s", (_name, init) => {
    expect(canvasShortcut(key(init))).toBeNull();
  });

  it("does not repeat note, z-order and move while the key is held", () => {
    expect(canvasShortcut(key({ key: "n", repeat: true }))).toBeNull();
    expect(canvasShortcut(key({ key: "]", repeat: true }))).toBeNull();
    expect(canvasShortcut(key({ key: "m", repeat: true }))).toBeNull();
    expect(canvasShortcut(key({ key: "d", metaKey: true, repeat: true }))).toBeNull();
    // Holding ⌘+ keeps zooming.
    expect(canvasShortcut(key({ key: "=", metaKey: true, repeat: true }))).toBe("zoomIn");
  });
});
