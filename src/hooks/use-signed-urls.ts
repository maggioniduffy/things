"use client";

import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { BUCKET } from "@/lib/items/upload";

/** Signed URLs live one hour; the cache refreshes them after 50 minutes, well before expiry. */
const EXPIRES_IN_SECONDS = 60 * 60;
const STALE_TIME_MS = 50 * 60 * 1000;

const EMPTY: ReadonlyMap<string, string> = new Map();

/**
 * Batch-signs storage paths for cards (thumbnails, image previews): one `createSignedUrls` call
 * per distinct set of paths. Returns path -> url; a path that could not be signed is absent.
 * Empty input makes no request. While a new set loads, URLs from the previous set stay available
 * so cards don't flash empty as a board paginates.
 */
export function useSignedUrls(paths: readonly (string | null | undefined)[]): Map<string, string> {
  // Distinct, sorted: the same paths in any order share one cache entry.
  // (Cheap to recompute each render; the query key compares by value, so a fresh array is fine.)
  const wanted = [...new Set(paths.filter((path): path is string => Boolean(path)))].sort();

  const query = useQuery({
    queryKey: ["signed-urls", ...wanted],
    queryFn: async () => {
      const { data, error } = await createClient()
        .storage.from(BUCKET)
        .createSignedUrls(wanted, EXPIRES_IN_SECONDS);
      if (error) throw error;

      const urls = new Map<string, string>();
      for (const entry of data) {
        if (entry.path && entry.signedUrl && !entry.error) urls.set(entry.path, entry.signedUrl);
      }
      return urls;
    },
    enabled: wanted.length > 0,
    staleTime: STALE_TIME_MS,
    // Stale data alone isn't refetched in a tab that stays focused; re-sign before the hour is up.
    refetchInterval: STALE_TIME_MS,
    placeholderData: keepPreviousData,
  });

  // New Map per call keeps the declared return type simple and callers can't mutate the cache.
  return useMemo(
    () => new Map(wanted.length > 0 ? (query.data ?? EMPTY) : EMPTY),
    [query.data, wanted.length],
  );
}
