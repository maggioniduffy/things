"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { getQueryClient } from "@/lib/query-client";

type QueryProviderProps = {
  /** The signed-in user's id; a different id starts from an empty cache. */
  userId: string;
  children: ReactNode;
};

export function QueryProvider({ userId, children }: QueryProviderProps) {
  // getQueryClient() returns a stable per-user singleton in the browser, so no useState is needed.
  return <QueryClientProvider client={getQueryClient(userId)}>{children}</QueryClientProvider>;
}
