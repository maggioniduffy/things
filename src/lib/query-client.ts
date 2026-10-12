import { QueryClient, environmentManager } from "@tanstack/react-query";

const STALE_TIME_MS = 30_000;

// staleTime must be > 0 on both server and client: dehydrated state does not carry it, so 0
// would refetch immediately after hydration.
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_MS,
        retry: environmentManager.isServer() ? 0 : 1,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;
let browserQueryClientUser: string | undefined;

/**
 * Server: always a fresh client (never share data between requests). Browser: a singleton per
 * signed-in user. A different `userId` (sign out, then another account or guest in the same tab)
 * gets a new, empty client, so one account's cached items never render for the next.
 */
export function getQueryClient(userId?: string): QueryClient {
  if (environmentManager.isServer()) return makeQueryClient();
  if (!browserQueryClient || (userId !== undefined && userId !== browserQueryClientUser)) {
    browserQueryClient?.clear();
    browserQueryClient = makeQueryClient();
  }
  if (userId !== undefined) browserQueryClientUser = userId;
  return browserQueryClient;
}

/** Drops every cached query in the browser, e.g. on sign-out. */
export function clearBrowserQueryClient(): void {
  browserQueryClient?.clear();
  browserQueryClient = undefined;
  browserQueryClientUser = undefined;
}
