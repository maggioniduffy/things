import { QueryClientProvider, type InfiniteData } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeItem, makeTestQueryClient } from "@/test/fixtures";
import { itemQueryKey } from "./item-query";
import { itemsQueryKey, type BoardItem, type ItemsPage } from "./queries";
import { applyPositions, useReorderItem } from "./reorder";

const mocks = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), dismiss: vi.fn() }),
  client: undefined as unknown,
  fetchItemsPage: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => mocks.client }));
vi.mock("./queries", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./queries")>()),
  fetchItemsPage: mocks.fetchItemsPage,
}));

const INBOX = { type: "inbox" } as const;
const mk = (n: number, position: string) =>
  makeItem({ id: `00000000-0000-4000-8000-00000000000${n}`, title: `Item ${n}`, position });
const ITEMS = [mk(1, "a0"), mk(2, "a1"), mk(3, "a2"), mk(4, "a3")];

function pageOf(items: BoardItem[], nextCursor: ItemsPage["nextCursor"] = null) {
  return { pages: [{ items, nextCursor }], pageParams: [null] } as InfiniteData<ItemsPage>;
}

function setup(error: unknown = null) {
  const updates: { patch: unknown; id: string }[] = [];
  const release = { fn: () => {} };
  mocks.client = {
    from: () => ({
      update: (patch: unknown) => ({
        eq: (_c: string, id: string) =>
          new Promise((resolve) => {
            updates.push({ patch, id });
            release.fn = () => resolve({ error });
          }),
      }),
    }),
  };
  const queryClient = makeTestQueryClient();
  queryClient.setQueryData(itemsQueryKey(INBOX, "manual"), pageOf(ITEMS));
  queryClient.setQueryData(itemsQueryKey(INBOX, "newest"), pageOf([...ITEMS].reverse()));
  queryClient.setQueryData(itemQueryKey(ITEMS[0]!.id), ITEMS[0]);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useReorderItem(), { wrapper });
  return { queryClient, result, updates, release };
}

const titles = (queryClient: ReturnType<typeof makeTestQueryClient>, sort: "manual" | "newest") =>
  queryClient
    .getQueryData<InfiniteData<ItemsPage>>(itemsQueryKey(INBOX, sort))
    ?.pages.flatMap((p) => p.items.map((i) => i.title));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useReorderItem", () => {
  it("sends one update with only position and reorders the cache at once", async () => {
    const { queryClient, result, updates, release } = setup();
    let done!: Promise<void>;
    act(() => {
      done = result.current({
        view: INBOX,
        items: ITEMS,
        nextCursor: null,
        movedId: ITEMS[0]!.id,
        toIndex: 2,
      });
    });
    await waitFor(() => expect(updates).toHaveLength(1));
    expect(titles(queryClient, "manual")).toEqual(["Item 2", "Item 3", "Item 1", "Item 4"]);
    expect(titles(queryClient, "newest")).toEqual(["Item 4", "Item 3", "Item 2", "Item 1"]);
    expect(Object.keys(updates[0]!.patch as object)).toEqual(["position"]);
    expect(updates[0]!.id).toBe(ITEMS[0]!.id);
    release.fn();
    await act(() => done);
    expect(updates).toHaveLength(1);
  });

  it("rolls back and toasts when the write fails", async () => {
    const { queryClient, result, release } = setup({ message: "nope" });
    let done!: Promise<void>;
    act(() => {
      done = result.current({
        view: INBOX,
        items: ITEMS,
        nextCursor: null,
        movedId: ITEMS[0]!.id,
        toIndex: 3,
      });
    });
    await waitFor(() => expect(titles(queryClient, "manual")?.[3]).toBe("Item 1"));
    release.fn();
    await act(() => done);
    expect(titles(queryClient, "manual")).toEqual(["Item 1", "Item 2", "Item 3", "Item 4"]);
    expect(mocks.toast.error).toHaveBeenCalledWith("Couldn't move that.");
  });

  it("does nothing when the row lands where it was", async () => {
    const { result, updates } = setup();
    await act(() =>
      result.current({
        view: INBOX,
        items: ITEMS,
        nextCursor: null,
        movedId: ITEMS[1]!.id,
        toIndex: 1,
      }),
    );
    expect(updates).toHaveLength(0);
  });

  it("looks up the first unloaded row when dropped after the last loaded one", async () => {
    mocks.fetchItemsPage.mockResolvedValue({ items: [mk(9, "a4")], nextCursor: null });
    const { result, updates, release } = setup();
    const cursor = { value: "a3", id: ITEMS[3]!.id };
    let done!: Promise<void>;
    act(() => {
      done = result.current({
        view: INBOX,
        items: ITEMS,
        nextCursor: cursor,
        movedId: ITEMS[0]!.id,
        toIndex: 3,
      });
    });
    await waitFor(() => expect(updates).toHaveLength(1));
    expect(mocks.fetchItemsPage).toHaveBeenCalledTimes(1);
    expect(mocks.fetchItemsPage.mock.calls[0]?.slice(1)).toEqual([INBOX, "manual", cursor, 1]);
    const position = (updates[0]!.patch as { position: string }).position;
    expect(position > "a3" && position < "a4").toBe(true);
    release.fn();
    await act(() => done);
  });
});

describe("applyPositions", () => {
  it("keeps a row dropped past the loaded rows at the end of the loaded part", () => {
    const data = pageOf(ITEMS, { value: "a3", id: ITEMS[3]!.id });
    const next = applyPositions(data, [{ id: ITEMS[0]!.id, position: "a3V" }], "manual");
    expect(next.pages[0]!.items.map((i) => i.title)).toEqual([
      "Item 2",
      "Item 3",
      "Item 4",
      "Item 1",
    ]);
  });
});
