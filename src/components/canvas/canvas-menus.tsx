"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownToLineIcon,
  ArrowUpToLineIcon,
  FolderInputIcon,
  InboxIcon,
  StickyNoteIcon,
  SquareArrowOutUpRightIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { collectionsQueryOptions } from "@/lib/sidebar/queries";
import { createClient } from "@/lib/supabase/client";

/** Where a card can be moved: the Inbox (`id` null) or a collection. */
export type MoveTarget = { id: string | null; name: string };

/** Inbox first, then the collections in sidebar order. Empty until the list has loaded. */
export function useMoveTargets(enabled: boolean): MoveTarget[] {
  const { data } = useQuery({ ...collectionsQueryOptions(createClient()), enabled });
  if (!enabled) return [];
  return [
    { id: null, name: "Inbox" },
    ...(data ?? []).map((collection) => ({ id: collection.id, name: collection.name })),
  ];
}

/** What a right-click landed on. */
export type CanvasMenuTarget =
  { kind: "node"; id: string } | { kind: "pane"; at: { x: number; y: number } };

export type CanvasMenuActions = {
  onOpen: (id: string) => void;
  onMove: (target: MoveTarget) => void;
  onZOrder: (mode: "front" | "back") => void;
  onNewNote: (at: { x: number; y: number }) => void;
};

type ContextProps = CanvasMenuActions & {
  /** Set by the canvas just before the menu opens. */
  target: CanvasMenuTarget;
  targets: readonly MoveTarget[];
  /** The collection this canvas shows (null = Inbox): moving there is a no-op, so it is disabled. */
  currentId: string | null;
  /** One element that takes a ref, a `contextmenu` handler and a `style`: the canvas wrapper. */
  children: ReactNode;
};

/**
 * Right-click menus of the canvas: a card menu (open, move to a collection, layer order) and an
 * empty-space menu (new note here). The canvas sets `target` before the menu opens, from the card
 * that was right-clicked (and selected) or the flow point under the cursor.
 */
export function CanvasContextMenu({
  children,
  target,
  targets,
  currentId,
  onOpen,
  onMove,
  onZOrder,
  onNewNote,
}: ContextProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent
        aria-label="Canvas menu"
        className="w-52"
        // Focus stays where the action put it (e.g. the new note field).
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        {target.kind === "node" ? (
          <>
            <ContextMenuItem onSelect={() => onOpen(target.id)}>
              <SquareArrowOutUpRightIcon />
              Open
            </ContextMenuItem>
            {targets.length > 0 ? (
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <FolderInputIcon />
                  Move to…
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="max-h-72 w-48">
                  {targets.map((entry) => (
                    <ContextMenuItem
                      key={entry.id ?? "inbox"}
                      disabled={entry.id === currentId}
                      onSelect={() => onMove(entry)}
                    >
                      {entry.id === null ? <InboxIcon /> : null}
                      <span className="truncate">{entry.name}</span>
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>
            ) : null}
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={() => onZOrder("front")}>
              <ArrowUpToLineIcon />
              Bring to front
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => onZOrder("back")}>
              <ArrowDownToLineIcon />
              Send to back
            </ContextMenuItem>
            {/* WP 6.4: Copy, Duplicate and Paste entries go here, above the layer order group. */}
          </>
        ) : (
          <>
            <ContextMenuItem onSelect={() => onNewNote(target.at)}>
              <StickyNoteIcon />
              New note here
            </ContextMenuItem>
            {/* WP 6.4: Paste goes here. */}
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export type CanvasMoveMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Screen point the menu hangs from: the selection's bottom-left corner. */
  anchor: { x: number; y: number } | null;
  targets: readonly MoveTarget[];
  currentId: string | null;
  count: number;
  onMove: (target: MoveTarget) => void;
};

/**
 * The `M` shortcut's menu: a dropdown listing Inbox and the collections, anchored at the
 * selection. Arrow keys, Enter and Esc work as in any Radix menu.
 */
export function CanvasMoveMenu({
  open,
  onOpenChange,
  anchor,
  targets,
  currentId,
  count,
  onMove,
}: CanvasMoveMenuProps) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <span
          aria-hidden
          className="pointer-events-none fixed size-px"
          style={{ left: anchor?.x ?? 0, top: anchor?.y ?? 0 }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        onCloseAutoFocus={(event) => event.preventDefault()}
        align="start"
        aria-label="Move to"
        className="max-h-72 w-52"
      >
        <DropdownMenuLabel>
          {count === 1 ? "Move 1 item to" : `Move ${count} items to`}
        </DropdownMenuLabel>
        {targets.map((entry) => (
          <DropdownMenuItem
            key={entry.id ?? "inbox"}
            disabled={entry.id === currentId}
            onSelect={() => onMove(entry)}
          >
            {entry.id === null ? <InboxIcon /> : null}
            <span className="truncate">{entry.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
