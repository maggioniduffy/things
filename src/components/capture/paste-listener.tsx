"use client";

import { useEffect, useRef } from "react";
import { activeCanvasPlacer } from "@/lib/canvas/placement";
import { useCapture } from "@/lib/items/mutations";
import { useCanvasClipboard } from "@/stores/canvas-clipboard";
import type { ViewSpec } from "@/lib/views";
import { readDataTransfer, saveRequests } from "./clipboard";

const EDITABLE = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';

/** True for form fields and editable regions: a paste there belongs to the field. */
export function isEditableElement(element: Element | null): boolean {
  return element?.closest(EDITABLE) != null;
}

/** An open dialog or drawer owns the keyboard (quick add handles its own paste). */
export function isDialogOpen(): boolean {
  return document.querySelector('[role="dialog"]') !== null;
}

/**
 * Saves whatever is pasted anywhere on the page (a URL, text, a screenshot or files), unless the
 * paste is meant for a field or a dialog. Renders nothing.
 */
export function PasteListener({ view }: { view: ViewSpec }) {
  const capture = useCapture(view);
  // The listener is attached once; it reads the latest capture functions through the ref.
  const captureRef = useRef(capture);
  useEffect(() => {
    captureRef.current = capture;
  }, [capture]);

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      if (event.defaultPrevented || !event.clipboardData) return;
      const target = event.target instanceof Element ? event.target : null;
      if (isEditableElement(target) || isEditableElement(document.activeElement)) return;
      if (isDialogOpen()) return;

      const placer = activeCanvasPlacer();
      // The system clipboard still holds the text of the last canvas copy: paste the cards.
      const copied = useCanvasClipboard.getState().clipboard;
      if (
        placer?.pasteCopies &&
        copied &&
        // Windows hands text back with CRLF line endings.
        event.clipboardData.getData("text/plain").replace(/\r\n/g, "\n") === copied.text
      ) {
        event.preventDefault();
        placer.pasteCopies(copied);
        return;
      }

      const found = readDataTransfer(event.clipboardData);
      if (found.requests.length === 0) return;

      event.preventDefault();
      // On a canvas, a paste lands in the middle of what is on screen.
      saveRequests(captureRef.current, found, placer ? { canvasAt: placer.flowPointAt(null) } : {});
    }

    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  return null;
}
