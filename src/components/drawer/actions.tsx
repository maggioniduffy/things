"use client";

import { ArchiveIcon, ArchiveRestoreIcon, StarIcon, Trash2Icon, Undo2Icon } from "lucide-react";
import { useState } from "react";
import { itemDisplayTitle } from "@/components/cards/card-status";
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
  const t = useT().items.drawer;
  const card = useT().shell.card;
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
        {item.is_favorite ? t.unfavorite : t.favorite}
      </Button>

      {!trashed ? (
        archived ? (
          <Button variant="secondary" size="sm" onClick={() => leave(actions.unarchive(item))}>
            <ArchiveRestoreIcon />
            {t.unarchive}
          </Button>
        ) : (
          <Button variant="secondary" size="sm" onClick={() => leave(actions.archive(item))}>
            <ArchiveIcon />
            {t.archive}
          </Button>
        )
      ) : null}

      {trashed ? (
        <Button variant="secondary" size="sm" onClick={() => leave(actions.restore(item))}>
          <Undo2Icon />
          {t.restore}
        </Button>
      ) : (
        <Button variant="destructive" size="sm" onClick={() => leave(actions.trash(item))}>
          <Trash2Icon />
          {t.moveToTrash}
        </Button>
      )}

      {trashed && view.type === "trash" ? (
        <>
          <Button variant="destructive" size="sm" onClick={() => setConfirming(true)}>
            {t.deleteForever}
          </Button>
          <ResponsiveDialog open={confirming} onOpenChange={setConfirming}>
            <ResponsiveDialogContent>
              <ResponsiveDialogHeader>
                <ResponsiveDialogTitle>{t.deleteForeverTitle}</ResponsiveDialogTitle>
                <ResponsiveDialogDescription>
                  {t.deleteForeverBody(itemDisplayTitle(item, card))}
                </ResponsiveDialogDescription>
              </ResponsiveDialogHeader>
              <ResponsiveDialogFooter>
                <Button variant="secondary" onClick={() => setConfirming(false)}>
                  {t.cancel}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setConfirming(false);
                    leave(actions.deleteForever(item));
                  }}
                >
                  {t.deleteForever}
                </Button>
              </ResponsiveDialogFooter>
            </ResponsiveDialogContent>
          </ResponsiveDialog>
        </>
      ) : null}
    </div>
  );
}
