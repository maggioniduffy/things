"use client";

import {
  ArrowDownToLineIcon,
  ArrowUpToLineIcon,
  FolderInputIcon,
  InboxIcon,
  PlusIcon,
  SquareArrowOutUpRightIcon,
} from "lucide-react";
import { useState, type MouseEvent, type ReactNode } from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { Point } from "@/lib/canvas/layout";
import { useCollectionList } from "./move-dialog";

/** What a right-click landed on. `null` = something with its own behavior (controls, minimap). */
export type MenuTarget = { type: "node"; id: string } | { type: "pane"; point: Point };

type CanvasMenuProps = {
  children: ReactNode;
  /**
   * Called on every right-click before the menu opens. Selects the node under the pointer when it
   * is not selected yet. Returns what was hit, or null to leave the click alone.
   */
  resolveTarget: (event: MouseEvent) => MenuTarget | null;
  /** How many cards the menu's actions apply to for a node target. */
  selectionSize: number;
  /** The collection of this canvas (null = Inbox). */
  collectionId: string | null;
  onOpen?: (id: string) => void;
  /** Present when moving is possible (persisted canvases). */
  onMoveTo?: (collectionId: string | null, label: string) => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  /** Present when notes can be created (persisted canvases). */
  onNewNote?: (point: Point) => void;
};

/** The node and pane context menus of the canvas. Wraps the flow; React Flow keeps its own events. */
export function CanvasMenu({
  children,
  resolveTarget,
  selectionSize,
  collectionId,
  onOpen,
  onMoveTo,
  onBringToFront,
  onSendToBack,
  onNewNote,
}: CanvasMenuProps) {
  const [target, setTarget] = useState<MenuTarget | null>(null);
  const collections = useCollectionList();

  function onContextMenuCapture(event: MouseEvent) {
    const next = resolveTarget(event);
    if (!next || (next.type === "pane" && !onNewNote)) {
      // Not ours: keep Radix from opening the menu.
      event.stopPropagation();
      setTarget(null);
      return;
    }
    setTarget(next);
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="h-full w-full" onContextMenuCapture={onContextMenuCapture}>
          {children}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {target?.type === "node" ? (
          <>
            {onOpen ? (
              <ContextMenuItem onSelect={() => onOpen(target.id)}>
                <SquareArrowOutUpRightIcon aria-hidden="true" />
                Open
              </ContextMenuItem>
            ) : null}
            {onMoveTo ? (
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <FolderInputIcon aria-hidden="true" />
                  Move to…
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="max-h-72 w-52 overflow-y-auto">
                  <ContextMenuItem
                    disabled={collectionId === null}
                    onSelect={() => onMoveTo(null, "Inbox")}
                  >
                    <InboxIcon aria-hidden="true" />
                    Inbox
                  </ContextMenuItem>
                  {collections.map((collection) => (
                    <ContextMenuItem
                      key={collection.id}
                      disabled={collection.id === collectionId}
                      onSelect={() => onMoveTo(collection.id, collection.name)}
                    >
                      <span aria-hidden="true" className="w-4 text-center">
                        {collection.emoji ?? ""}
                      </span>
                      {collection.name}
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>
            ) : null}
            <ContextMenuItem onSelect={onBringToFront}>
              <ArrowUpToLineIcon aria-hidden="true" />
              Bring to front
              <ContextMenuShortcut>]</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onSelect={onSendToBack}>
              <ArrowDownToLineIcon aria-hidden="true" />
              Send to back
              <ContextMenuShortcut>[</ContextMenuShortcut>
            </ContextMenuItem>
            {selectionSize > 1 ? (
              <p className="text-meta text-ink-subtle px-2 py-1.5" aria-hidden="true">
                Applies to {selectionSize} selected items
              </p>
            ) : null}
          </>
        ) : target?.type === "pane" && onNewNote ? (
          <ContextMenuItem onSelect={() => onNewNote(target.point)}>
            <PlusIcon aria-hidden="true" />
            New note here
          </ContextMenuItem>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
  );
}
