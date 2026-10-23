"use client";

import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "motion/react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { itemDisplayTitle } from "@/components/cards/card-status";
import { useBoardDnd } from "@/components/dnd/board-dnd-provider";
import { KindIcon } from "@/components/kind-icon";
import { Button } from "@/components/ui/button";
import { focusRing } from "@/components/ui/focus-ring";
import { useT } from "@/i18n/client";
import { useSignedUrls } from "@/hooks/use-signed-urls";
import { auroraColorVar } from "@/lib/collections/fields";
import type { BoardItem } from "@/lib/items/queries";
import { createClient } from "@/lib/supabase/client";
import { collectionsQueryOptions, countsQueryOptions } from "@/lib/sidebar/queries";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { BoardCard, type CardDnd } from "./board-cards";

type FolderProps = {
  collectionId: string;
  /** Every loaded item of the collection, in the current sort. */
  items: readonly BoardItem[];
  expanded: boolean;
  onRetry?: (item: BoardItem) => void | Promise<void>;
  onOpen?: (item: BoardItem) => void;
  dnd?: CardDnd;
};

const PREVIEW_COUNT = 3;
const STRETCH_SPRING = { type: "spring", stiffness: 420, damping: 15, mass: 0.7 } as const;

/**
 * The collections whose folder is open. Ids of collections that no longer exist are dropped (and
 * pruned from the persisted list) once the collections have loaded.
 */
export function useExpandedCollections(): ReadonlySet<string> {
  const stored = useUiStore((state) => state.expandedCollections);
  const collections = useQuery(collectionsQueryOptions(createClient())).data;
  const existing = useMemo(
    () => (collections ? new Set(collections.map((row) => row.id)) : null),
    [collections],
  );
  const live = useMemo(
    () => (existing ? stored.filter((id) => existing.has(id)) : stored),
    [stored, existing],
  );
  useEffect(() => {
    if (live.length !== stored.length) useUiStore.setState({ expandedCollections: live });
  }, [live, stored]);
  return useMemo(() => new Set(live), [live]);
}

function useFolderInfo(collectionId: string, loaded: number) {
  const t = useT().shell;
  const collections = useQuery(collectionsQueryOptions(createClient()));
  const counts = useQuery(countsQueryOptions(createClient()));
  const collection = collections.data?.find((row) => row.id === collectionId);
  const total = counts.data?.collections[collectionId] ?? loaded;
  return {
    name: collection?.name ?? t.folder.defaultName,
    emoji: collection?.emoji ?? null,
    color: auroraColorVar(collection?.color),
    countLabel: t.itemCount(total),
  };
}

function FolderMark({ emoji, color }: { emoji: string | null; color: string | undefined }) {
  return emoji ? (
    <span aria-hidden="true" className="text-card leading-none">
      {emoji}
    </span>
  ) : (
    <span
      aria-hidden="true"
      className="bg-ink-subtle size-3 shrink-0 rounded-full"
      style={color ? { backgroundColor: color } : undefined}
    />
  );
}

/** The collection link, above the folder's main button (z-20) so it stays clickable. */
function OpenCollectionLink({ collectionId }: { collectionId: string }) {
  const t = useT().shell;
  return (
    <Link
      href={`/app/c/${collectionId}`}
      onClick={(event) => event.stopPropagation()}
      className={cn(
        "text-meta text-ink-muted hover:text-ink rounded-control relative z-20 underline underline-offset-2",
        focusRing,
      )}
    >
      {t.folder.openCollection}
    </Link>
  );
}

/** A closed folder: a card-sized tile with two offset layers behind it, like a pile. */
function StackTile({
  collectionId,
  items,
  onToggle,
  focusOnMount,
}: Pick<FolderProps, "collectionId" | "items"> & { onToggle: () => void; focusOnMount: boolean }) {
  const t = useT().shell;
  const { name, emoji, color, countLabel } = useFolderInfo(collectionId, items.length);
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focusOnMount) buttonRef.current?.focus();
  }, [focusOnMount]);
  return (
    <div className="relative isolate h-full pb-3">
      <div
        aria-hidden="true"
        className="rounded-card border-line bg-surface shadow-card absolute inset-x-4 top-4 bottom-0 -z-20 border opacity-60"
      />
      <div
        aria-hidden="true"
        className="rounded-card border-line bg-surface shadow-card absolute inset-x-2 top-2 bottom-1.5 -z-10 border opacity-80"
      />
      <div
        data-slot="collection-folder"
        data-collection-id={collectionId}
        className="group rounded-card border-line shadow-card bg-surface relative flex h-full min-h-32 flex-col gap-2 border p-4 backdrop-blur-md"
      >
        <div className="flex items-center gap-2">
          <FolderMark emoji={emoji} color={color} />
          <span className="text-card text-ink min-w-0 flex-1 truncate font-medium">{name}</span>
          <span className="text-meta text-ink-subtle shrink-0">{countLabel}</span>
        </div>
        <ul className="text-meta text-ink-muted flex min-w-0 flex-col gap-1">
          {items.slice(0, PREVIEW_COUNT).map((item) => (
            <li key={item.id} className="flex min-w-0 items-center gap-1.5">
              <KindIcon kind={item.kind} className="text-ink-subtle size-3.5 shrink-0" />
              <span className="truncate">
                {itemDisplayTitle(item, t.card).replace(/\s+/g, " ")}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-auto flex justify-end">
          <OpenCollectionLink collectionId={collectionId} />
        </div>
        <button
          ref={buttonRef}
          type="button"
          aria-expanded={false}
          aria-label={t.folder.openFolder(name, countLabel)}
          onClick={onToggle}
          className="rounded-card absolute inset-0 z-10 cursor-pointer"
        />
      </div>
    </div>
  );
}

/** An open folder's header: the name, "Collapse" and the link to the collection. */
function FolderChip({
  collectionId,
  items,
  onToggle,
  focusOnMount,
}: Pick<FolderProps, "collectionId" | "items"> & { onToggle: () => void; focusOnMount: boolean }) {
  const t = useT().shell;
  const { name, emoji, color, countLabel } = useFolderInfo(collectionId, items.length);
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focusOnMount) buttonRef.current?.focus();
  }, [focusOnMount]);
  return (
    <div
      data-slot="collection-folder-header"
      data-collection-id={collectionId}
      className="rounded-card border-line shadow-card bg-surface flex flex-wrap items-center gap-x-3 gap-y-1 border px-4 py-3"
    >
      <FolderMark emoji={emoji} color={color} />
      <span className="text-card text-ink min-w-0 flex-1 truncate font-medium">{name}</span>
      <span className="text-meta text-ink-subtle">{countLabel}</span>
      <OpenCollectionLink collectionId={collectionId} />
      <Button
        ref={buttonRef}
        variant="secondary"
        size="sm"
        aria-expanded={true}
        aria-label={t.folder.collapseFolder(name)}
        onClick={onToggle}
      >
        {t.folder.collapse}
      </Button>
    </div>
  );
}

