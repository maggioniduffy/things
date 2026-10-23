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
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { useT } from "@/i18n/client";
import { useBatchMove, type BatchAction } from "@/lib/items/batch-mutations";
import type { ViewSpec } from "@/lib/views";
import { useUiStore } from "@/stores/ui-store";

type SelectionBarProps = {
  view: ViewSpec;
  /** Ids of every item loaded in the view: what "Select all" selects. */
  itemIds: readonly string[];
};

// The bar is graphite with inverse ink, so it reads clearly over any card.
const ACTION =
  "border-ink-inverse/20 bg-ink-inverse/5 text-ink-inverse hover:border-ink-inverse/40 hover:bg-ink-inverse/10";
const QUIET = "text-ink-inverse-muted hover:bg-ink-inverse/10 hover:text-ink-inverse";
const DANGER = "border-aurora-coral/40 bg-transparent text-aurora-coral hover:bg-aurora-coral/10";

/** A button label that collapses to the icon alone on phones (the name stays for screen readers). */
function Label({ children }: { children: string }) {
  return <span className="max-sm:sr-only">{children}</span>;
}

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
      // Sticky in the main column, not fixed: it never covers the sidebar, and at the end of the
      // board it takes its own space, so the last card stays reachable.
      className="bg-note-graphite border-ink-inverse/10 rounded-card shadow-card-hover sticky bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 mx-auto mt-auto mb-4 flex w-fit max-w-[calc(100%-1.5rem)] flex-wrap items-center justify-center gap-1.5 border p-2"
    >
      <span role="status" className="text-body text-ink-inverse px-2 font-medium">
        {ids.length === 0 ? t.none : t.count(ids.length)}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className={QUIET}
        onClick={() => (allSelected ? clearSelection() : selectAll(itemIds))}
      >
        {allSelected ? t.deselectAll : t.selectAll}
      </Button>

      {view.type === "trash" ? (
        <>
          <Button
            variant="secondary"
            size="sm"
            className={ACTION}
            disabled={disabled}
            onClick={() => run({ type: "restore" })}
          >
            <Undo2Icon />
            <Label>{t.restore}</Label>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className={ACTION}
            disabled={disabled}
            onClick={() => run({ type: "archive" })}
          >
            <ArchiveIcon />
            <Label>{t.archive}</Label>
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className={DANGER}
            disabled={disabled}
            onClick={() => setConfirming(true)}
          >
            <Trash2Icon />
            <Label>{t.deleteForever}</Label>
          </Button>
        </>
      ) : view.type === "archive" ? (
        <>
          <Button
            variant="secondary"
            size="sm"
            className={ACTION}
            disabled={disabled}
            onClick={() => run({ type: "unarchive" })}
          >
            <ArchiveRestoreIcon />
            <Label>{t.restore}</Label>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className={ACTION}
            disabled={disabled}
            onClick={() => run({ type: "trash" })}
          >
            <Trash2Icon />
            <Label>{t.trash}</Label>
          </Button>
        </>
      ) : (
        <>
          <Button
            variant="secondary"
            size="sm"
            className={ACTION}
            disabled={disabled}
            onClick={() => setMoving(true)}
          >
            <FolderInputIcon />
            <Label>{t.moveTo}</Label>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className={ACTION}
            disabled={disabled}
            onClick={() => run({ type: "archive" })}
          >
            <ArchiveIcon />
            <Label>{t.archive}</Label>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className={ACTION}
            disabled={disabled}
            onClick={() => run({ type: "trash" })}
          >
            <Trash2Icon />
            <Label>{t.trash}</Label>
          </Button>
        </>
      )}

      <Button variant="ghost" size="sm" className={QUIET} onClick={() => setSelectMode(false)}>
        <XIcon />
        <Label>{t.done}</Label>
      </Button>

      <MoveDialog
        open={moving}
        onOpenChange={setMoving}
        count={ids.length}
        currentCollectionId={view.type === "collection" ? view.collectionId : null}
        onPick={(collectionId, label) => run({ type: "collection", id: collectionId }, label)}
      />
      <ResponsiveDialog open={confirming} onOpenChange={setConfirming}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{t.deleteForeverTitle(ids.length)}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>{t.deleteForeverBody}</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogFooter>
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
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}
