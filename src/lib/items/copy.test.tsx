import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeItem, makeTestQueryClient } from "@/test/fixtures";
import { GUEST_QUOTA_COPY, resetCaptureStateForTests } from "./mutations";
import { itemsQueryKey, type BoardItem, type ItemsPage } from "./queries";
import { usePasteCopies } from "./copy";

const mocks = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
  undoToast: vi.fn(),
  client: { current: null as unknown },
}));

vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@/components/ui/sonner", () => ({ undoToast: mocks.undoToast }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => mocks.client.current }));
vi.mock("@/components/providers/viewer-provider", () => ({
  useViewer: () => ({ userId: "u1", isGuest: false }),
}));

type Result = { data?: unknown; error?: unknown };

/** A thenable query builder: every method returns it, awaiting yields `result`. */
function builder(result: Result) {
  const b: Record<string, unknown> = {};
  for (const name of ["select", "in", "is", "order", "limit", "returns", "delete", "insert"]) {
    b[name] = vi.fn(() => b);
  }
  b.then = (resolve: (value: Result) => unknown) => Promise.resolve(result).then(resolve);
  return b;
}

type Setup = {
  source: BoardItem;
  insertError?: unknown;
  copyError?: unknown;
};

function setup({ source, insertError, copyError }: Setup) {
  const insert = vi.fn();
  const del = vi.fn();
  const remove = vi.fn(async () => ({ error: null }));
  const copy = vi.fn(async () => ({ data: null, error: copyError ?? null }));
  mocks.client.current = {
    from: (table: string) => {
      if (table === "item_tags") {
        const tags = builder({ data: [{ item_id: source.id, tag_id: "t1" }] });
        tags.insert = (rows: unknown) => {
          insert(rows);
          return builder({ error: null });
        };
        return tags;
      }
      const b = builder({ data: [source] });
      // First call selects the sources, then the first-position query; later ones write.
      b.insert = (rows: unknown) => {
        insert(rows);
        return builder({ error: insertError ?? null });
      };
      b.delete = () => {
        del();
        return builder({ error: null });
      };
      return b;
    },
    storage: { from: () => ({ copy, remove }) },
  };
  return { insert, del, remove, copy };
}

function cachedIds(queryClient: ReturnType<typeof makeTestQueryClient>): string[] {
  const data = queryClient.getQueryData<{ pages: ItemsPage[] }>(
    itemsQueryKey({ type: "inbox" }, "manual"),
  );
  return data?.pages.flatMap((page) => page.items.map((item) => item.id)) ?? [];
}

function render() {
  const queryClient = makeTestQueryClient();
  queryClient.setQueryData(itemsQueryKey({ type: "inbox" }, "manual"), {
    pages: [{ items: [], nextCursor: null }],
    pageParams: [null],
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => usePasteCopies(null), { wrapper });
  return { queryClient, paste: hook.result };
}

beforeEach(() => {
  vi.clearAllMocks();
  resetCaptureStateForTests();
});

const request = { placements: [{ id: "orig", x: 1, y: 2 }], z: 3, verb: "Pasted" as const };

describe("usePasteCopies", () => {
  it("inserts one batch, copies tags, selects via onCreated and offers Undo", async () => {
    const file = makeItem({
      id: "orig",
      user_id: "u1",
      kind: "image",
      file_name: "p.png",
      file_path: "u1/orig/p.png",
    });
    const { insert, copy } = setup({ source: file });
    const { queryClient, paste } = render();
    const onCreated = vi.fn();

    let created: string[] = [];
    await act(async () => {
      created = await paste.current({ ...request, onCreated });
    });

    expect(created).toHaveLength(1);
    expect(onCreated).toHaveBeenCalledWith(created);
    expect(copy).toHaveBeenCalledWith("u1/orig/p.png", `u1/${created[0]}/p.png`);
    expect(insert).toHaveBeenCalledTimes(2); // items, then item_tags
    expect(cachedIds(queryClient)).toEqual(created);
    expect(mocks.undoToast).toHaveBeenCalledWith("Pasted 1 item", expect.any(Function));
  });

  it("rolls the caches back and removes copied files when the insert fails", async () => {
    const file = makeItem({ id: "orig", file_name: "p.png", file_path: "u1/orig/p.png" });
    const { remove } = setup({ source: file, insertError: { message: "boom" } });
    const { queryClient, paste } = render();

    let created: string[] = ["x"];
    await act(async () => {
      created = await paste.current(request);
    });

    expect(created).toEqual([]);
    expect(cachedIds(queryClient)).toEqual([]);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(mocks.toast.error).toHaveBeenCalledWith("Couldn't paste those items.");
    expect(mocks.undoToast).not.toHaveBeenCalled();
  });

  it("shows the guest quota copy when the storage copy hits the quota", async () => {
    const file = makeItem({ id: "orig", file_name: "p.png", file_path: "u1/orig/p.png" });
    setup({ source: file, copyError: { message: "database error, code: P0001" } });
    const { queryClient, paste } = render();

    await act(async () => {
      await paste.current(request);
    });

    expect(cachedIds(queryClient)).toEqual([]);
    expect(mocks.toast.error).toHaveBeenCalledWith(GUEST_QUOTA_COPY);
  });

  it("says nothing to paste when every source is gone", async () => {
    mocks.client.current = {
      from: () => builder({ data: [] }),
      storage: { from: () => ({}) },
    };
    const { paste } = render();
    await act(async () => {
      await paste.current(request);
    });
    expect(mocks.toast).toHaveBeenCalledWith("Nothing to paste.");
  });
});
