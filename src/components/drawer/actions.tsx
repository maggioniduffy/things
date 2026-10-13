"use client";

import { ArchiveIcon, ArchiveRestoreIcon, StarIcon, Trash2Icon, Undo2Icon } from "lucide-react";
import { useState } from "react";
import { itemDisplayTitle } from "@/components/cards/card-status";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { BoardItem } from "@/lib/items/queries";
import type { ItemActions } from "@/lib/items/state-mutations";
import type { ViewSpec } from "@/lib/views";

type ItemActionBarProps = {
  item: BoardItem;
  view: ViewSpec;
  actions: ItemActions;
  /** Called after an action that takes the item out of the current view. */
  onClose: () => void;
};

/** Favorite, archive, trash / restore, and (only in the Trash view) delete forever. */
export function ItemActionBar({ item, view, actions, onClose }: ItemActionBarProps) {
  const [confirming, setConfirming] = useState(false);
  const trashed = item.deleted_at !== null;
  const archived = item.archived_at !== null;

  // The mutation applies its change to the caches first thing; closing does not wait for the network.
  function leave(action: Promise<void>) {
    void action;
    onClose();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        aria-pressed={item.is_favorite}
        onClick={() => void actions.toggleFavorite(item)}
      >
        <StarIcon className={item.is_favorite ? "fill-current" : undefined} />
        {item.is_favorite ? "Unfavorite" : "Favorite"}
      </Button>

      {!trashed ? (
        archived ? (
          <Button variant="secondary" size="sm" onClick={() => leave(actions.unarchive(item))}>
            <ArchiveRestoreIcon />
            Unarchive
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => leave(actions.archive(item))}>
            <ArchiveIcon />
            Archive
          </Button>
        )
      ) : null}

      {trashed ? (
        <Button variant="secondary" size="sm" onClick={() => leave(actions.restore(item))}>
          <Undo2Icon />
          Restore
        </Button>
      ) : (
        <Button variant="destructive" size="sm" onClick={() => leave(actions.trash(item))}>
          <Trash2Icon />
          Move to trash
        </Button>
      )}

      {trashed && view.type === "trash" ? (
        <>
          <Button variant="destructive" size="sm" onClick={() => setConfirming(true)}>
            Delete forever
          </Button>
          <Dialog open={confirming} onOpenChange={setConfirming}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete forever?</DialogTitle>
                <DialogDescription>
                  &ldquo;{itemDisplayTitle(item)}&rdquo; and its file will be permanently deleted.
                  This can&apos;t be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setConfirming(false);
                    leave(actions.deleteForever(item));
                  }}
                >
                  Delete forever
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </div>
  );
}
