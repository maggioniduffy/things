"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useOpenItem } from "@/components/drawer/item-param";
import type { CanvasTarget } from "@/lib/canvas/layout";
import { useBatchMove } from "@/lib/items/batch-mutations";
import {
  duplicatePlacements,
  pastePlacements,
  usePasteCopies,
  type CopiedCard,
} from "@/lib/items/copy";
import type { NoteColor } from "@/lib/items/note-colors";
import { useCapture } from "@/lib/items/mutations";
import type { BoardItem } from "@/lib/items/queries";
import type { ViewSpec } from "@/lib/views";
import type { CanvasClipboard } from "@/stores/canvas-clipboard";

/** What a persisted canvas can do beyond moving cards around. */
export type CanvasActions = {
  /** The collection this canvas shows; null for the Inbox. */
  collectionId: string | null;
  /** Creates an empty note centered on `point`, then opens it in the drawer, ready to type. */
  createNote: (point: CanvasTarget) => void;
  /** Moves items to a collection (null = Inbox) in one optimistic batch. `label` is for the toast. */
  moveItems: (ids: readonly string[], collectionId: string | null, label: string) => void;
  /** Sets the background color of the notes among `ids` (null = default); other kinds are ignored. */
  colorNotes: (ids: readonly string[], color: NoteColor | null) => void;
  /**
   * Pastes the copied cards onto this canvas, their bounding box centered on `point`. `onCreated`
   * gets the new ids before they reach the lists.
   */
  pasteCopies: (
    clipboard: CanvasClipboard,
    point: CanvasTarget,
    onCreated: (ids: string[]) => void,
  ) => void;
  /** Duplicates `cards` 16 px down and right of where they are. */
  duplicateCards: (
    cards: readonly CopiedCard[],
    z: number,
    onCreated: (ids: string[]) => void,
  ) => void;
};

/** Focuses the drawer's note editor as soon as it exists. */
function focusNoteEditor(): void {
  let tries = 0;
  const tick = () => {
    const field = document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Note"]');
    if (field) field.focus();
    else if ((tries += 1) < 40) setTimeout(tick, 50);
  };
  tick();
}

export function useCanvasActions(collectionId: string | null): CanvasActions {
  const view = useMemo<ViewSpec>(
    () => (collectionId === null ? { type: "inbox" } : { type: "collection", collectionId }),
    [collectionId],
  );
  const capture = useCapture(view);
  const openItem = useOpenItem();
  const move = useBatchMove();
  const copy = usePasteCopies(collectionId);

  const openRef = useRef<(item: BoardItem) => void>(openItem);
  useEffect(() => {
    openRef.current = openItem;
  });

  const { captureNote } = capture;
  const createNote = useCallback(
    (point: CanvasTarget) => {
      void captureNote("", { allowEmpty: true, canvasAt: point }).then((item) => {
        if (!item) return;
        openRef.current(item);
        focusNoteEditor();
      });
    },
    [captureNote],
  );

  const moveItems = useCallback(
    (ids: readonly string[], target: string | null, label: string) => {
      void move(ids, { type: "collection", id: target }, label);
    },
    [move],
  );

  const colorNotes = useCallback(
    (ids: readonly string[], color: NoteColor | null) => {
      void move(ids, { type: "color", color });
    },
    [move],
  );

  const pasteCopies = useCallback(
    (clipboard: CanvasClipboard, point: CanvasTarget, onCreated: (ids: string[]) => void) => {
      void copy({
        placements: pastePlacements(clipboard, point),
        z: point.z ?? 0,
        verb: "Pasted",
        onCreated,
      });
    },
    [copy],
  );

  const duplicateCards = useCallback(
    (cards: readonly CopiedCard[], z: number, onCreated: (ids: string[]) => void) => {
      void copy({ placements: duplicatePlacements(cards), z, verb: "Duplicated", onCreated });
    },
    [copy],
  );

  return useMemo(
    () => ({ collectionId, createNote, moveItems, colorNotes, pasteCopies, duplicateCards }),
    [collectionId, createNote, moveItems, colorNotes, pasteCopies, duplicateCards],
  );
}
