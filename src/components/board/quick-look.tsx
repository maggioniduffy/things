"use client";

import { type KeyboardEvent } from "react";
import { KindIcon } from "@/components/kind-icon";
import { itemDisplayTitle } from "@/components/cards/card-status";
import { useOpenItem } from "@/components/drawer/item-param";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSignedUrls } from "@/hooks/use-signed-urls";
import { moveCursor } from "@/hooks/use-shortcuts";
import { useT } from "@/i18n/client";
import type { BoardItem } from "@/lib/items/queries";
import { useUiStore } from "@/stores/ui-store";

const NOTE_EXCERPT_MAX = 400;

/**
 * Space on a board card: a centered preview of the highlighted item. Space or Escape closes it,
 * J/K and the arrows move the highlight (the preview follows), Enter closes it and opens the
 * drawer. `items` are the cards on screen.
 */
export function QuickLook({ items }: { items: readonly BoardItem[] }) {
  const t = useT();
  const copy = t.items.shortcuts;
  const dialog = useUiStore((state) => state.shortcutDialog);
  const cursorId = useUiStore((state) => state.cursorId);
  const setShortcutDialog = useUiStore((state) => state.setShortcutDialog);
  const openItem = useOpenItem();
  const open = dialog === "quick-look";
  const item = items.find((candidate) => candidate.id === cursorId) ?? null;
  const signed = useSignedUrls([open ? item?.thumbnail_path : null]);

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
    switch (event.key) {
      case " ":
        event.preventDefault();
        setShortcutDialog(null);
        return;
      case "j":
      case "ArrowDown":
      case "ArrowRight":
        event.preventDefault();
        moveCursor(1);
        return;
      case "k":
      case "ArrowUp":
      case "ArrowLeft":
        event.preventDefault();
        moveCursor(-1);
        return;
      case "Enter":
        event.preventDefault();
        setShortcutDialog(null);
        if (item) openItem(item);
        return;
    }
  }

  const image = item
    ? ((item.thumbnail_path ? signed.get(item.thumbnail_path) : null) ?? item.image_url)
    : null;
  const title = item ? itemDisplayTitle(item, t.shell.card) : copy.quickLookTitle;
  const note = item?.note?.trim() ?? "";
  const excerpt =
    note.length > NOTE_EXCERPT_MAX ? `${note.slice(0, NOTE_EXCERPT_MAX).trimEnd()}…` : note;
  const source = item?.domain ?? item?.url ?? null;

  return (
    <Dialog open={open} onOpenChange={(next) => setShortcutDialog(next ? "quick-look" : null)}>
      <DialogContent
        showCloseButton={false}
        aria-describedby="quick-look-description"
        onKeyDown={onKeyDown}
        className="sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle className="text-section line-clamp-2 break-words">{title}</DialogTitle>
          <DialogDescription id="quick-look-description" className="sr-only">
            {copy.quickLookDescription}
          </DialogDescription>
        </DialogHeader>
        {item ? (
          <div className="flex flex-col gap-3">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element -- signed storage or remote URL
              <img
                src={image}
                alt=""
                className="rounded-control bg-paper max-h-[50dvh] w-full object-contain"
              />
            ) : (
              <div className="rounded-control bg-paper text-ink-subtle flex h-32 items-center justify-center">
                <KindIcon kind={item.kind} className="size-8" />
              </div>
            )}
            {source ? <p className="text-meta text-ink-subtle truncate">{source}</p> : null}
            {excerpt ? (
              <p className="text-body text-ink-muted line-clamp-6 whitespace-pre-wrap">{excerpt}</p>
            ) : null}
          </div>
        ) : (
          <p className="text-body text-ink-muted">{copy.quickLookEmpty}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
