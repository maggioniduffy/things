"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { CanvasView } from "@/components/canvas/canvas-view";
import { makeQueryClient } from "@/lib/query-client";
import type { BoardItem } from "@/lib/items/queries";
import type { ItemKind } from "@/types/supabase";

const KINDS: ItemKind[] = ["link", "note", "image", "pdf", "video", "article", "document"];

/** Fixture items with no Supabase behind them: every fifth one placed, the rest auto-placed. */
function fixtureItems(count: number): BoardItem[] {
  return Array.from({ length: count }, (_, index) => {
    const kind = KINDS[index % KINDS.length] ?? "link";
    const placed = index % 5 === 0;
    const n = index + 1;
    return {
      archived_at: null,
      canvas_h: null,
      canvas_w: null,
      canvas_x: placed ? ((index / 5) % 8) * 340 : null,
      canvas_y: placed ? Math.floor(index / 40) * 280 : null,
      canvas_z: 0,
      collection_id: null,
      created_at: "2026-01-01T00:00:00Z",
      deleted_at: null,
      description: null,
      domain: kind === "link" || kind === "article" ? "example.com" : null,
      enrich_status: "done",
      favicon_url: null,
      file_name: kind === "pdf" || kind === "document" ? `file-${n}.pdf` : null,
      file_path: null,
      file_size: null,
      id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
      image_url: null,
      is_favorite: index % 11 === 0,
      is_read: index % 3 !== 0,
      kind,
      metadata: {},
      mime_type: null,
      note: kind === "note" ? `Sticky note ${n}. Some text to fill the card.` : null,
      position: `a${String(n).padStart(6, "0")}`,
      site_name: null,
      thumbnail_path: null,
      title: `Canvas item ${n}`,
      updated_at: "2026-01-01T00:00:00Z",
      url: kind === "link" || kind === "article" ? `https://example.com/${n}` : null,
      user_id: "00000000-0000-4000-8000-ffffffffffff",
    };
  });
}

export function CanvasDemo({ count }: { count: number }) {
  const [client] = useState(makeQueryClient);
  const [items] = useState(() => fixtureItems(count));
  return (
    <QueryClientProvider client={client}>
      <div className="flex h-[calc(100dvh-5rem)]">
        <CanvasView items={items} />
      </div>
    </QueryClientProvider>
  );
}
