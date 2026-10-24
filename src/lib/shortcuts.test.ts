import { describe, expect, it } from "vitest";
import { boardShortcut, type KeyLike } from "./shortcuts";

function key(k: string, extra: Partial<KeyLike> = {}): KeyLike {
  return {
    key: k,
    code: "",
    shiftKey: false,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    ...extra,
  };
}
const idle = { pendingG: false };
const chord = { pendingG: true };

describe("boardShortcut", () => {
  it.each([
    ["metaKey", { metaKey: true }],
    ["ctrlKey", { ctrlKey: true }],
  ] as const)("%s+K opens the palette", (_name, mod) => {
    expect(boardShortcut(key("k", mod), idle)).toBe("palette");
    expect(boardShortcut(key("K", mod), idle)).toBe("palette");
  });

  it("/ focuses search, also when it needs Shift on the layout", () => {
    expect(boardShortcut(key("/"), idle)).toBe("focus-search");
    expect(boardShortcut(key("/", { shiftKey: true }), idle)).toBe("focus-search");
  });

  it.each(["j", "J", "ArrowDown", "ArrowRight"])("%s moves the cursor to the next card", (k) => {
    expect(boardShortcut(key(k), idle)).toBe("next");
  });

  it.each(["k", "K", "ArrowUp", "ArrowLeft"])("%s moves the cursor to the previous card", (k) => {
    expect(boardShortcut(key(k), idle)).toBe("prev");
  });

  it("Enter opens", () => expect(boardShortcut(key("Enter"), idle)).toBe("open"));
  it("Space is quick look", () => expect(boardShortcut(key(" "), idle)).toBe("quick-look"));
  it("F toggles favorite", () => expect(boardShortcut(key("f"), idle)).toBe("favorite"));
  it("E archives", () => expect(boardShortcut(key("e"), idle)).toBe("archive"));
  it("Backspace trashes", () => expect(boardShortcut(key("Backspace"), idle)).toBe("trash"));
  it("Delete trashes", () => expect(boardShortcut(key("Delete"), idle)).toBe("trash"));
  it("M moves", () => expect(boardShortcut(key("m"), idle)).toBe("move"));
  it("T tags", () => expect(boardShortcut(key("t"), idle)).toBe("tag"));
  it("G starts a chord", () => expect(boardShortcut(key("g"), idle)).toBe("chord"));

  it("G then I / A / F go to Inbox / All / Favorites", () => {
    expect(boardShortcut(key("i"), chord)).toBe("go-inbox");
    expect(boardShortcut(key("a"), chord)).toBe("go-all");
    expect(boardShortcut(key("f"), chord)).toBe("go-favorites");
  });

  it("any other key after G cancels the chord and is swallowed", () => {
    expect(boardShortcut(key("x"), chord)).toBe("cancel");
    expect(boardShortcut(key("j"), chord)).toBe("cancel");
    expect(boardShortcut(key("Escape"), chord)).toBe("cancel");
  });

  it("a bare modifier press does not cancel a chord", () => {
    expect(boardShortcut(key("Shift", { shiftKey: true }), chord)).toBeNull();
  });

  it("ignores repeats", () => {
    expect(boardShortcut(key("j", { repeat: true }), idle)).toBeNull();
    expect(boardShortcut(key("k", { metaKey: true, repeat: true }), idle)).toBeNull();
    expect(boardShortcut(key("i", { repeat: true }), chord)).toBeNull();
  });

  it("ignores modifiers other than Cmd/Ctrl on K", () => {
    expect(boardShortcut(key("f", { metaKey: true }), idle)).toBeNull();
    expect(boardShortcut(key("e", { ctrlKey: true }), idle)).toBeNull();
    expect(boardShortcut(key("m", { altKey: true }), idle)).toBeNull();
    expect(boardShortcut(key("t", { shiftKey: true }), idle)).toBeNull();
    expect(boardShortcut(key("k", { metaKey: true, shiftKey: true }), idle)).toBeNull();
    expect(boardShortcut(key("k", { altKey: true }), idle)).toBeNull();
    expect(boardShortcut(key("Enter", { metaKey: true }), idle)).toBeNull();
  });

  it("returns null for keys it does not own", () => {
    expect(boardShortcut(key("x"), idle)).toBeNull();
    expect(boardShortcut(key("Tab"), idle)).toBeNull();
  });
});
