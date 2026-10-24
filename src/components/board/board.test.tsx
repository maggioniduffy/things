import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { itemsQueryKey, itemsSearchQueryKey } from "@/lib/items/queries";
import { parseSearchParams } from "@/lib/search-params";
import { useUiStore } from "@/stores/ui-store";
import type { SortMode, ViewSpec } from "@/lib/views";
import { makeItem, makeTestQueryClient, renderWithQuery } from "@/test/fixtures";
import { Board } from "./board";

const nav = vi.hoisted(() => ({ replace: vi.fn(), search: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: nav.replace }),
  usePathname: () => "/app",
  useSearchParams: () => new URLSearchParams(nav.search),
}));

// A Supabase stand-in: every builder method returns the chain, and awaiting it yields the next
// queued result (a promise that never settles when the queue is empty, i.e. "still loading").
const supabase = vi.hoisted(() => {
  type Result = { data: unknown; error: unknown };
  const state = { queue: [] as Result[] };
  const chain: unknown = new Proxy(function () {}, {
    get(_target, prop) {
      if (prop === "then") {
        const next = state.queue.shift();
        if (!next) return () => {};
        return (resolve: (value: Result) => void) => resolve(next);
      }
      return () => chain;
    },
    apply: () => chain,
  });
  return { state, client: { from: () => chain } };
});
vi.mock("@/lib/supabase/client", () => ({ createClient: () => supabase.client }));
// The capture components need a signed-in viewer; they have their own tests.
vi.mock("@/lib/items/mutations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/items/mutations")>()),
  useCapture: () => ({
    captureLink: vi.fn(),
    captureNote: vi.fn(),
    captureFile: vi.fn(),
    captureText: vi.fn(),
    retryEnrich: vi.fn(),
  }),
}));

const INBOX: ViewSpec = { type: "inbox" };

function seedItems(client: ReturnType<typeof makeTestQueryClient>, titles: string[], more = false) {
  client.setQueryData(itemsQueryKey(INBOX, "manual"), {
    pages: [
      {
        items: titles.map((title, index) =>
          makeItem({ id: `00000000-0000-4000-8000-00000000000${index}`, title }),
        ),
        nextCursor: more ? { value: "a9", id: "00000000-0000-4000-8000-000000000009" } : null,
      },
    ],
    pageParams: [null],
  });
}

