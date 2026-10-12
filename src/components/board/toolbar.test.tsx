import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeTestQueryClient, renderWithQuery } from "@/test/fixtures";
import { useUiStore } from "@/stores/ui-store";
import type { SortMode, ViewSpec } from "@/lib/views";
import { Toolbar } from "./toolbar";

const nav = vi.hoisted(() => ({
  push: vi.fn(),
  pathname: "/app/f/pdf",
  search: "",
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push }),
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(nav.search),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

const COLLECTION_ID = "33333333-3333-4333-8333-333333333333";
const TAG_ID = "44444444-4444-4444-8444-444444444444";
const SMART_ID = "55555555-5555-4555-8555-555555555555";

function seededClient() {
  const client = makeTestQueryClient();
  client.setQueryData(
    ["collections"],
    [{ id: COLLECTION_ID, name: "Reading list", emoji: "📚", color: null, position: "a0" }],
  );
  client.setQueryData(["tags"], [{ id: TAG_ID, name: "thesis", color: null }]);
  client.setQueryData(
    ["smart-views"],
    [{ id: SMART_ID, name: "Unread PDFs", icon: null, position: "a0" }],
  );
  return client;
}

function renderToolbar(view: ViewSpec, sort: SortMode = "manual") {
  return renderWithQuery(<Toolbar view={view} sort={sort} />, seededClient());
}

describe("Toolbar", () => {
  beforeEach(() => {
    nav.push.mockClear();
    nav.pathname = "/app/f/pdf";
    nav.search = "";
    useUiStore.setState({ viewMode: "grid", sidebarCollapsed: false, mobileSidebarOpen: false });
  });

  describe("title", () => {
    const TITLES: [string, ViewSpec, string][] = [
      ["inbox", { type: "inbox" }, "Inbox"],
      ["all", { type: "all" }, "All"],
      ["unread", { type: "unread" }, "Unread"],
      ["favorites", { type: "favorites" }, "Favorites"],
      ["archive", { type: "archive" }, "Archive"],
      ["trash", { type: "trash" }, "Trash"],
      ["kind", { type: "kind", kind: "pdf" }, "PDFs"],
      ["collection", { type: "collection", collectionId: COLLECTION_ID }, "📚 Reading list"],
      ["tag", { type: "tag", tagId: TAG_ID }, "#thesis"],
      ["smart view", { type: "smart", viewId: SMART_ID }, "Unread PDFs"],
      [
        "unknown collection",
        { type: "collection", collectionId: "66666666-6666-4666-8666-666666666666" },
        "Not found",
      ],
      ["unknown tag", { type: "tag", tagId: "66666666-6666-4666-8666-666666666666" }, "Not found"],
    ];

    it.each(TITLES)("%s", (_name, view, title) => {
      renderToolbar(view);
      expect(screen.getByRole("heading", { level: 1, name: title })).toBeInTheDocument();
    });
  });

  describe("sort", () => {
    async function chooseSort(name: string, current: SortMode = "manual") {
      renderToolbar({ type: "kind", kind: "pdf" }, current);
      await userEvent.click(screen.getByRole("button", { name: /^Sort:/ }));
      await userEvent.click(await screen.findByRole("menuitemradio", { name }));
    }

    it("offers the four sort modes with the current one checked", async () => {
      renderToolbar({ type: "kind", kind: "pdf" }, "newest");
      await userEvent.click(screen.getByRole("button", { name: "Sort: Newest" }));
      const items = await screen.findAllByRole("menuitemradio");
      expect(items.map((item) => item.textContent)).toEqual([
        "Manual",
        "Newest",
        "Oldest",
        "Title",
      ]);
      expect(screen.getByRole("menuitemradio", { name: "Newest" })).toBeChecked();
    });

    it("pushes ?sort= for a non-default sort", async () => {
      await chooseSort("Title");
      expect(nav.push).toHaveBeenCalledWith("/app/f/pdf?sort=title", { scroll: false });
    });

    it("drops the parameter for manual", async () => {
      nav.search = "sort=title";
      await chooseSort("Manual", "title");
      expect(nav.push).toHaveBeenCalledWith("/app/f/pdf", { scroll: false });
    });

    it("keeps other search params such as item", async () => {
      nav.search = "item=abc";
      await chooseSort("Oldest");
      expect(nav.push).toHaveBeenCalledWith("/app/f/pdf?item=abc&sort=oldest", { scroll: false });
    });
  });

  describe("view toggle", () => {
    it("disables canvas and explains why", async () => {
      renderToolbar({ type: "inbox" });
      expect(screen.getByRole("button", { name: "Canvas view" })).toBeDisabled();
      await userEvent.hover(screen.getByRole("button", { name: "Canvas view" }).parentElement!);
      expect(await screen.findByRole("tooltip")).toHaveTextContent("Canvas is coming soon");
    });

    it("switches between grid and list", async () => {
      renderToolbar({ type: "inbox" });
      const grid = screen.getByRole("button", { name: "Grid view" });
      const list = screen.getByRole("button", { name: "List view" });
      expect(grid).toHaveAttribute("aria-pressed", "true");
      expect(list).toHaveAttribute("aria-pressed", "false");

      await userEvent.click(list);
      expect(useUiStore.getState().viewMode).toBe("list");
      expect(list).toHaveAttribute("aria-pressed", "true");
      expect(grid).toHaveAttribute("aria-pressed", "false");
    });

    it("shows a persisted canvas mode as grid", () => {
      useUiStore.setState({ viewMode: "canvas" });
      renderToolbar({ type: "inbox" });
      expect(screen.getByRole("button", { name: "Grid view" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });
  });

  it("has a disabled search field", () => {
    renderToolbar({ type: "inbox" });
    expect(screen.getByRole("searchbox", { name: "Search" })).toBeDisabled();
    expect(screen.getByPlaceholderText("Search")).toBeInTheDocument();
  });

  it("toggles the sidebar from its buttons", async () => {
    renderToolbar({ type: "inbox" });
    await userEvent.click(screen.getByRole("button", { name: "Hide sidebar", hidden: true }));
    expect(useUiStore.getState().sidebarCollapsed).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "Open sidebar", hidden: true }));
    expect(useUiStore.getState().mobileSidebarOpen).toBe(true);
  });
});
