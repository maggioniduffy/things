"use client";

import {
  ArrowDownToLineIcon,
  ArrowUpToLineIcon,
  ClipboardPasteIcon,
  CopyIcon,
  CopyPlusIcon,
  FolderInputIcon,
  InboxIcon,
  PaletteIcon,
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
import { useT } from "@/i18n/client";
import type { CanvasTarget } from "@/lib/canvas/layout";
import {
  DEFAULT_NOTE_STYLE,
  NOTE_COLORS,
  NOTE_COLOR_STYLES,
  type NoteColor,
} from "@/lib/items/note-colors";
import { cn } from "@/lib/utils";
import { useCollectionList } from "./move-dialog";

/** What a right-click landed on. `null` = something with its own behavior (controls, minimap). */
export type MenuTarget = { type: "node"; id: string } | { type: "pane"; point: CanvasTarget };

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
  /** Present when notes can be recolored (persisted canvases); null = the default look. */
  onColor?: (color: NoteColor | null) => void;
  /** Whether the node with this id is a note; the Color submenu shows only for notes. */
  isNote?: (id: string) => boolean;
  onBringToFront: () => void;
  onSendToBack: () => void;
  /** Present when notes can be created (persisted canvases). */
  onNewNote?: (point: CanvasTarget) => void;
  /** Present when copying is possible (persisted canvases). */
  onCopy?: () => void;
  onDuplicate?: () => void;
  /** Pastes the in-app clipboard at `point`, or at the viewport center without one. */
  onPaste?: (point?: CanvasTarget) => void;
  /** False while the in-app clipboard is empty. */
  canPaste?: boolean;
};

const DEFAULT_SWATCH = DEFAULT_NOTE_STYLE.swatchClassName;

function ColorDot({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("border-line size-4 shrink-0 rounded-full border", className)}
    />
  );
}

/** The node and pane context menus of the canvas. Wraps the flow; React Flow keeps its own events. */
export function CanvasMenu({
  children,
  resolveTarget,
  selectionSize,
  collectionId,
  onOpen,
  onMoveTo,
  onColor,
  isNote,
  onBringToFront,
  onSendToBack,
  onNewNote,
  onCopy,
  onDuplicate,
  onPaste,
  canPaste = false,
}: CanvasMenuProps) {
  const t = useT().items;
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
                {t.canvas.open}
              </ContextMenuItem>
            ) : null}
            {onMoveTo ? (
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <FolderInputIcon aria-hidden="true" />
                  {t.canvas.moveTo}
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="max-h-72 w-52 overflow-y-auto">
                  <ContextMenuItem
                    disabled={collectionId === null}
                    onSelect={() => onMoveTo(null, t.inbox)}
                  >
                    <InboxIcon aria-hidden="true" />
                    {t.inbox}
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
            {onColor && isNote?.(target.id) ? (
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  <PaletteIcon aria-hidden="true" />
                  {t.canvas.color}
                </ContextMenuSubTrigger>
                <ContextMenuSubContent className="w-44">
                  <ContextMenuItem onSelect={() => onColor(null)}>
                    <ColorDot className={DEFAULT_SWATCH} />
                    {t.noteColors.default}
                  </ContextMenuItem>
                  {NOTE_COLORS.map((color) => (
                    <ContextMenuItem key={color} onSelect={() => onColor(color)}>
                      <ColorDot className={NOTE_COLOR_STYLES[color].swatchClassName} />
                      {t.noteColors[color]}
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>
            ) : null}
            {onCopy ? (
              <ContextMenuItem onSelect={onCopy}>
                <CopyIcon aria-hidden="true" />
                {t.canvas.copy}
                <ContextMenuShortcut>⌘C</ContextMenuShortcut>
              </ContextMenuItem>
            ) : null}
            {onDuplicate ? (
              <ContextMenuItem onSelect={onDuplicate}>
                <CopyPlusIcon aria-hidden="true" />
                {t.canvas.duplicate}
                <ContextMenuShortcut>⌘D</ContextMenuShortcut>
              </ContextMenuItem>
            ) : null}
            {onPaste ? (
              <ContextMenuItem disabled={!canPaste} onSelect={() => onPaste()}>
                <ClipboardPasteIcon aria-hidden="true" />
                {t.canvas.paste}
                <ContextMenuShortcut>⌘V</ContextMenuShortcut>
              </ContextMenuItem>
            ) : null}
            <ContextMenuItem onSelect={onBringToFront}>
              <ArrowUpToLineIcon aria-hidden="true" />
              {t.canvas.bringToFront}
              <ContextMenuShortcut>]</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem onSelect={onSendToBack}>
              <ArrowDownToLineIcon aria-hidden="true" />
              {t.canvas.sendToBack}
              <ContextMenuShortcut>[</ContextMenuShortcut>
            </ContextMenuItem>
            {selectionSize > 1 ? (
              <p className="text-meta text-ink-subtle px-2 py-1.5" aria-hidden="true">
                {t.canvas.appliesTo(selectionSize)}
              </p>
            ) : null}
          </>
        ) : target?.type === "pane" && onNewNote ? (
          <>
            <ContextMenuItem onSelect={() => onNewNote(target.point)}>
              <PlusIcon aria-hidden="true" />
              {t.canvas.newNoteHere}
            </ContextMenuItem>
            {onPaste ? (
              <ContextMenuItem disabled={!canPaste} onSelect={() => onPaste(target.point)}>
                <ClipboardPasteIcon aria-hidden="true" />
                {t.canvas.paste}
                <ContextMenuShortcut>⌘V</ContextMenuShortcut>
              </ContextMenuItem>
            ) : null}
          </>
        ) : null}
      </ContextMenuContent>
    </ContextMenu>
  );
}
