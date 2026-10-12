import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render as rtlRender } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { BoardItem } from "@/lib/items/queries";
import type { SidebarCounts } from "@/lib/sidebar/counts";

/** A client that never refetches seeded data and never retries, so tests stay deterministic. */
export function makeTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false, gcTime: Infinity } },
  });
}

/** Renders with a QueryClient and the tooltip provider; `rerender` keeps both. */
export function renderWithQuery(ui: ReactElement, client: QueryClient = makeTestQueryClient()) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <TooltipProvider>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </TooltipProvider>
    );
  }
  return { client, ...rtlRender(ui, { wrapper: Wrapper }) };
}

export function makeItem(overrides: Partial<BoardItem> = {}): BoardItem {
  return {
    archived_at: null,
    canvas_h: null,
    canvas_w: null,
    canvas_x: null,
    canvas_y: null,
    canvas_z: 0,
    collection_id: null,
    created_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    description: null,
    domain: null,
    enrich_status: "done",
    favicon_url: null,
    file_name: null,
    file_path: null,
    file_size: null,
    id: "11111111-1111-4111-8111-111111111111",
    image_url: null,
    is_favorite: false,
    is_read: false,
    kind: "note",
    metadata: {},
    mime_type: null,
    note: null,
    position: "a0",
    site_name: null,
    thumbnail_path: null,
    title: "A note",
    updated_at: "2026-01-01T00:00:00Z",
    url: null,
    user_id: "22222222-2222-4222-8222-222222222222",
    ...overrides,
  };
}

export function makeCounts(overrides: Partial<SidebarCounts> = {}): SidebarCounts {
  return {
    inbox: 0,
    all: 0,
    unread: 0,
    favorites: 0,
    archive: 0,
    trash: 0,
    kinds: {},
    collections: {},
    ...overrides,
  };
}
