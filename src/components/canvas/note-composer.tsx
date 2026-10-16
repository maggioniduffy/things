"use client";

import { ViewportPortal } from "@xyflow/react";
import { useCallback, useRef, useState, type KeyboardEvent } from "react";
import { NOTE_SIZE } from "@/lib/canvas/layout";
import type { CanvasPoint } from "@/lib/canvas/placement";

type NoteComposerProps = {
  /** Flow coordinates of the note's top-left corner. */
  at: CanvasPoint;
  /** Called once with the trimmed, non-empty text. */
  onSave: (text: string) => void;
  /** Called once when nothing is saved (Esc, or blur with nothing typed). */
  onCancel: () => void;
};

/**
 * A sticky-note sized textarea on the canvas, where the note will land. Meta/Ctrl+Enter or
 * leaving the field with text saves; Esc or leaving it empty cancels. It lives in the viewport,
 * so it pans and zooms with the cards, and is marked `nodrag nopan nowheel` so typing, selecting
 * text and scrolling inside it never move the canvas.
 */
export function NoteComposer({ at, onSave, onCancel }: NoteComposerProps) {
  const [text, setText] = useState("");
  const done = useRef(false);
  // Focus when the field appears, which can be a render after this component (portal target).
  const focus = useCallback((element: HTMLTextAreaElement | null) => element?.focus(), []);

  function finish(save: boolean) {
    if (done.current) return;
    done.current = true;
    const trimmed = text.trim();
    if (save && trimmed !== "") onSave(trimmed);
    else onCancel();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Keep the canvas shortcuts and React Flow's own keys out of the field.
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      finish(false);
    } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      finish(true);
    }
  }

  return (
    <ViewportPortal>
      <div
        className="nodrag nopan nowheel absolute"
        style={{
          transform: `translate(${at.x}px, ${at.y}px)`,
          width: NOTE_SIZE.w,
          height: NOTE_SIZE.h,
        }}
        onPointerDown={(event) => event.stopPropagation()}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        <textarea
          ref={focus}
          value={text}
          aria-label="New note"
          placeholder="Write a note"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => finish(text.trim() !== "")}
          className="rounded-card border-line bg-paper text-body text-ink shadow-card placeholder:text-ink-subtle focus-visible:outline-focus h-full w-full resize-none border p-3 focus-visible:outline-2 focus-visible:outline-offset-2"
        />
      </div>
    </ViewportPortal>
  );
}
