import type { KeyLike } from "@/lib/canvas/shortcuts";

export type { KeyLike };

export type BoardAction =
  | "palette"
  | "focus-search"
  | "next"
  | "prev"
  | "open"
  | "quick-look"
  | "favorite"
  | "archive"
  | "trash"
  | "move"
  | "tag"
  /** G pressed: the next key picks where to go. */
  | "chord"
  | "go-inbox"
  | "go-all"
  | "go-favorites"
  /** Any other key while a chord is pending: the chord ends and the key is swallowed. */
  | "cancel";

export type ShortcutState = { pendingG: boolean };

/** How long G waits for its second key. */
export const CHORD_TIMEOUT_MS = 1200;

const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "AltGraph", "CapsLock"]);

const CHORD_TARGETS: Record<string, BoardAction> = {
  i: "go-inbox",
  a: "go-all",
  f: "go-favorites",
};

/**
 * The board's key table. ⌘/Ctrl+K is the only combination; everything else acts on the bare key
 * (Shift is tolerated only for "/", which some layouts type with it). Held keys do not repeat.
 * With `pendingG`, the key is read as the second half of a "G then …" chord.
 */
export function boardShortcut(event: KeyLike, state: ShortcutState): BoardAction | null {
  if (MODIFIER_KEYS.has(event.key)) return null;
  if (event.repeat) return null;
  const mod = event.metaKey || event.ctrlKey;
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;

  if (mod && !event.altKey && !event.shiftKey && key === "k") return "palette";
  if (mod || event.altKey) return null;

  if (state.pendingG) {
    if (event.shiftKey) return "cancel";
    return CHORD_TARGETS[key] ?? "cancel";
  }

  if (key === "/") return "focus-search";
  if (event.shiftKey) return null;

  switch (key) {
    case "j":
    case "ArrowDown":
    case "ArrowRight":
      return "next";
    case "k":
    case "ArrowUp":
    case "ArrowLeft":
      return "prev";
    case "Enter":
      return "open";
    case " ":
    case "Spacebar":
      return "quick-look";
    case "f":
      return "favorite";
    case "e":
      return "archive";
    case "Backspace":
    case "Delete":
      return "trash";
    case "m":
      return "move";
    case "t":
      return "tag";
    case "g":
      return "chord";
    default:
      return null;
  }
}
