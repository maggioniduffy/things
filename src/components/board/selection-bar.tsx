"use client";

import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  FolderInputIcon,
  Trash2Icon,
  Undo2Icon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import { MoveDialog } from "@/components/canvas/move-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useT } from "@/i18n/client";
import { useBatchMove, type BatchAction } from "@/lib/items/batch-mutations";
import type { ViewSpec } from "@/lib/views";
import { useUiStore } from "@/stores/ui-store";

type SelectionBarProps = {
  view: ViewSpec;
  /** Ids of every item loaded in the view: what "Select all" selects. */
  itemIds: readonly string[];
};

/**
 * The actions for the selected cards, by view. Trash: restore, archive, delete forever. Archive:
 * restore, trash. Anywhere else: move to a collection, archive, trash.
 */
export function SelectionBar({ view, itemIds }: SelectionBarProps) {
  const t = useT().items.selection;
  const move = useBatchMove();
  const selectedIds = useUiStore((state) => state.selectedIds);
  const selectMode = useUiStore((state) => state.selectMode);
  const selectAll = useUiStore((state) => state.selectAll);
  const clearSelection = useUiStore((state) => state.clearSelection);
  const setSelectMode = useUiStore((state) => state.setSelectMode);
  const [moving, setMoving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (!selectMode && selectedIds.length === 0) return null;

  // The selection can outlive items that left the view; only what is on screen counts.
  const loaded = new Set(itemIds);
  const ids = selectedIds.filter((id) => loaded.has(id));
  const allSelected = itemIds.length > 0 && ids.length === itemIds.length;
  const disabled = ids.length === 0;

  function run(action: BatchAction, label?: string) {
    void move(ids, action, label).then((saved) => {
      if (saved) clearSelection();
    });
  }

  return (
    <div
      role="toolbar"
      aria-label={t.toolbarLabel}
      className="bg-surface border-line rounded-card shadow-card fixed inset-x-3 bottom-4 z-30 mx-auto flex w-fit max-w-[calc(100%-1.5rem)] flex-wrap items-center justify-center gap-2 border p-2 backdrop-blur-md"
    >
      <span role="status" className="text-body text-ink px-2 font-medium">
        {ids.length === 0 ? t.none : t.count(ids.length)}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => (allSelected ? clearSelection() : selectAll(itemIds))}
      >
        {allSelected ? t.deselectAll : t.selectAll}
      </Button>

      {view.type === "trash" ? (
        <>
          <Button
            variant="secondary"
            size="sm"
            disabled={disabled}
            onClick={() => run({ type: "restore" })}
          >
            <Undo2Icon />
            {t.restore}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={disabled}
            onClick={() => run({ type: "archive" })}
          >
            <ArchiveIcon />
            {t.archive}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={disabled}
            onClick={() => setConfirming(true)}
          >
            <Trash2Icon />
            {t.deleteForever}
          </Button>
        </>
      ) : view.type === "archive" ? (
        <>
          <Button
            variant="secondary"
            size="sm"
            disabled={disabled}
            onClick={() => run({ type: "unarchive" })}
          >
            <ArchiveRestoreIcon />
            {t.restore}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={disabled}
            onClick={() => run({ type: "trash" })}
          >
            <Trash2Icon />
            {t.trash}
          </Button>
        </>
      ) : (
        <>
          <Button variant="secondary" size="sm" disabled={disabled} onClick={() => setMoving(true)}>
            <FolderInputIcon />
            {t.moveTo}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={disabled}
            onClick={() => run({ type: "archive" })}
          >
            <ArchiveIcon />
            {t.archive}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={disabled}
            onClick={() => run({ type: "trash" })}
          >
            <Trash2Icon />
            {t.trash}
          </Button>
        </>
      )}

      <Button variant="ghost" size="sm" onClick={() => setSelectMode(false)}>
        <XIcon />
        {t.done}
      </Button>

      <MoveDialog
        open={moving}
        onOpenChange={setMoving}
        count={ids.length}
        currentCollectionId={view.type === "collection" ? view.collectionId : null}
        onPick={(collectionId, label) => run({ type: "collection", id: collectionId }, label)}
      />
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.deleteForeverTitle(ids.length)}</DialogTitle>
            <DialogDescription>{t.deleteForeverBody}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              {t.cancel}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirming(false);
                run({ type: "deleteForever" });
              }}
            >
              {t.deleteForever}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
