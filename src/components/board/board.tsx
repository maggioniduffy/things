"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, type MouseEvent } from "react";
import { useBoardDnd } from "@/components/dnd/board-dnd-provider";
import { MoveDialog } from "@/components/canvas/move-dialog";
import { useOpenItem } from "@/components/drawer/item-param";
import { ItemDrawerHost } from "@/components/drawer/item-drawer";
import { ExternalDropZone } from "@/components/capture/external-drop-zone";
import { PasteListener } from "@/components/capture/paste-listener";
import { QuickAdd } from "@/components/capture/quick-add";
import { CanvasView } from "@/components/canvas/canvas-view";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/client";
import { useBatchMove } from "@/lib/items/batch-mutations";
import type { BoardItem } from "@/lib/items/queries";
import { useRetryEnrich } from "@/lib/items/mutations";
import { itemsInfiniteQueryOptions } from "@/lib/items/queries";
import { parseSearchParams, searchParamsHref } from "@/lib/search-params";
import { createClient } from "@/lib/supabase/client";
import { viewKey, type SortMode, type ViewSpec } from "@/lib/views";
import { useUiStore } from "@/stores/ui-store";
import { BoardSkeleton, ToolbarPlaceholder } from "./board-skeleton";
import { EmptyState } from "./empty-state";
import { FilterChips } from "./filter-chips";
import type { CardDnd } from "./board-cards";
import { ItemGrid } from "./item-grid";
import { ItemList } from "./item-list";
import { QuickLook } from "./quick-look";
import { SelectionBar } from "./selection-bar";
import { SortableItems } from "./sortable-items";
import { TagPickerDialog } from "./tag-picker-dialog";
import { Toolbar, useEffectiveViewMode, useViewInfo } from "./toolbar";

/** The dialogs the M, T and Space keys open (see `useShortcuts`). */
function ShortcutDialogs({ view, items }: { view: ViewSpec; items: readonly BoardItem[] }) {
  const dialog = useUiStore((state) => state.shortcutDialog);
  const setDialog = useUiStore((state) => state.setShortcutDialog);
  const selectedIds = useUiStore((state) => state.selectedIds);
  const cursorId = useUiStore((state) => state.cursorId);
  const clearSelection = useUiStore((state) => state.clearSelection);
  const move = useBatchMove();

  // Same target rule as the keys: the selection that is on screen, else the cursor card.
  const loaded = new Set(items.map((item) => item.id));
  const selected = selectedIds.filter((id) => loaded.has(id));
  const ids = selected.length > 0 ? selected : cursorId && loaded.has(cursorId) ? [cursorId] : [];

  return (
    <>
      {/* Mounted only while open: each one runs its own query. */}
      {dialog === "move" ? (
        <MoveDialog
          open
          onOpenChange={(open) => setDialog(open ? "move" : null)}
          count={ids.length}
          currentCollectionId={view.type === "collection" ? view.collectionId : null}
          onPick={(collectionId, label) =>
            void move(ids, { type: "collection", id: collectionId }, label).then((saved) => {
              if (saved) clearSelection();
            })
          }
        />
      ) : null}
      {dialog === "tag" ? (
        <TagPickerDialog open onOpenChange={(open) => setDialog(open ? "tag" : null)} ids={ids} />
      ) : null}
      <QuickLook items={items} />
    </>
  );
}

type BoardProps = { view: ViewSpec; sort: SortMode };

