import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { itemsQueryKey } from "@/lib/items/queries";
import { useUiStore } from "@/stores/ui-store";
import type { ViewSpec } from "@/lib/views";
import { makeItem, makeTestQueryClient, renderWithQuery } from "@/test/fixtures";
import { Board } from "./board";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/app",
  useSearchParams: () => new URLSearchParams(),
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
});