/** The cards of an open folder: they stretch out of the header, and squeeze back on collapse. */
function FolderCards({
  items,
  dnd,
  onRetry,
  onOpen,
  animateIn,
}: Pick<FolderProps, "items" | "dnd" | "onRetry" | "onOpen"> & { animateIn: boolean }) {
  const reduced = useReducedMotion() ?? false;
  const dragging = useBoardDnd()?.dragging ?? false;
  const signedUrls = useSignedUrls(items.map((item) => item.thumbnail_path));
  const last = items.length - 1;

  return (
    <>
      {items.map((item, index) => {
        const instant = dragging ? ({ duration: 0 } satisfies Transition) : null;
        const enter: Transition =
          instant ??
          (reduced
            ? { duration: 0.15 }
            : { ...STRETCH_SPRING, delay: 0.08 + Math.min(index, 8) * 0.04 });
        const leave: Transition =
          instant ??
          (reduced
            ? { duration: 0.12 }
            : { duration: 0.2, ease: "easeIn", delay: Math.min(last - index, 8) * 0.025 });
        return (
          <BoardCard
            key={item.id}
            dnd={dnd}
            item={item}
            variant="grid"
            thumbnailUrl={item.thumbnail_path ? signedUrls.get(item.thumbnail_path) : null}
            onRetry={onRetry}
            onOpen={onOpen}
            liMotion={{
              style: { transformOrigin: "50% 0%" },
              initial: !animateIn
                ? false
                : reduced
                  ? { opacity: 0 }
                  : { opacity: 0, scaleX: 0.55, scaleY: 0.15, y: -24 },
              animate: { opacity: 1, scaleX: 1, scaleY: 1, y: 0, transition: enter },
              exit: reduced
                ? { opacity: 0, transition: leave }
                : { opacity: 0, scaleX: 0.6, scaleY: 0.1, y: -24, transition: leave },
            }}
          />
        );
      })}
    </>
  );
}

/**
 * One collection in the All grid: a stack tile while closed, a header plus its cards while open.
 * Renders grid items (`li`) directly into the surrounding grid.
 */
export function CollectionFolder({ collectionId, items, expanded, ...cards }: FolderProps) {
  const reduced = useReducedMotion() ?? false;
  const toggle = useUiStore((state) => state.toggleCollectionExpanded);
  // Animation and focus follow the user's own toggles, not a restored (rehydrated) open state.
  const [userToggled, setUserToggled] = useState(false);
  const onToggle = useCallback(() => {
    setUserToggled(true);
    if (expanded) {
      // Cards that are about to hide must not stay selected.
      const hidden = new Set(items.map((item) => item.id));
      useUiStore.setState((state) =>
        state.selectedIds.some((id) => hidden.has(id))
          ? { selectedIds: state.selectedIds.filter((id) => !hidden.has(id)) }
          : state,
      );
    }
    toggle(collectionId);
  }, [expanded, items, toggle, collectionId]);

  return (
    <>
      <li className={cn("list-none", expanded && "self-start")}>
        <div data-stack-card="" className="h-full">
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={expanded ? "header" : "stack"}
              className="h-full"
              initial={
                userToggled ? (reduced ? { opacity: 0 } : { opacity: 0, scale: 0.94 }) : false
              }
              animate={{
                opacity: 1,
                scale: 1,
                transition: { duration: 0.16, delay: expanded ? 0 : 0.1 },
              }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}
            >
              {expanded ? (
                <FolderChip
                  collectionId={collectionId}
                  items={items}
                  onToggle={onToggle}
                  focusOnMount={userToggled}
                />
              ) : (
                <StackTile
                  collectionId={collectionId}
                  items={items}
                  onToggle={onToggle}
                  focusOnMount={userToggled}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </li>
      <AnimatePresence initial={false}>
        {expanded ? (
          <FolderCards key="cards" items={items} animateIn={userToggled} {...cards} />
        ) : null}
      </AnimatePresence>
    </>
  );
}
