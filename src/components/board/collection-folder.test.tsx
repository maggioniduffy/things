import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MotionGlobalConfig } from "motion/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUiStore } from "@/stores/ui-store";
import { makeCounts, makeItem, makeTestQueryClient, renderWithQuery } from "@/test/fixtures";
import { ItemGrid } from "./item-grid";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const PAGES = [
  [
    makeItem({ id: "i1", title: "Loose one", collection_id: null }),
    makeItem({ id: "i2", title: "In A first", collection_id: A }),
    makeItem({ id: "i3", title: "In B", collection_id: B }),
  ],
  [makeItem({ id: "i4", title: "In A second", collection_id: A })],
];

function renderGrid(groupFolders = true) {
  const client = makeTestQueryClient();
  client.setQueryData(
    ["collections"],
    [
      { id: A, name: "Reading", emoji: null, color: "violet", position: "a" },
      { id: B, name: "Recipes", emoji: "🍳", color: null, position: "b" },
    ],
  );
  client.setQueryData(["counts"], makeCounts({ collections: { [A]: 12, [B]: 1 } }));
  return renderWithQuery(<ItemGrid pages={PAGES} groupFolders={groupFolders} />, client);
}

beforeEach(() => {
  MotionGlobalConfig.skipAnimations = true;
  useUiStore.setState({ expandedCollections: [], selectedIds: [], anchorId: null });
});

describe("collection folders in the grid", () => {
  it("shows closed folders with a count and keeps loose cards", () => {
    const { container } = renderGrid();
    expect(screen.getByRole("button", { name: "Open Loose one" })).toBeInTheDocument();
    const open = screen.getByRole("button", { name: "Open folder Reading, 12 items" });
    expect(open).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("12 items")).toBeInTheDocument();
    expect(screen.getByText("1 item")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open In A first" })).not.toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="collection-folder"]')).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "Open collection" })[0]).toHaveAttribute(
      "href",
      `/app/c/${A}`,
    );
  });

  it("opens a folder to its cards across pages, and collapses it again", async () => {
    const user = userEvent.setup();
    renderGrid();
    await user.click(screen.getByRole("button", { name: "Open folder Reading, 12 items" }));
    expect(useUiStore.getState().expandedCollections).toEqual([A]);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Open In A second" })).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Open In A first" })).toBeInTheDocument();
    const collapse = screen.getByRole("button", { name: "Collapse folder Reading" });
    expect(collapse).toHaveAttribute("aria-expanded", "true");

    useUiStore.getState().select("i4");
    await user.click(collapse);
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Open In A first" })).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: "Open folder Reading, 12 items" }),
    ).toBeInTheDocument();
    expect(useUiStore.getState().selectedIds).toEqual([]);
  });

  it("renders plain cards when grouping is off", () => {
    renderGrid(false);
    expect(screen.queryByRole("button", { name: /Open folder/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open In A first" })).toBeInTheDocument();
  });

  it("uses the stored open state", () => {
    useUiStore.setState({ expandedCollections: [B] });
    renderGrid();
    expect(screen.getByRole("button", { name: "Open In B" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse folder Recipes" })).toBeVisible();
  });
});

describe("folder focus", () => {
  it("moves focus to Collapse after opening and back to the tile after collapsing", async () => {
    const user = userEvent.setup();
    renderGrid();
    await user.click(screen.getByRole("button", { name: "Open folder Reading, 12 items" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Collapse folder Reading" })).toHaveFocus(),
    );
    await user.click(screen.getByRole("button", { name: "Collapse folder Reading" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Open folder Reading, 12 items" })).toHaveFocus(),
    );
  });

  it("does not take focus for a folder that is open on load", () => {
    useUiStore.setState({ expandedCollections: [A] });
    renderGrid();
    expect(document.body).toHaveFocus();
  });
});
