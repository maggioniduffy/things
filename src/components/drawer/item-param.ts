"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";
import { itemQueryKey } from "@/lib/items/item-query";
import type { BoardItem } from "@/lib/items/queries";

/** The query parameter that holds the open item's id; the URL is the source of truth. */
export const ITEM_PARAM = "item";

function hrefWith(pathname: string, change: (params: URLSearchParams) => void): string {
  // Read at call time: the view path and other params (?sort=) stay as they are.
  const params = new URLSearchParams(window.location.search);
  change(params);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/** Opens the drawer for a card: seeds the item's cache entry so it renders at once. */
export function useOpenItem(): (item: BoardItem) => void {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  return useCallback(
    (item) => {
      queryClient.setQueryData(itemQueryKey(item.id), item);
      router.push(
        hrefWith(pathname, (params) => params.set(ITEM_PARAM, item.id)),
        { scroll: false },
      );
    },
    [queryClient, router, pathname],
  );
}

/** Closes the drawer by dropping `?item=`; replaces the entry so Back does not reopen it. */
export function useCloseItem(): () => void {
  const router = useRouter();
  const pathname = usePathname();
  return useCallback(() => {
    router.replace(
      hrefWith(pathname, (params) => params.delete(ITEM_PARAM)),
      { scroll: false },
    );
  }, [router, pathname]);
}
