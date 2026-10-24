"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useBoardDnd } from "@/components/dnd/board-dnd-provider";
import { useOpenItem } from "@/components/drawer/item-param";
import { isDialogOpen, isEditableElement } from "@/components/capture/paste-listener";
import { useBatchMove } from "@/lib/items/batch-mutations";
import { findCachedItem } from "@/lib/items/cache";
import { useItemActions } from "@/lib/items/state-mutations";
import { boardShortcut, CHORD_TIMEOUT_MS, type BoardAction } from "@/lib/shortcuts";
import { viewHref } from "@/lib/views";
import { useUiStore } from "@/stores/ui-store";

const CARD = "[data-item-id]";
// Enter and Space belong to a focused control: they press it.
const PRESSABLE = 'button, a[href], summary, [role="button"], [role="tab"], [role="checkbox"]';

function cardIds(): string[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(CARD),
    (node) => node.dataset.itemId ?? "",
  );
}

/**
 * Moves the keyboard cursor `step` cards along the screen order (read from the DOM), starting at
 * the first card when there is none, and scrolls it into view. Stops at both ends.
 */
export function moveCursor(step: 1 | -1): void {
  const ids = cardIds().filter(Boolean);
  if (ids.length === 0) return;
  const { cursorId, setCursor } = useUiStore.getState();
  const at = cursorId === null ? -1 : ids.indexOf(cursorId);
  const next = at === -1 ? 0 : Math.min(ids.length - 1, Math.max(0, at + step));
  const id = ids[next];
  if (!id) return;
  setCursor(id);
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  document
    .querySelector<HTMLElement>(`[data-item-id="${CSS.escape(id)}"]`)
    ?.scrollIntoView?.({ block: "nearest", behavior: reduced ? "auto" : "smooth" });
}

/** The selection (what is on screen of it), else the cursor card, else nothing. */
function targetIds(): string[] {
  const { selectedIds, cursorId } = useUiStore.getState();
  if (selectedIds.length > 0) {
    const shown = new Set(cardIds());
    const ids = selectedIds.filter((id) => shown.has(id));
    if (ids.length > 0) return ids;
  }
  return cursorId ? [cursorId] : [];
}

const BOARD_ACTIONS: ReadonlySet<BoardAction> = new Set([
  "next",
  "prev",
  "open",
  "quick-look",
  "favorite",
  "archive",
  "trash",
  "move",
  "tag",
]);

/**
 * The app-wide board keys (see `boardShortcut`): ⌘K, "/", J/K, Enter, Space, F, E, ⌫, M, T and the
 * "G then I / A / F" chord. Mount once inside the app shell. Plain keys step aside for text
 * fields, open dialogs and menus, and drags; ⌘K works from anywhere. Board keys do nothing where
 * there is no board of cards (the canvas keeps its own table).
 */
export function useShortcuts(): void {
  const router = useRouter();
  const queryClient = useQueryClient();
  const dnd = useBoardDnd();
  const move = useBatchMove();
  const actions = useItemActions();
  const openItem = useOpenItem();

  // The listener is attached once; it reads the latest handlers through this ref.
  const latest = useRef({ router, queryClient, dnd, move, actions, openItem });
  useEffect(() => {
    latest.current = { router, queryClient, dnd, move, actions, openItem };
  });

  useEffect(() => {
    let pendingG = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const endChord = () => {
      pendingG = false;
      clearTimeout(timer);
    };

    function run(action: BoardAction) {
      const { router, queryClient, move, actions, openItem } = latest.current;
      const ui = useUiStore.getState();
      switch (action) {
        case "go-inbox":
          return router.push(viewHref({ type: "inbox" }));
        case "go-all":
          return router.push(viewHref({ type: "all" }));
        case "go-favorites":
          return router.push(viewHref({ type: "favorites" }));
        case "next":
          return moveCursor(1);
        case "prev":
          return moveCursor(-1);
        case "open": {
          const item = ui.cursorId ? findCachedItem(queryClient, ui.cursorId) : null;
          return item ? openItem(item) : undefined;
        }
        case "quick-look":
          return ui.cursorId ? ui.setShortcutDialog("quick-look") : undefined;
        case "move":
          return targetIds().length > 0 ? ui.setShortcutDialog("move") : undefined;
        case "tag":
          return targetIds().length > 0 ? ui.setShortcutDialog("tag") : undefined;
        case "favorite":
        case "archive":
        case "trash": {
          const ids = targetIds();
          if (ids.length === 0) return;
          const items = ids.flatMap((id) => findCachedItem(queryClient, id) ?? []);
          if (ids.length === 1) {
            const item = items[0];
            if (!item) return;
            if (action === "favorite") return void actions.toggleFavorite(item);
            if (action === "trash") return void actions.trash(item);
            return void (item.archived_at ? actions.unarchive(item) : actions.archive(item));
          }
          const done = (saved: boolean) => saved && useUiStore.getState().clearSelection();
          if (action === "favorite") {
            // A batch can only set the flag; when everything already has it, toggle each off.
            if (items.length > 0 && items.every((item) => item.is_favorite)) {
              return void Promise.all(items.map((item) => actions.toggleFavorite(item)));
            }
            return void move(ids, { type: "favorite" }).then(done);
          }
          return void move(ids, { type: action }).then(done);
        }
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      const action = boardShortcut(event, { pendingG });
      if (!action) return;

      if (action === "palette") {
        // ⌘K is the one key that also works from a field or a dialog.
        endChord();
        event.preventDefault();
        const { paletteOpen, setPaletteOpen } = useUiStore.getState();
        setPaletteOpen(!paletteOpen);
        return;
      }

      const target = event.target instanceof Element ? event.target : null;
      if (
        isEditableElement(target) ||
        isEditableElement(document.activeElement) ||
        isDialogOpen() ||
        document.querySelector('[role="menu"]') ||
        latest.current.dnd?.isDragActive()
      ) {
        endChord();
        return;
      }

      if (action === "cancel") {
        endChord();
        event.preventDefault();
        return;
      }
      if (action === "chord") {
        endChord();
        pendingG = true;
        timer = setTimeout(endChord, CHORD_TIMEOUT_MS);
        event.preventDefault();
        return;
      }
      endChord();

      if (action === "focus-search") {
        const field = document.querySelector<HTMLElement>("[data-search-input]");
        if (!field) return;
        event.preventDefault();
        field.focus();
        return;
      }

      if (BOARD_ACTIONS.has(action)) {
        // No cards on screen (settings, canvas, empty view): nothing for these keys to act on.
        if (document.querySelector('[data-view-mode="canvas"]') || !document.querySelector(CARD)) {
          return;
        }
        if ((action === "open" || action === "quick-look") && target?.closest(PRESSABLE)) return;
      }

      event.preventDefault();
      run(action);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      clearTimeout(timer);
    };
  }, []);
}

/** Mounts `useShortcuts` once in the app shell; renders nothing. */
export function ShortcutsHost(): null {
  useShortcuts();
  return null;
}
