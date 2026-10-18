import { MotionGlobalConfig } from "motion/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUiStore } from "@/stores/ui-store";
import { makeCounts, makeItem, makeTestQueryClient, renderWithQuery } from "@/test/fixtures";
import { ItemGrid } from "./item-grid";
import { SortableItems } from "./sortable-items";

const seen = vi.hoisted(() => ({ ids: [] as string[] }));

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/items/reorder", () => ({ useReorderItem: () => vi.fn() }));
vi.mock("@dnd-kit/sortable", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@dnd-kit/sortable")>()),
  SortableContext: ({ items, children }: { items: string[]; children: ReactNode }) => {
    seen.ids = items;
    return <>{children}</>;
  },
}));

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PAGES = [
  [
    makeItem({ id: "L1", title: "Loose", collection_id: null }),
    makeItem({ id: "A1", title: "A one", collection_id: A }),
    makeItem({ id: "B1", title: "B one", collection_id: B }),
    makeItem({ id: "A2", title: "A two", collection_id: A }),
  ],
];

function renderSortable() {
  const client = makeTestQueryClient();
  client.setQueryData(
    ["collections"],
    [
      { id: A, name: "Alpha", emoji: null, color: null, position: "a" },
      { id: B, name: "Beta", emoji: null, color: null, position: "b" },
    ],
  );
  client.setQueryData(["counts"], makeCounts());
  return renderWithQuery(
    <SortableItems
      view={{ type: "all" }}
      pages={PAGES}
      nextCursor={null}
      variant="grid"
      groupFolders
    >
      {(shown) => <ItemGrid pages={shown} groupFolders dnd="sortable" />}
    </SortableItems>,
    client,
  );
}

beforeEach(() => {
  MotionGlobalConfig.skipAnimations = true;
  seen.ids = [];
  useUiStore.setState({ expandedCollections: [], selectedIds: [], anchorId: null });
});

describe("SortableItems with folders", () => {
  it("makes only loose cards sortable while folders are closed", () => {
    renderSortable();
    expect(seen.ids).toEqual(["L1"]);
  });

  it("adds the cards of an open folder, in screen order", () => {
    useUiStore.setState({ expandedCollections: [A] });
    renderSortable();
    expect(seen.ids).toEqual(["L1", "A1", "A2"]);
  });

  it("forgets open folders whose collection no longer exists", () => {
    useUiStore.setState({ expandedCollections: [A, "gone"] });
    renderSortable();
    expect(useUiStore.getState().expandedCollections).toEqual([A]);
  });
});
