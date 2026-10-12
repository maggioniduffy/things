"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Suspense, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { itemsInfiniteQueryOptions } from "@/lib/items/queries";
import { createClient } from "@/lib/supabase/client";
import { viewKey, type SortMode, type ViewSpec } from "@/lib/views";
import { useUiStore } from "@/stores/ui-store";
import { BoardSkeleton, ToolbarPlaceholder } from "./board-skeleton";
import { EmptyState } from "./empty-state";
import { ItemTile } from "./item-tile";
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

  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNextPage || typeof IntersectionObserver === "undefined") return;
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
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, items.length]);

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
  } else if (items.length === 0) {
    content = <EmptyState view={view} name={info.name} />;
  } else {
    content = (
      <>
        {viewMode === "list" ? (
          <ul className="border-line mx-4 border-t sm:mx-6" data-view-mode="list">
            {items.map((item) => (
              <ItemTile key={item.id} item={item} variant="list" />
            ))}
          </ul>
        ) : (
          <ul
            className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 px-4 sm:px-6"
            data-view-mode="grid"
          >
            {items.map((item) => (
              <ItemTile key={item.id} item={item} variant="grid" />
            ))}
          </ul>
        )}
        <div ref={sentinelRef} aria-hidden="true" className="h-px" />
        {hasNextPage ? (
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
    </div>
  );
}