describe("Board", () => {
  beforeEach(() => {
    supabase.state.queue = [];
    nav.replace.mockClear();
    nav.search = "";
    useUiStore.setState({ viewMode: "grid", selectedIds: [] });
  });

  it("shows the skeleton while the first page loads", () => {
    renderWithQuery(<Board view={INBOX} sort="manual" />);
    expect(screen.getByRole("status", { name: "Loading your things" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Inbox" })).toBeInTheDocument();
  });

  it("shows an inline error with a working retry", async () => {
    supabase.state.queue = [{ data: null, error: { message: "boom" } }];
    renderWithQuery(<Board view={INBOX} sort="manual" />);

    expect(await screen.findByText("Couldn't load your things.")).toBeInTheDocument();

    supabase.state.queue = [{ data: [makeItem({ title: "Back again" })], error: null }];
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Back again")).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load your things.")).not.toBeInTheDocument();
  });

  it("shows the empty state for a view without items", () => {
    const client = makeTestQueryClient();
    seedItems(client, []);
    renderWithQuery(<Board view={INBOX} sort="manual" />, client);
    expect(
      screen.getByRole("heading", { level: 2, name: "Drop anything here." }),
    ).toBeInTheDocument();
  });

  it("renders items as a grid by default", () => {
    const client = makeTestQueryClient();
    seedItems(client, ["First", "Second"]);
    const { container } = renderWithQuery(<Board view={INBOX} sort="manual" />, client);
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
    expect(container.querySelector('[data-view-mode="grid"]')).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("renders rows in list mode", () => {
    useUiStore.setState({ viewMode: "list" });
    const client = makeTestQueryClient();
    seedItems(client, ["First"]);
    const { container } = renderWithQuery(<Board view={INBOX} sort="manual" />, client);
    expect(container.querySelector('[data-view-mode="list"]')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="item-row"]')).toBeInTheDocument();
  });

  it("offers Load more when another page exists and appends it", async () => {
    const client = makeTestQueryClient();
    seedItems(client, ["First"], true);
    renderWithQuery(<Board view={INBOX} sort="manual" />, client);

    supabase.state.queue = [
      {
        data: [makeItem({ id: "00000000-0000-4000-8000-000000000008", title: "Second page" })],
        error: null,
      },
    ];
    await userEvent.click(screen.getByRole("button", { name: "Load more" }));

    expect(await screen.findByText("Second page")).toBeInTheDocument();
    expect(screen.getByText("First")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument(),
    );
  });

  it("clears the selection when the view changes", () => {
    const client = makeTestQueryClient();
    seedItems(client, ["First"]);
    client.setQueryData(itemsQueryKey({ type: "all" }, "manual"), {
      pages: [{ items: [makeItem()], nextCursor: null }],
      pageParams: [null],
    });
    const { rerender } = renderWithQuery(<Board view={INBOX} sort="manual" />, client);

    useUiStore.setState({ selectedIds: ["x"] });
    // Same view re-rendered: selection stays.
    rerender(<Board view={INBOX} sort="manual" />);
    expect(useUiStore.getState().selectedIds).toEqual(["x"]);

    rerender(<Board view={{ type: "all" }} sort="manual" />);
    expect(useUiStore.getState().selectedIds).toEqual([]);
  });

  it("shows the not-found board for an unknown collection", () => {
    const client = makeTestQueryClient();
    client.setQueryData(["collections"], []);
    renderWithQuery(
      <Board
        view={{ type: "collection", collectionId: "66666666-6666-4666-8666-666666666666" }}
        sort="manual"
      />,
      client,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Inbox" })).toBeInTheDocument();
  });

  describe("sortable mode", () => {
    function handles() {
      return screen.queryAllByRole("button", { name: /^Reorder / });
    }

    it("shows a reorder handle per card in manual sort, in grid and list", () => {
      const client = makeTestQueryClient();
      seedItems(client, ["First", "Second"]);
      const { unmount } = renderWithQuery(<Board view={INBOX} sort="manual" />, client);
      expect(handles().map((h) => h.getAttribute("aria-label"))).toEqual([
        "Reorder First",
        "Reorder Second",
      ]);
      unmount();

      useUiStore.setState({ viewMode: "list" });
      renderWithQuery(<Board view={INBOX} sort="manual" />, client);
      expect(handles()).toHaveLength(2);
    });

    it("shows no handles in other sorts", () => {
      const client = makeTestQueryClient();
      client.setQueryData(itemsQueryKey(INBOX, "newest"), {
        pages: [{ items: [makeItem({ title: "First" })], nextCursor: null }],
        pageParams: [null],
      });
      renderWithQuery(<Board view={INBOX} sort="newest" />, client);
      expect(screen.getByText("First")).toBeInTheDocument();
      expect(handles()).toHaveLength(0);
    });

    it("shows no handles in Trash", () => {
      const client = makeTestQueryClient();
      client.setQueryData(itemsQueryKey({ type: "trash" }, "manual"), {
        pages: [{ items: [makeItem({ title: "Gone" })], nextCursor: null }],
        pageParams: [null],
      });
      renderWithQuery(<Board view={{ type: "trash" }} sort="manual" />, client);
      expect(screen.getByText("Gone")).toBeInTheDocument();
      expect(handles()).toHaveLength(0);
    });
  });

  describe("searching", () => {
    function seedSearch(
      client: ReturnType<typeof makeTestQueryClient>,
      titles: string[],
      sort: SortMode = "manual",
    ) {
      const search = parseSearchParams(new URLSearchParams(nav.search));
      if (!search) throw new Error("no search");
      client.setQueryData(itemsSearchQueryKey(INBOX, sort, search), {
        pages: [
          {
            items: titles.map((title, index) =>
              makeItem({ id: `00000000-0000-4000-8000-00000000010${index}`, title }),
            ),
            nextCursor: null,
          },
        ],
        pageParams: [null],
      });
    }

    it("shows the ranked results, with the chips row and no reordering", () => {
      nav.search = "q=pan&kind=note";
      const client = makeTestQueryClient();
      seedSearch(client, ["Receta de pan", "Pan dulce"]);
      renderWithQuery(<Board view={INBOX} sort="manual" />, client);
      const titles = screen.getAllByText(/pan/i).map((node) => node.textContent);
      expect(titles).toEqual(["Receta de pan", "Pan dulce"]);
      expect(screen.getByRole("group", { name: "Search filters" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Remove filter: Notes" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^Reorder / })).not.toBeInTheDocument();
    });

    it("shows No matches with a Clear search action", async () => {
      nav.search = "q=zzz&sort=title";
      const client = makeTestQueryClient();
      seedSearch(client, [], "title");
      renderWithQuery(<Board view={INBOX} sort="title" />, client);
      expect(screen.getByRole("heading", { level: 2, name: "No matches" })).toBeInTheDocument();
      const empty = document.querySelector<HTMLElement>('[data-slot="no-matches"]')!;
      await userEvent.click(within(empty).getByRole("button", { name: "Clear search" }));
      expect(nav.replace).toHaveBeenCalledWith("/app?sort=title", { scroll: false });
    });

    it("does not show the chips row when not searching", () => {
      const client = makeTestQueryClient();
      seedItems(client, ["First"]);
      renderWithQuery(<Board view={INBOX} sort="manual" />, client);
      expect(screen.queryByRole("group", { name: "Search filters" })).not.toBeInTheDocument();
    });
  });
});
