"use client";

import { useEffect, useRef } from "react";
import { useCapture } from "@/lib/items/mutations";
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

      const found = readDataTransfer(event.clipboardData);
      if (found.requests.length === 0) return;

      event.preventDefault();
      saveRequests(captureRef.current, found);
    }

    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  return null;
}
