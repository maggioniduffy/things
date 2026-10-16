"use client";

import { useReactFlow } from "@xyflow/react";
import { useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";
import { isDialogOpen, isEditableElement } from "@/components/capture/paste-listener";
import { VIEWPORT_ANIMATION_MS } from "./canvas-controls";

export type CanvasShortcut =
  "zoom-in" | "zoom-out" | "fit-all" | "zoom-100" | "new-note" | "forward" | "backward" | "move";

/** The part of a `KeyboardEvent` the mapping reads, so tests can pass a plain object. */
export type KeyLike = Pick<
  KeyboardEvent,
  "key" | "code" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey"
>;

/**
 * Which canvas shortcut a key press is, or null. Zoom needs ⌘/Ctrl; the rest need no modifier
 * (Shift+1 and Shift+0 need Shift only). Digits are matched by `code`, because Shift+1 types "!"
 * on a US layout and something else elsewhere.
 */
export function canvasShortcut(event: KeyLike): CanvasShortcut | null {
  const { key, code, ctrlKey, metaKey, altKey, shiftKey } = event;
  if (altKey) return null;
  if (ctrlKey || metaKey) {
    if (key === "=" || key === "+" || code === "Equal" || code === "NumpadAdd") return "zoom-in";
    if (key === "-" || code === "Minus" || code === "NumpadSubtract") return "zoom-out";
    return null;
  }
  if (shiftKey) {
    if (code === "Digit1" || code === "Numpad1") return "fit-all";
    if (code === "Digit0" || code === "Numpad0") return "zoom-100";
    return null;
  }
  if (key === "]") return "forward";
  if (key === "[") return "backward";
  if (key === "n" || key === "N") return "new-note";
  if (key === "m" || key === "M") return "move";
  return null;
}

/** What each shortcut does that the viewport hooks do not already cover. */
export type CanvasShortcutActions = {
  newNote: () => void;
  forward: () => void;
  backward: () => void;
  openMove: () => void;
};

/**
 * Canvas keyboard shortcuts, active while the canvas is mounted. Ignored while typing in a field,
 * while a dialog or menu is open and for events something else already handled. Viewport moves
 * skip their animation under reduced motion.
 */
export function useCanvasShortcuts(actions: CanvasShortcutActions): void {
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow();
  const reduced = useReducedMotion() ?? false;
  const duration = reduced ? 0 : VIEWPORT_ANIMATION_MS;

  // Attached once; the handler reads the latest closures through the ref.
  const latest = useRef({ actions, zoomIn, zoomOut, zoomTo, fitView, duration });
  useEffect(() => {
    latest.current = { actions, zoomIn, zoomOut, zoomTo, fitView, duration };
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      const shortcut = canvasShortcut(event);
      if (!shortcut) return;
      const target = event.target instanceof Element ? event.target : null;
      if (isEditableElement(target) || isEditableElement(document.activeElement)) return;
      if (isDialogOpen() || document.querySelector('[role="menu"]') !== null) return;

      const { actions, zoomIn, zoomOut, zoomTo, fitView, duration } = latest.current;
      // Always: the browser would otherwise zoom the page on ⌘/Ctrl +/-.
      event.preventDefault();
      switch (shortcut) {
        case "zoom-in":
          void zoomIn({ duration });
          break;
        case "zoom-out":
          void zoomOut({ duration });
          break;
        case "fit-all":
          void fitView({ duration, padding: 0.2, maxZoom: 1 });
          break;
        case "zoom-100":
          void zoomTo(1, { duration });
          break;
        case "new-note":
          actions.newNote();
          break;
        case "forward":
          actions.forward();
          break;
        case "backward":
          actions.backward();
          break;
        case "move":
          actions.openMove();
          break;
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
}
