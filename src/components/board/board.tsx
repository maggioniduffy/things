"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Suspense, useCallback, useEffect, useMemo, useRef, type MouseEvent } from "react";
import { useBoardDnd } from "@/components/dnd/board-dnd-provider";
import { useOpenItem } from "@/components/drawer/item-param";
import { ItemDrawerHost } from "@/components/drawer/item-drawer";
import { ExternalDropZone } from "@/components/capture/external-drop-zone";
import { PasteListener } from "@/components/capture/paste-listener";
import { QuickAdd } from "@/components/capture/quick-add";
import { CanvasView } from "@/components/canvas/canvas-view";
import { Button } from "@/components/ui/button";
import { useRetryEnrich } from "@/lib/items/mutations";
import { itemsInfiniteQueryOptions } from "@/lib/items/queries";
import { createClient } from "@/lib/supabase/client";
import { viewKey, type SortMode, type ViewSpec } from "@/lib/views";
import { useUiStore } from "@/stores/ui-store";
import { BoardSkeleton, ToolbarPlaceholder } from "./board-skeleton";
import { EmptyState } from "./empty-state";
import type { CardDnd } from "./board-cards";
import { ItemGrid } from "./item-grid";
import { ItemList } from "./item-list";
import { SortableItems } from "./sortable-items";
import { Toolbar, useEffectiveViewMode, useViewInfo } from "./toolbar";

type BoardProps = { view: ViewSpec; sort: SortMode };

export function Board({ view, sort }: BoardProps) {
  const query = useInfiniteQuery(itemsInfiniteQueryOptions(createClient(), view, sort));
  const info = useViewInfo(view);
  const viewMode = useEffectiveViewMode(view);
  const clearSelection = useUiStore((state) => state.clearSelection);

  const currentViewKey = viewKey(view);
  useEffect(() => {
    clearSelection();
  }, [currentViewKey, clearSelection]);

  const boardDnd = useBoardDnd();
  const wasJustDragged = boardDnd?.wasJustDragged;
  const isDragActive = boardDnd?.isDragActive;

  // Escape clears the selection, unless it belongs to something else: a drag being cancelled, an
  // open dialog or drawer, or a text field.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (useUiStore.getState().selectedIds.length === 0) return;
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
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isDragActive, wasJustDragged]);

  // ⌘/Ctrl-click toggles a card, Shift-click selects from the last one clicked. Caught before the
  // card's own open button so a modified click never opens the drawer.
  const onClickCapture = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const additive = event.metaKey || event.ctrlKey;
      if (!additive && !event.shiftKey) return;
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
  const sortable = sort === "manual" && view.type !== "trash" && view.type !== "smart";
  const dnd: CardDnd | undefined =
    view.type === "trash" ? undefined : sortable ? "sortable" : "draggable";
  const canvas = viewMode === "canvas";
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
        <p className="text-body text-ink">Couldn&apos;t load your things.</p>
        <Button variant="secondary" onClick={() => void query.refetch()}>
          Try again
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
            <p className="text-body text-ink">Couldn&apos;t load all your things.</p>
            <Button variant="secondary" onClick={() => void fetchNextPage()}>
              Try again
            </Button>
          </div>
        ) : null}
        <CanvasView
          key={`${currentViewKey}:${sort}`}
          items={allItems}
          onOpen={openItem}
          onRetry={retryEnrich}
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
            >
              {(shown) =>
                viewMode === "list" ? (
                  <ItemList pages={shown} onRetry={retryEnrich} onOpen={openItem} dnd="sortable" />
                ) : (
                  <ItemGrid pages={shown} onRetry={retryEnrich} onOpen={openItem} dnd="sortable" />
                )
              }
            </SortableItems>
          ) : viewMode === "list" ? (
            <ItemList pages={itemPages} onRetry={retryEnrich} onOpen={openItem} dnd={dnd} />
          ) : (
            <ItemGrid pages={itemPages} onRetry={retryEnrich} onOpen={openItem} dnd={dnd} />
          )}
        </div>
        <div ref={sentinelRef} aria-hidden="true" className="h-px" />
        {hasNextPage && isFetchNextPageError && !isFetchingNextPage ? (
          <div role="alert" className="flex flex-col items-center gap-3 px-4 py-6 text-center">
            <p className="text-body text-ink">Couldn&apos;t load more things.</p>
            <Button variant="secondary" onClick={() => void fetchNextPage()}>
              Try again
            </Button>
          </div>
        ) : hasNextPage ? (
          <div className="flex justify-center px-4 py-6">
            <Button
              variant="secondary"
              onClick={() => void fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? "Loading…" : "Load more"}
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
      {content}
      <Suspense fallback={null}>
        <ItemDrawerHost view={view} />
      </Suspense>
      <PasteListener view={view} />
      <ExternalDropZone view={view} />
      <QuickAdd view={view} />
    </div>
  );
}
