export type CanvasAction =
  | "zoomIn"
  | "zoomOut"
  | "fitAll"
  | "zoomTo100"
  | "newNote"
  | "bringToFront"
  | "sendToBack"
  | "move";

/** The part of a `KeyboardEvent` the table reads, so tests can pass a plain object. */
export type KeyLike = Pick<
  KeyboardEvent,
  "key" | "code" | "shiftKey" | "metaKey" | "ctrlKey" | "altKey"
> &
  Partial<Pick<KeyboardEvent, "repeat">>;

/**
 * The canvas key table (⌘C/⌘V/⌘D are not here: they belong to copy and paste).
 * Letter and bracket keys act only on their own, and not while a key is held down.
 */
export function canvasShortcut(event: KeyLike): CanvasAction | null {
  if (event.altKey) return null;
  const mod = event.metaKey || event.ctrlKey;

  if (mod) {
    if (event.key === "=" || event.key === "+") return "zoomIn";
    if (event.key === "-") return "zoomOut";
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