export function Board({ view, sort }: BoardProps) {
  const shell = useT().shell;
  const t = shell.board;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paramString = searchParams.toString();
  // `q` and the filter chips live in the URL; the plain view shows when there are none.
  const search = useMemo(() => parseSearchParams(new URLSearchParams(paramString)), [paramString]);
  const searching = search !== null;
  const currentViewKey = viewKey(view);
  const query = useInfiniteQuery({
    ...itemsInfiniteQueryOptions(createClient(), view, sort, search),
    // Keep the previous results on screen while the next search loads, but only inside one view.
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === currentViewKey ? previous : undefined,
  });
  const info = useViewInfo(view);
  const viewMode = useEffectiveViewMode(view);
  const clearSelection = useUiStore((state) => state.clearSelection);
  const setCursor = useUiStore((state) => state.setCursor);
  const setShortcutDialog = useUiStore((state) => state.setShortcutDialog);

  useEffect(() => {
    clearSelection();
    setCursor(null);
    setShortcutDialog(null);
  }, [currentViewKey, clearSelection, setCursor, setShortcutDialog]);

  const boardDnd = useBoardDnd();
  const wasJustDragged = boardDnd?.wasJustDragged;
  const isDragActive = boardDnd?.isDragActive;

  // Escape clears the selection, unless it belongs to something else: a drag being cancelled, an
  // open dialog or drawer, or a text field. Capture phase, so this runs before a Radix dialog's own
  // capture listener (attached later) has closed it and taken it out of the DOM.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const { selectedIds, cursorId } = useUiStore.getState();
      if (selectedIds.length === 0 && cursorId === null) return;
      if (isDragActive?.() || wasJustDragged?.()) return;
      if (document.querySelector('[role="dialog"]')) return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("input, textarea, select, [contenteditable]")
      ) {
        return;
      }
      useUiStore.getState().clearSelection();
      useUiStore.getState().setCursor(null);
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [isDragActive, wasJustDragged]);

  // ⌘/Ctrl-click toggles a card, Shift-click selects from the last one clicked, and in selection
  // mode a plain click toggles. Caught before the card's own open button so none of them opens the
  // drawer.
  const onClickCapture = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const additive = event.metaKey || event.ctrlKey;
      const selecting = useUiStore.getState().selectMode;
      if (!additive && !event.shiftKey && !selecting) return;
      if (!(event.target instanceof Element) || wasJustDragged?.()) return;
      const card = event.target.closest<HTMLElement>("[data-item-id]");
      const id = card?.dataset.itemId;
      if (!id) return;
      event.preventDefault();
      event.stopPropagation();
      const { toggle, selectRange } = useUiStore.getState();
      if (event.shiftKey) {
        // Screen order, read from the DOM: it follows what the user sees, dropped cards included.
        const ordered = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>("[data-item-id]"),
          (node) => node.dataset.itemId ?? "",
        );
        selectRange(ordered, id, { additive });
      } else {
        toggle(id);
      }
    },
    [wasJustDragged],
  );

  const retryEnrich = useRetryEnrich();
  const openItem = useOpenItem();

  const pages = query.data?.pages;
  const itemPages = useMemo(() => pages?.map((page) => page.items) ?? [], [pages]);
  const lastCursor = pages?.[pages.length - 1]?.nextCursor ?? null;
  // Reordering is for manual sort only. Every other sort can still drop cards on the sidebar.
  // Nothing drags in Trash.
  // Smart views are filters, not places: nothing to reorder there either.
  // Search results are in rank order: no reordering, no folders, no canvas.
  const sortable =
    !searching && sort === "manual" && view.type !== "trash" && view.type !== "smart";
  const dnd: CardDnd | undefined =
    view.type === "trash" ? undefined : sortable ? "sortable" : "draggable";
  const canvas = viewMode === "canvas" && !searching;
  // Collection folders: the All view in grid mode only.
  const groupFolders = !searching && view.type === "all" && viewMode === "grid";
  const allItems = useMemo(() => itemPages.flat(), [itemPages]);
  const itemCount = useMemo(
    () => pages?.reduce((total, page) => total + page.items.length, 0) ?? 0,
    [pages],
  );

  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = query;
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    // After a failed page, wait for the user's retry: re-observing a visible sentinel would
    // refetch immediately and loop.
    if (
      !node ||
      !hasNextPage ||
      isFetchNextPageError ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage, itemCount]);

  // The canvas has no "load more": it needs every item, so it drains the remaining pages.
  useEffect(() => {
    if (canvas && hasNextPage && !isFetchingNextPage && !isFetchNextPageError) {
      void fetchNextPage();
    }
  }, [canvas, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);

  let content;
  if (info.unknown) {
    content = <EmptyState view={view} unknown />;
  } else if (query.isPending) {
    content = <BoardSkeleton />;
  } else if (query.isError && !query.data) {
    content = (
      <div
        role="alert"
        className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center"
      >
        <p className="text-body text-ink">{t.loadFailed}</p>
        <Button variant="secondary" onClick={() => void query.refetch()}>
          {t.tryAgain}
        </Button>
      </div>
    );
  } else if (itemCount === 0 && searching) {
    content = (
      <div
        data-slot="no-matches"
        className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-16 text-center"
      >
        <h2 className="font-heading text-page tracking-heading">{shell.search.noMatches}</h2>
        <p className="text-body text-ink-muted">{shell.search.noMatchesBody}</p>
        <Button
          variant="secondary"
          className="mt-2"
          onClick={() =>
            router.replace(searchParamsHref(pathname, searchParams, null), { scroll: false })
          }
        >
          {shell.search.clearSearch}
        </Button>
      </div>
    );
  } else if (itemCount === 0) {
    content = <EmptyState view={view} name={info.name} />;
  } else if (canvas && hasNextPage && !isFetchNextPageError) {
    // Mounting the canvas once, with everything loaded, auto-places new items in a single column.
    content = <BoardSkeleton />;
  } else if (canvas) {
    content = (
      <>
        {hasNextPage ? (
          <div role="alert" className="flex flex-col items-center gap-3 px-4 py-6 text-center">
            <p className="text-body text-ink">{t.loadAllFailed}</p>
            <Button variant="secondary" onClick={() => void fetchNextPage()}>
              {t.tryAgain}
            </Button>
          </div>
        ) : null}
        <CanvasView
          key={`${currentViewKey}:${sort}`}
          items={allItems}
          onOpen={openItem}
          onRetry={retryEnrich}
          persist={
            view.type === "collection"
              ? { type: "collection", collectionId: view.collectionId }
              : { type: "inbox" }
          }
        />
      </>
    );
  } else {
    content = (
      <>
        <div onClickCapture={onClickCapture} className="contents">
          {sortable ? (
            <SortableItems
              view={view}
              pages={itemPages}
              nextCursor={lastCursor}
              variant={viewMode === "list" ? "list" : "grid"}
              groupFolders={groupFolders}
            >
              {(shown) =>
                viewMode === "list" ? (
                  <ItemList pages={shown} onRetry={retryEnrich} onOpen={openItem} dnd="sortable" />
                ) : (
                  <ItemGrid
                    pages={shown}
                    onRetry={retryEnrich}
                    onOpen={openItem}
                    dnd="sortable"
                    groupFolders={groupFolders}
                  />
                )
              }
            </SortableItems>
          ) : viewMode === "list" ? (
            <ItemList pages={itemPages} onRetry={retryEnrich} onOpen={openItem} dnd={dnd} />
          ) : (
            <ItemGrid
              pages={itemPages}
              onRetry={retryEnrich}
              onOpen={openItem}
              dnd={dnd}
              groupFolders={groupFolders}
            />
          )}
        </div>
        <div ref={sentinelRef} aria-hidden="true" className="h-px" />
        {hasNextPage && isFetchNextPageError && !isFetchingNextPage ? (
          <div role="alert" className="flex flex-col items-center gap-3 px-4 py-6 text-center">
            <p className="text-body text-ink">{t.loadMoreFailed}</p>
            <Button variant="secondary" onClick={() => void fetchNextPage()}>
              {t.tryAgain}
            </Button>
          </div>
        ) : hasNextPage ? (
          <div className="flex justify-center px-4 py-6">
            <Button
              variant="secondary"
              onClick={() => void fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? t.loading : t.loadMore}
            </Button>
          </div>
        ) : (
          <div className="h-8" />
        )}
      </>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <Suspense fallback={<ToolbarPlaceholder />}>
        <Toolbar view={view} sort={sort} />
      </Suspense>
      <FilterChips search={search} items={allItems} />
      {content}
      <Suspense fallback={null}>
        <ItemDrawerHost view={view} />
      </Suspense>
      {canvas ? null : <SelectionBar view={view} itemIds={allItems.map((item) => item.id)} />}
      {canvas ? null : <ShortcutDialogs view={view} items={allItems} />}
      <PasteListener view={view} />
      <ExternalDropZone view={view} />
      <QuickAdd view={view} />
    </div>
  );
}
