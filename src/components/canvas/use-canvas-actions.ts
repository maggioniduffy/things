"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useOpenItem } from "@/components/drawer/item-param";
import type { CanvasTarget } from "@/lib/canvas/layout";
import { useBatchMove } from "@/lib/items/batch-mutations";
import { useCapture } from "@/lib/items/mutations";
import type { BoardItem } from "@/lib/items/queries";
import type { ViewSpec } from "@/lib/views";

/** What a persisted canvas can do beyond moving cards around. */
export type CanvasActions = {
  /** The collection this canvas shows; null for the Inbox. */
  collectionId: string | null;
  /** Creates an empty note centered on `point`, then opens it in the drawer, ready to type. */
  createNote: (point: CanvasTarget) => void;
  /** Moves items to a collection (null = Inbox) in one optimistic batch. `label` is for the toast. */
  moveItems: (ids: readonly string[], collectionId: string | null, label: string) => void;
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

  return useMemo(
    () => ({ collectionId, createNote, moveItems }),
    [collectionId, createNote, moveItems],
  );
}
