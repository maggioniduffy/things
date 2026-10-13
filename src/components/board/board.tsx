"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { useOpenItem } from "@/components/drawer/item-param";
import { ItemDrawerHost } from "@/components/drawer/item-drawer";
import { ExternalDropZone } from "@/components/capture/external-drop-zone";
import { PasteListener } from "@/components/capture/paste-listener";
import { QuickAdd } from "@/components/capture/quick-add";
import { Button } from "@/components/ui/button";
import { useRetryEnrich } from "@/lib/items/mutations";
import { itemsInfiniteQueryOptions } from "@/lib/items/queries";
import { createClient } from "@/lib/supabase/client";
import { viewKey, type SortMode, type ViewSpec } from "@/lib/views";
import { useUiStore } from "@/stores/ui-store";
import { BoardSkeleton, ToolbarPlaceholder } from "./board-skeleton";
import { EmptyState } from "./empty-state";
import { ItemGrid } from "./item-grid";
import { ItemList } from "./item-list";
import { Toolbar, useEffectiveViewMode, useViewInfo } from "./toolbar";

type BoardProps = { view: ViewSpec; sort: SortMode };

export function Board({ view, sort }: BoardProps) {
  const query = useInfiniteQuery(itemsInfiniteQueryOptions(createClient(), view, sort));
  const info = useViewInfo(view);
  const viewMode = useEffectiveViewMode();
  const clearSelection = useUiStore((state) => state.clearSelection);

  const currentViewKey = viewKey(view);
  useEffect(() => {
    clearSelection();
  }, [currentViewKey, clearSelection]);

  const retryEnrich = useRetryEnrich();
  const openItem = useOpenItem();

  const pages = query.data?.pages;
  const itemPages = useMemo(() => pages?.map((page) => page.items) ?? [], [pages]);
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
  } else {
    content = (
      <>
        {viewMode === "list" ? (
          <ItemList pages={itemPages} onRetry={retryEnrich} onOpen={openItem} />
        ) : (
          <ItemGrid pages={itemPages} onRetry={retryEnrich} onOpen={openItem} />
        )}
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
