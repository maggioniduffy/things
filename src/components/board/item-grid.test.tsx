import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MotionGlobalConfig } from "motion/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUiStore } from "@/stores/ui-store";
import { makeCounts, makeItem, makeTestQueryClient, renderWithQuery } from "@/test/fixtures";
import { ItemGrid } from "./item-grid";

const dnd = vi.hoisted(() => ({ dragging: false }));

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/components/dnd/board-dnd-provider", () => ({
  useBoardDnd: () => ({ dragging: dnd.dragging, draggingIds: null, wasJustDragged: () => false }),
}));

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PAGES = [
  [
    makeItem({ id: "i1", title: "Loose one", collection_id: null }),
    makeItem({ id: "i2", title: "In A first", collection_id: A }),
  ],
];

function renderGrid() {
  const client = makeTestQueryClient();
  client.setQueryData(
    ["collections"],
    [{ id: A, name: "Reading", emoji: null, color: "violet", position: "a" }],
  );
  client.setQueryData(["counts"], makeCounts({ collections: { [A]: 2 } }));
  return renderWithQuery(<ItemGrid pages={PAGES} groupFolders />, client);
}

beforeEach(() => {
  MotionGlobalConfig.skipAnimations = true;
  dnd.dragging = false;
  useUiStore.setState({ expandedCollections: [], selectedIds: [], anchorId: null });
});

describe("mobile sticky stack", () => {
  it("marks the grid as a stack, wrapping every entry's card", () => {
    const { container } = renderGrid();
    const grid = container.querySelector('ul[data-view-mode="grid"]');
    expect(grid).toHaveAttribute("data-stack", "true");
    expect(grid).not.toHaveAttribute("data-dragging");
    const entries = Array.from(grid!.children);
    expect(entries).toHaveLength(2);
    for (const entry of entries) {
      expect(entry.querySelector(":scope > [data-stack-card]")).not.toBeNull();
    }
  });

  it("turns the stack off during a drag", () => {
    dnd.dragging = true;
    const { container } = renderGrid();
    const grid = container.querySelector('ul[data-view-mode="grid"]');
    expect(grid).not.toHaveAttribute("data-stack");
    expect(grid).toHaveAttribute("data-dragging", "true");
  });

  it("renders an open folder's cards as direct grid list items", async () => {
    const user = userEvent.setup();
    const { container } = renderGrid();
    await user.click(screen.getByRole("button", { name: "Open folder Reading, 2 items" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Open In A first" })).toBeInTheDocument(),
    );
    const grid = container.querySelector('ul[data-view-mode="grid"]')!;
    expect(grid.querySelector('ul[role="presentation"]')).toBeNull();
    const card = screen.getByRole("button", { name: "Open In A first" }).closest("li");
    expect(card?.parentElement).toBe(grid);
  });
});
