"use client";

import { useEffect, useRef, useState } from "react";
import { useCapture } from "@/lib/items/mutations";
import type { ViewSpec } from "@/lib/views";
import { isExternalDrag, readDataTransfer, saveRequests } from "./clipboard";
import { DropOverlay } from "./drop-overlay";
import { isDialogOpen, isEditableElement } from "./paste-listener";

/**
 * Accepts files, links and text dragged in from outside the page (native HTML5 drag events; the
 * dnd-kit drags inside the app use pointer events and never reach this). Shows the "Drop to save"
 * overlay while such a drag is over the window and saves what is dropped.
 */
export function ExternalDropZone({ view }: { view: ViewSpec }) {
  const capture = useCapture(view);
  const captureRef = useRef(capture);
  useEffect(() => {
    captureRef.current = capture;
  }, [capture]);

  const [active, setActive] = useState(false);

  useEffect(() => {
    // Entering a child fires dragenter before the parent's dragleave, so count instead of toggling.
    let depth = 0;
    // A drag that started on this page (selected text, a link in a card) is not a capture.
    let internal = false;

    function reset() {
      depth = 0;
      internal = false;
      setActive(false);
    }

    function onDragStart() {
      internal = true;
    }

    /**
     * "save": an external drag over the board. "swallow": an external drag while a dialog is open
     * (keeps the browser from navigating to a dropped file; fields still take text natively).
     * null: not ours.
     */
    function classify(event: DragEvent): "save" | "swallow" | null {
      if (internal || !isExternalDrag(event.dataTransfer?.types)) return null;
      if (!isDialogOpen()) return "save";
      const target = event.target instanceof Element ? event.target : null;
      return isEditableElement(target) ? null : "swallow";
    }

    function onDragEnter(event: DragEvent) {
      const mode = classify(event);
      if (!mode) return;
      event.preventDefault();
      if (mode !== "save") return;
      depth += 1;
      setActive(true);
    }

    function onDragOver(event: DragEvent) {
      const mode = classify(event);
      if (!mode) return;
      // Without this the browser refuses the drop.
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = mode === "save" ? "copy" : "none";
    }

    function onDragLeave(event: DragEvent) {
      if (classify(event) !== "save") return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setActive(false);
    }

    function onDrop(event: DragEvent) {
      const mode = classify(event);
      reset();
      if (!mode) return;
      event.preventDefault();
      if (mode !== "save" || !event.dataTransfer) return;
      const found = readDataTransfer(event.dataTransfer);
      if (found.requests.length > 0) saveRequests(captureRef.current, found);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") reset();
    }

    window.addEventListener("dragstart", onDragStart);
    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragend", reset);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("dragstart", onDragStart);
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragend", reset);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", reset);
    };
  }, []);

  return <DropOverlay visible={active} />;
}
