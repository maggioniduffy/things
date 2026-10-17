export type CanvasAction =
  | "zoomIn"
  | "zoomOut"
  | "fitAll"
  | "zoomTo100"
  | "newNote"
  | "bringToFront"
  | "sendToBack"
  | "move"
  | "copy"
  | "duplicate";

/** The part of a `KeyboardEvent` the table reads, so tests can pass a plain object. */
export type KeyLike = Pick<
  KeyboardEvent,
  "key" | "code" | "shiftKey" | "metaKey" | "ctrlKey" | "altKey"
> &
  Partial<Pick<KeyboardEvent, "repeat">>;

/**
 * The canvas key table. ⌘V is not here: a paste arrives as a `paste` event. ⌘C is, but its
 * keydown must not be cancelled (the `copy` event does the work); ⌘D is, and is cancelled so the
 * browser's bookmark dialog stays shut.
 * Letter keys act only on their own; bracket keys also with Alt or AltGr. Neither repeats.
 */
export function canvasShortcut(event: KeyLike): CanvasAction | null {
  // Some layouts type brackets with Alt or AltGr (Ctrl+Alt); the typed character decides there.
  if (
    (event.key === "[" || event.key === "]") &&
    !event.metaKey &&
    (!event.ctrlKey || event.altKey)
  ) {
    if (event.repeat || event.shiftKey) return null;
    return event.key === "]" ? "bringToFront" : "sendToBack";
  }
  if (event.altKey) return null;
  const mod = event.metaKey || event.ctrlKey;

  if (mod) {
    if (event.key === "=" || event.key === "+") return "zoomIn";
    if (event.key === "-") return "zoomOut";
    if (event.shiftKey) return null;
    if (event.key === "c" || event.key === "C") return "copy";
    if (event.key === "d" || event.key === "D") return event.repeat ? null : "duplicate";
    return null;
  }

  // Shift + 1 types "!" on most layouts, so these match the physical key.
  if (event.shiftKey) {
    if (event.code === "Digit1") return "fitAll";
    if (event.code === "Digit0") return "zoomTo100";
    return null;
  }

  if (event.repeat) return null;
  switch (event.key) {
    case "n":
    case "N":
      return "newNote";
    case "]":
      return "bringToFront";
    case "[":
      return "sendToBack";
    case "m":
    case "M":
      return "move";
    default:
      return null;
  }
}
