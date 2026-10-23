"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DISTANCE = 80;
const FLICK_DISTANCE = 30;
const FLICK_VELOCITY = 0.5; // px per ms
const IGNORE =
  "input, textarea, select, [contenteditable]:not([contenteditable='false']), iframe, canvas";

function scrollsHorizontally(el: Element | null, root: Element): boolean {
  for (let node = el; node && node !== root; node = node.parentElement) {
    if (node.scrollWidth > node.clientWidth + 1) {
      const overflowX = getComputedStyle(node).overflowX;
      if (overflowX === "auto" || overflowX === "scroll") return true;
    }
  }
  return false;
}

function hasTextSelection(): boolean {
  const selection = typeof window === "undefined" ? null : window.getSelection();
  return Boolean(selection && !selection.isCollapsed && selection.toString().length > 0);
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Swipe right to close a right-anchored panel on touch screens. Returns a callback ref for the
 * panel element. Starts ignoring gestures from form fields, iframes, canvases, horizontally
 * scrollable areas and while text is selected. The panel follows the finger unless the user
 * prefers reduced motion.
 */
export function useSwipeToClose({ enabled, onClose }: { enabled: boolean; onClose: () => void }) {
  const [element, setElement] = useState<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const el = element;
    if (!el || !enabled) return;
    let start: { x: number; y: number; t: number } | null = null;
    let dragging = false;
    let dx = 0;

    const reset = () => {
      el.style.transform = "";
      el.style.transition = "";
      start = null;
      dragging = false;
      dx = 0;
    };

    const onStart = (e: TouchEvent) => {
      reset();
      if (e.touches.length !== 1) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest(IGNORE) || scrollsHorizontally(target, el) || hasTextSelection()) return;
      const touch = e.touches[0];
      if (!touch) return;
      start = { x: touch.clientX, y: touch.clientY, t: Date.now() };
    };

    const onMove = (e: TouchEvent) => {
      if (!start) return;
      const touch = e.touches[0];
      if (!touch) return;
      const moveX = touch.clientX - start.x;
      const moveY = touch.clientY - start.y;
      if (!dragging) {
        if (Math.abs(moveY) > 10 && Math.abs(moveY) > Math.abs(moveX)) {
          start = null; // a vertical scroll
          return;
        }
        if (moveX > 10 && Math.abs(moveX) > 1.5 * Math.abs(moveY)) dragging = true;
        else return;
      }
      dx = Math.max(0, moveX);
      if (!prefersReducedMotion()) {
        el.style.transition = "none";
        el.style.transform = `translateX(${dx}px)`;
      }
    };

    const onEnd = (e: TouchEvent) => {
      if (!start) return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const moveX = touch.clientX - start.x;
      const moveY = touch.clientY - start.y;
      const elapsed = Math.max(1, Date.now() - start.t);
      const horizontal = moveX > 0 && Math.abs(moveX) > 1.5 * Math.abs(moveY);
      const far = moveX > DISTANCE;
      const flick = moveX > FLICK_DISTANCE && moveX / elapsed > FLICK_VELOCITY;
      reset();
      if (horizontal && (far || flick)) onCloseRef.current();
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", reset, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", reset);
      reset();
    };
  }, [element, enabled]);

  return useCallback((node: HTMLElement | null) => setElement(node), []);
}
