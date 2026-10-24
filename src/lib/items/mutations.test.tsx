import { QueryClientProvider, type InfiniteData } from "@tanstack/react-query";
import { act, renderHook, screen, waitFor, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Board } from "@/components/board/board";
import { ViewerProvider } from "@/components/providers/viewer-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { SidebarCounts } from "@/lib/sidebar/counts";
import type { UnfurlResult } from "@/lib/unfurl/types";
import type { ViewSpec } from "@/lib/views";
import { useUiStore } from "@/stores/ui-store";
import { useUploadStore } from "@/stores/upload-store";
import { makeCounts, makeItem, makeTestQueryClient } from "@/test/fixtures";
import {
  guestQuotaCopy,
  buildFileRow,
  buildLinkRow,
  buildNoteRow,
  captureTargetFor,
  isGuestQuotaError,
  reservePositions,
  resetCaptureStateForTests,
  unfurlPatch,
  uploadErrorMessage,
  useCapture,
  insertIntoCaches,
} from "./mutations";
import { itemsQueryKey, ITEM_COLUMNS, type BoardItem, type ItemsPage } from "./queries";
import { UploadError, thumbnailPath } from "./upload";

const USER = "22222222-2222-4222-8222-222222222222";
const COLLECTION = "33333333-3333-4333-8333-333333333333";
const URL_A = "https://example.com/post";
const INBOX: ViewSpec = { type: "inbox" };

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
  uploadFile: vi.fn(),
  createThumbnail: vi.fn(),
  attachTagNames: vi.fn(async () => {}),
  client: undefined as unknown,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  usePathname: () => "/app",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => mocks.client }));
vi.mock("./upload", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./upload")>()),
  uploadFile: mocks.uploadFile,
}));
vi.mock("./thumbnails", () => ({ createThumbnail: mocks.createThumbnail }));
vi.mock("@/lib/tags/mutations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tags/mutations")>()),
  attachTagNames: mocks.attachTagNames,
}));

// ---------------------------------------------------------------------------
// A Supabase stand-in whose insert and update results the test can hold back
// ---------------------------------------------------------------------------

type Result = { data?: unknown; error: unknown };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

function makeFakeClient(initialRows: BoardItem[]) {
  const state = {
    serverRows: [...initialRows],
    inserts: [] as BoardItem[],
    updates: [] as { id: string; patch: Partial<BoardItem> }[],
    deletes: [] as string[],
    insertResult: (): Promise<Result> | Result => ({ error: null }),
    updateResult: (): Promise<Result> | Result => ({ error: null }),
    deleteResult: (): Promise<Result> | Result => ({ error: null }),
  };

  function from(table: string) {
    const query = {
      op: "select" as "select" | "insert" | "update" | "delete",
      columns: "",
      row: undefined as BoardItem | undefined,
      patch: undefined as Partial<BoardItem> | undefined,
      id: "",
    };
    const chain = {
      select(columns: string) {
        if (query.op === "select") query.columns = columns;
        return chain;
      },
      insert(row: BoardItem) {
        query.op = "insert";
        query.row = row;
        return chain;
      },
      update(patch: Partial<BoardItem>) {
        query.op = "update";
        query.patch = patch;
        return chain;
      },
      delete() {
        query.op = "delete";
        return chain;
      },
      eq(_column: string, value: string) {
        query.id = value;
        return chain;
      },
      is: () => chain,
      not: () => chain,
      or: () => chain,
      order: () => chain,
      limit: () => chain,
      overrideTypes: () => chain,
      then(resolve: (value: Result) => void, reject: (reason: unknown) => void) {
        return run().then(resolve, reject);
      },
    };

    async function run(): Promise<Result> {
      if (table === "item_counts") return { data: [], error: null };
      switch (query.op) {
        case "insert": {
          const row = query.row as BoardItem;
          state.inserts.push(row);
          const result = await state.insertResult();
          if (!result.error) state.serverRows.unshift(row);
          return result;
        }
        case "update": {
          state.updates.push({ id: query.id, patch: query.patch as Partial<BoardItem> });
          const result = await state.updateResult();
          if (!result.error) {
            state.serverRows = state.serverRows.map((row) =>
              row.id === query.id ? { ...row, ...query.patch } : row,
            );
          }
          return result;
        }
        case "delete": {
          state.deletes.push(query.id);
          const result = await state.deleteResult();
          if (!result.error)
            state.serverRows = state.serverRows.filter((row) => row.id !== query.id);
          return result;
        }
        case "select": {
          if (query.columns === "position") {
            const first = state.serverRows.map((row) => row.position).sort()[0];
            return { data: first ? [{ position: first }] : [], error: null };
          }
          expect(query.columns).toBe(ITEM_COLUMNS);
          return { data: state.serverRows, error: null };
        }
      }
    }
    return chain;
  }

  const client = {
    from,
    storage: { from: () => ({ createSignedUrls: async () => ({ data: [], error: null }) }) },
  };
  return { client, state };
}

const RESULT: UnfurlResult = {
  url: URL_A,
  finalUrl: URL_A,
  canonicalUrl: null,
  title: "Example post",
  description: "About things",
  siteName: "Example",
  imageUrl: "https://example.com/og.png",
  faviconUrl: "https://example.com/icon.png",
  isArticle: true,
  provider: null,
  metadata: { author: "Ada" },
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

const fetchMock = vi.fn();

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EXISTING = makeItem({
  id: "00000000-0000-4000-8000-000000000001",
  title: "Existing",
  position: "a5",
});
const SEEDED_COUNTS = makeCounts({ inbox: 1, all: 1, unread: 1, kinds: { note: 1 } });

function setup({ isGuest = false, view = INBOX }: { isGuest?: boolean; view?: ViewSpec } = {}) {
  const fake = makeFakeClient([EXISTING]);
  mocks.client = fake.client;
  const queryClient = makeTestQueryClient();
  const seed = (key: ReturnType<typeof itemsQueryKey>) =>
    queryClient.setQueryData<InfiniteData<ItemsPage>>(key, {
      pages: [{ items: [EXISTING], nextCursor: null }],
      pageParams: [null],
    });
  seed(itemsQueryKey(INBOX, "manual"));
  seed(itemsQueryKey({ type: "all" }, "newest"));
  seed(itemsQueryKey({ type: "all" }, "title"));
  seed(itemsQueryKey({ type: "favorites" }, "manual"));
  queryClient.setQueryData<SidebarCounts>(["counts"], SEEDED_COUNTS);

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <TooltipProvider>
        <QueryClientProvider client={queryClient}>
          <ViewerProvider userId={USER} isGuest={isGuest}>
            {children}
          </ViewerProvider>
        </QueryClientProvider>
      </TooltipProvider>
    );
  }
  const hook = renderHook(() => useCapture(view), { wrapper: Wrapper });
  const ids = (key: ReturnType<typeof itemsQueryKey>) =>
    queryClient.getQueryData<InfiniteData<ItemsPage>>(key)?.pages[0]?.items.map((i) => i.id);
  return { fake, queryClient, capture: hook.result, Wrapper, ids };
}

function file(name: string, type: string, size = 100): File {
  const f = new File(["x"], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
}

beforeEach(() => {
  resetCaptureStateForTests();
  vi.clearAllMocks();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  mocks.uploadFile.mockResolvedValue(undefined);
  mocks.createThumbnail.mockResolvedValue(null);
  mocks.attachTagNames.mockReset();
  mocks.attachTagNames.mockResolvedValue(undefined);
  useUploadStore.setState({ progress: {} });
  useUiStore.setState({ viewMode: "grid", selectedIds: [] });
});

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

describe("captureTargetFor", () => {
  it("saves into a collection view's collection and everywhere else into the Inbox", () => {
    expect(captureTargetFor({ type: "collection", collectionId: COLLECTION })).toEqual({
      collectionId: COLLECTION,
    });
    for (const view of [
      { type: "inbox" },
      { type: "all" },
      { type: "favorites" },
      { type: "trash" },
      { type: "kind", kind: "pdf" },
      { type: "tag", tagId: COLLECTION },
      { type: "smart", viewId: COLLECTION },
    ] as ViewSpec[]) {
      expect(captureTargetFor(view)).toEqual({ collectionId: null });
    }
  });
});

describe("row builders", () => {
  const base = { id: "id-1", userId: USER, collectionId: null, now: "2026-02-01T00:00:00.000Z" };

  it("builds a pending link row", () => {
    const row = buildLinkRow(base, "https://www.youtube.com/watch?v=abc");
    expect(row).toMatchObject({
      id: "id-1",
      user_id: USER,
      kind: "video",
      url: "https://www.youtube.com/watch?v=abc",
      domain: "youtube.com",
      title: null,
      enrich_status: "pending",
      is_read: false,
      metadata: {},
      canvas_z: 0,
      created_at: base.now,
      updated_at: base.now,
    });
  });

  it("builds a finished note row with trimmed text and inner newlines kept", () => {
    expect(buildNoteRow(base, "  one\ntwo \n")).toMatchObject({
      kind: "note",
      note: "one\ntwo",
      title: null,
      enrich_status: "done",
    });
  });

  it("builds a file row with a storage path and a title without the extension", () => {
    const row = buildFileRow(
      { ...base, collectionId: COLLECTION },
      file("Canción final.PDF", "application/pdf", 42),
    );
    expect(row).toMatchObject({
      kind: "pdf",
      file_name: "Canción final.PDF",
      mime_type: "application/pdf",
      file_size: 42,
      file_path: `${USER}/id-1/Cancion_final.PDF`,
      title: "Canción final",
      collection_id: COLLECTION,
      enrich_status: "pending",
    });
    expect(buildFileRow(base, file("notes.md", "", 1)).mime_type).toBe("application/octet-stream");
    expect(buildFileRow(base, file(".env", "", 1)).title).toBe(".env");
  });
});

describe("reservePositions", () => {
  it("hands out ordered keys before the first item and before earlier reservations", async () => {
    const { fake } = setup();
    const first = await reservePositions(fake.client as never, 3);
    expect(first).toHaveLength(3);
    expect([...first].sort()).toEqual(first);
    expect(first.every((key) => key < "a5")).toBe(true);
    const next = await reservePositions(fake.client as never, 2);
    expect(next.every((key) => key < (first[0] ?? ""))).toBe(true);
  });
});

describe("unfurlPatch", () => {
  it("maps the result and refines the kind", () => {
    expect(unfurlPatch("link", RESULT)).toEqual({
      kind: "article",
      title: "Example post",
      description: "About things",
      image_url: "https://example.com/og.png",
      favicon_url: "https://example.com/icon.png",
      site_name: "Example",
      metadata: { author: "Ada", provider: null, canonicalUrl: null, finalUrl: URL_A },
      enrich_status: "done",
    });
  });

  it("skips null fields and keeps non-link kinds", () => {
    const patch = unfurlPatch("video", {
      ...RESULT,
      title: null,
      description: null,
      imageUrl: null,
      faviconUrl: null,
      siteName: null,
    });
    expect(patch).not.toHaveProperty("title");
    expect(patch).not.toHaveProperty("image_url");
    expect(patch.kind).toBe("video");
  });
});

describe("error copy", () => {
  it("has the toast copy per upload code", () => {
    expect(uploadErrorMessage("too_large", "a")).toBe("Files can be up to 50 MB.");
    expect(uploadErrorMessage("guest_file_too_large", "a")).toBe("Guest files can be up to 10 MB.");
    expect(uploadErrorMessage("guest_quota", "a")).toBe(guestQuotaCopy());
    expect(uploadErrorMessage("network", "a.pdf")).toBe("Couldn't upload a.pdf.");
    expect(uploadErrorMessage("unknown", "a.pdf")).toBe("Couldn't upload a.pdf.");
  });

  it("recognizes the guest quota error", () => {
    expect(isGuestQuotaError({ message: "guest_quota_exceeded", code: "P0001" })).toBe(true);
    expect(isGuestQuotaError({ message: "boom" })).toBe(false);
    expect(isGuestQuotaError(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Link: optimistic card, then enrichment
// ---------------------------------------------------------------------------

describe("capturing a link", () => {
  it("shows the card before the insert resolves, then enriches it in place", async () => {
    const fake = makeFakeClient([EXISTING]);
    mocks.client = fake.client;
    const insertGate = deferred<Result>();
    fake.state.insertResult = () => insertGate.promise;
    const unfurlGate = deferred<Response>();
    fetchMock.mockReturnValue(unfurlGate.promise);

    const queryClient = makeTestQueryClient();
    queryClient.setQueryData<InfiniteData<ItemsPage>>(itemsQueryKey(INBOX, "manual"), {
      pages: [{ items: [EXISTING], nextCursor: null }],
      pageParams: [null],
    });
    queryClient.setQueryData(["counts"], SEEDED_COUNTS);

    let saved: Promise<void> | undefined;
    function Harness() {
      const capture = useCapture(INBOX);
      return <button onClick={() => (saved = capture.captureLink(URL_A))}>save</button>;
    }
    render(
      <TooltipProvider>
        <QueryClientProvider client={queryClient}>
          <ViewerProvider userId={USER} isGuest={false}>
            <Harness />
            <Board view={INBOX} sort="manual" />
          </ViewerProvider>
        </QueryClientProvider>
      </TooltipProvider>,
    );
    expect(screen.getByText("Existing")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "save" }));

    // The insert is still pending, yet the card is on screen and in the cache.
    const card = await screen.findByText(URL_A);
    await waitFor(() => expect(fake.state.inserts).toHaveLength(1));
    expect(card.closest("[data-slot='item-tile']")).toHaveAttribute(
      "data-enrich-status",
      "pending",
    );
    const cached = queryClient.getQueryData<InfiniteData<ItemsPage>>(
      itemsQueryKey(INBOX, "manual"),
    );
    expect(cached?.pages[0]?.items.map((i) => i.url)).toEqual([URL_A, null]);
    expect(queryClient.getQueryData<SidebarCounts>(["counts"])).toMatchObject({ inbox: 2, all: 2 });
    expect(fetchMock).not.toHaveBeenCalled();

    // The row is inserted with a position before the current first item.
    expect((fake.state.inserts[0]?.position ?? "") < "a5").toBe(true);
    expect(fake.state.inserts[0]).toMatchObject({
      user_id: USER,
      collection_id: null,
      kind: "link",
    });

    // Insert resolves -> unfurl starts.
    insertGate.resolve({ error: null });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/unfurl");
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1].body)).toEqual({ url: URL_A });
    expect(screen.getByText(URL_A)).toBeInTheDocument();

    // Unfurl resolves -> the same card shows the title and is done.
    unfurlGate.resolve(jsonResponse(RESULT));
    expect(await screen.findByText("Example post")).toBeInTheDocument();
    const enriched = screen.getByText("Example post").closest("[data-slot='item-tile']");
    expect(enriched).toHaveAttribute("data-enrich-status", "done");
    expect(enriched).toHaveAttribute("data-item-id", fake.state.inserts[0]?.id);

    await act(async () => {
      await saved;
    });
    expect(fake.state.updates).toHaveLength(1);
    expect(fake.state.updates[0]?.patch).toMatchObject({
      title: "Example post",
      kind: "article",
      enrich_status: "done",
    });
    // The final refetch agrees with the patch.
    expect(screen.getByText("Example post")).toBeInTheDocument();
    expect(mocks.toast.error).not.toHaveBeenCalled();
  });

  it("marks the card failed with a favicon fallback when the unfurl fails", async () => {
    const { fake, capture, queryClient } = setup();
    fetchMock.mockResolvedValue(jsonResponse({ error: "unreachable" }, 502));
    await act(() => capture.current.captureLink(URL_A));

    expect(fake.state.updates[0]?.patch).toEqual({
      enrich_status: "failed",
      favicon_url: "https://example.com/favicon.ico",
    });
    const row = queryClient
      .getQueryData<InfiniteData<ItemsPage>>(itemsQueryKey(INBOX, "manual"))
      ?.pages[0]?.items.find((i) => i.url === URL_A);
    expect(row).toMatchObject({ enrich_status: "failed", title: null });
    expect(mocks.toast.error).not.toHaveBeenCalled();
  });

  it("also fails on a network error, and explains a 429", async () => {
    const first = setup();
    fetchMock.mockRejectedValue(new TypeError("offline"));
    await act(() => first.capture.current.captureLink(URL_A));
    expect(first.fake.state.updates[0]?.patch).toMatchObject({ enrich_status: "failed" });

    const second = setup();
    fetchMock.mockResolvedValue(jsonResponse({ error: "rate_limited" }, 429));
    await act(() => second.capture.current.captureLink(URL_A));
    expect(second.fake.state.updates[0]?.patch).toMatchObject({ enrich_status: "failed" });
    expect(mocks.toast.error).toHaveBeenCalledWith(
      "Too many links saved in the last hour. Try again later.",
    );
  });

  it("retries a failed link once, even if asked twice", async () => {
    const { fake, capture } = setup();
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "unreachable" }, 502));
    await act(() => capture.current.captureLink(URL_A));
    const failed = fake.state.serverRows.find((r) => r.url === URL_A) as BoardItem;
    expect(failed.enrich_status).toBe("failed");

    const gate = deferred<Response>();
    fetchMock.mockReset();
    fetchMock.mockReturnValue(gate.promise);
    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = capture.current.retryEnrich(failed);
      second = capture.current.retryEnrich(failed);
    });
    gate.resolve(jsonResponse(RESULT));
    await act(async () => {
      await Promise.all([first, second]);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fake.state.serverRows.find((r) => r.url === URL_A)).toMatchObject({
      enrich_status: "done",
      title: "Example post",
    });
  });

  it("does not retry an item without a URL", async () => {
    const { capture } = setup();
    await act(() => capture.current.retryEnrich(makeItem({ kind: "pdf", file_path: "x/y/z.pdf" })));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("only adds the card to lists that show it in manual or newest order", async () => {
    const { fake, capture, ids, queryClient } = setup();
    const gate = deferred<Result>();
    fake.state.insertResult = () => gate.promise;
    fetchMock.mockResolvedValue(jsonResponse(RESULT));

    let saved!: Promise<void>;
    act(() => {
      saved = capture.current.captureLink(URL_A);
    });
    await waitFor(() => expect(fake.state.inserts).toHaveLength(1));
    const id = fake.state.inserts[0]?.id as string;

    expect(ids(itemsQueryKey(INBOX, "manual"))?.[0]).toBe(id);
    expect(ids(itemsQueryKey({ type: "all" }, "newest"))?.[0]).toBe(id);
    expect(ids(itemsQueryKey({ type: "all" }, "title"))).toEqual([EXISTING.id]);
    expect(ids(itemsQueryKey({ type: "favorites" }, "manual"))).toEqual([EXISTING.id]);

    gate.resolve({ error: null });
    await act(async () => {
      await saved;
    });
    expect(queryClient.isFetching()).toBe(0);
  });

  it("does not refetch while another capture is still running, so its card stays", async () => {
    const { capture, queryClient, ids } = setup();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const unfurl = deferred<Response>();
    fetchMock.mockReturnValue(unfurl.promise);

    let linkDone!: Promise<void>;
    await act(async () => {
      linkDone = capture.current.captureLink(URL_A);
      await capture.current.captureNote("quick note");
    });
    // The note finished first, but the link is still unfurling: no refetch yet.
    expect(invalidate).not.toHaveBeenCalled();
    expect(ids(itemsQueryKey(INBOX, "manual"))).toHaveLength(3);

    await act(async () => {
      unfurl.resolve(jsonResponse(RESULT));
      await linkDone;
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["items"] });
  });

  it("keeps quick successive captures in order with unique, decreasing positions", async () => {
    const { fake, capture } = setup();
    fetchMock.mockResolvedValue(jsonResponse(RESULT));
    await act(async () => {
      await Promise.all([
        capture.current.captureNote("one"),
        capture.current.captureNote("two"),
        capture.current.captureNote("three"),
      ]);
    });
    const positions = fake.state.inserts.map((r) => r.position);
    expect(fake.state.inserts.map((r) => r.note)).toEqual(["one", "two", "three"]);
    for (let i = 1; i < positions.length; i += 1) {
      expect((positions[i] ?? "") < (positions[i - 1] ?? "")).toBe(true);
    }
    expect((positions[0] ?? "") < "a5").toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Notes and text
// ---------------------------------------------------------------------------

describe("capturing notes and text", () => {
  it("saves a note as done without any network enrichment", async () => {
    const { fake, capture } = setup();
    await act(() => capture.current.captureNote("  Buy milk\nand eggs "));
    expect(fake.state.inserts[0]).toMatchObject({
      kind: "note",
      note: "Buy milk\nand eggs",
      enrich_status: "done",
    });
    expect(fake.state.updates).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("saves a title and attaches tags only after the row is inserted", async () => {
    const { fake, capture } = setup();
    mocks.attachTagNames.mockImplementation(async () => {
      expect(fake.state.inserts).toHaveLength(1);
    });
    await act(() =>
      capture.current.captureNote("Read later #Thesis #ux", {
        title: "Read later",
        tagNames: ["Thesis", "ux"],
      }),
    );
    expect(fake.state.inserts[0]).toMatchObject({
      title: "Read later",
      note: "Read later #Thesis #ux",
    });
    expect(mocks.attachTagNames).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      fake.state.inserts[0]?.id,
      ["Thesis", "ux"],
    );
  });

  it("attaches no tags when the insert fails", async () => {
    const { fake, capture } = setup();
    fake.state.insertResult = () => ({ error: new Error("boom") });
    await act(() => capture.current.captureNote("x #ux", { title: "x", tagNames: ["ux"] }));
    expect(mocks.attachTagNames).not.toHaveBeenCalled();
  });

  it("ignores an empty note", async () => {
    const { fake, capture } = setup();
    await act(() => capture.current.captureNote("   "));
    expect(fake.state.inserts).toHaveLength(0);
  });

  it("saves an empty note only when asked to, and resolves with the item", async () => {
    const { fake, capture } = setup();
    let none: unknown = "unset";
    await act(async () => {
      none = await capture.current.captureNote("");
    });
    expect(none).toBeNull();
    expect(fake.state.inserts).toHaveLength(0);

    let saved: BoardItem | null = null;
    await act(async () => {
      saved = await capture.current.captureNote("", { allowEmpty: true });
    });
    expect(fake.state.inserts[0]).toMatchObject({ kind: "note", note: "" });
    expect((saved as BoardItem | null)?.id).toBe(fake.state.inserts[0]?.id);
  });

  it("writes canvas_x/y only when given a point, centering the default-size card on it", async () => {
    const { fake, capture } = setup();
    await act(() => capture.current.captureNote("plain"));
    expect(fake.state.inserts[0]).toMatchObject({ canvas_x: null, canvas_y: null });

    // A note is 240 x 160 by default.
    await act(() => capture.current.captureNote("here", { canvasAt: { x: 500, y: 300 } }));
    expect(fake.state.inserts[1]).toMatchObject({
      canvas_x: 380,
      canvas_y: 220,
      canvas_w: null,
      canvas_h: null,
    });

    fetchMock.mockResolvedValue(jsonResponse(RESULT));
    await act(() =>
      capture.current.captureLink("https://example.com/post", { canvasAt: { x: 0, y: 0 } }),
    );
    // A link is 280 x 240.
    expect(fake.state.inserts[2]).toMatchObject({ canvas_x: -140, canvas_y: -120 });

    await act(() =>
      capture.current.captureFile(file("a.pdf", "application/pdf"), {
        canvasAt: { x: 100, y: 100 },
      }),
    );
    expect(fake.state.inserts[3]?.canvas_x).not.toBeNull();
  });

  it("snaps the corner, not the center, when the target says so", async () => {
    const { fake, capture } = setup();
    fetchMock.mockResolvedValue(jsonResponse(RESULT));
    // A link is 280 x 240: centered on (503, 305) its corner is (363, 185), which snaps to (360, 184).
    await act(() =>
      capture.current.captureLink("https://example.com/post", {
        canvasAt: { x: 503, y: 305, snap: true },
      }),
    );
    expect(fake.state.inserts[0]).toMatchObject({ canvas_x: 360, canvas_y: 184 });
  });

  it("routes text to a link or a note", async () => {
    const { fake, capture } = setup();
    fetchMock.mockResolvedValue(jsonResponse(RESULT));
    await act(() => capture.current.captureText("  https://example.com/post  "));
    await act(() => capture.current.captureText("not a link"));
    expect(fake.state.inserts.map((r) => r.kind)).toEqual(["link", "note"]);
    expect(fake.state.inserts[0]?.url).toBe(URL_A);
  });

  it("saves into the collection of a collection view", async () => {
    const { fake, capture } = setup({ view: { type: "collection", collectionId: COLLECTION } });
    await act(() => capture.current.captureNote("hello"));
    expect(fake.state.inserts[0]?.collection_id).toBe(COLLECTION);
    expect(mocks.toast).not.toHaveBeenCalled();
  });

  it("says where it went when the current view will not show the item", async () => {
    const { capture } = setup({ view: { type: "favorites" } });
    await act(() => capture.current.captureNote("hello"));
    expect(mocks.toast).toHaveBeenCalledTimes(1);
    const [message, options] = mocks.toast.mock.calls[0] as [
      string,
      { action: { label: string; onClick: () => void } },
    ];
    expect(message).toBe("Saved to Inbox");
    expect(options.action.label).toBe("Open");
    options.action.onClick();
    expect(mocks.push).toHaveBeenCalledWith("/app");
  });
});

// ---------------------------------------------------------------------------
// Rollback
// ---------------------------------------------------------------------------

describe("insert failure", () => {
  it("restores the lists and counts and shows a toast", async () => {
    const { fake, capture, queryClient, ids } = setup();
    fake.state.insertResult = () => ({ error: { message: "boom", code: "XX000" } });
    await act(() => capture.current.captureLink(URL_A));

    expect(ids(itemsQueryKey(INBOX, "manual"))).toEqual([EXISTING.id]);
    expect(ids(itemsQueryKey({ type: "all" }, "newest"))).toEqual([EXISTING.id]);
    expect(queryClient.getQueryData(["counts"])).toEqual(SEEDED_COUNTS);
    expect(mocks.toast.error).toHaveBeenCalledWith("Couldn't save that.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the guest quota copy for guest_quota_exceeded", async () => {
    const { fake, capture, ids } = setup({ isGuest: true });
    fake.state.insertResult = () => ({ error: { message: "guest_quota_exceeded", code: "P0001" } });
    await act(() => capture.current.captureFile(file("a.pdf", "application/pdf", 1000)));

    expect(mocks.toast.error).toHaveBeenCalledWith(guestQuotaCopy(), {
      action: { label: "Add email", onClick: expect.any(Function) },
    });
    expect(ids(itemsQueryKey(INBOX, "manual"))).toEqual([EXISTING.id]);
    expect(mocks.uploadFile).not.toHaveBeenCalled();
  });

  it("opens the upgrade dialog from the quota toast's Add email action", async () => {
    const { fake, capture } = setup({ isGuest: true });
    fake.state.insertResult = () => ({ error: { message: "guest_quota_exceeded", code: "P0001" } });
    await act(() => capture.current.captureFile(file("a.pdf", "application/pdf", 1000)));

    const options = mocks.toast.error.mock.calls[0]?.[1] as {
      action: { onClick: () => void };
    };
    expect(useUiStore.getState().upgradeOpen).toBe(false);
    options.action.onClick();
    expect(useUiStore.getState().upgradeOpen).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

describe("capturing a file", () => {
  it("uploads, adds a thumbnail with its real type, and finishes the card", async () => {
    const { fake, capture, queryClient } = setup();
    mocks.createThumbnail.mockResolvedValue(new Blob(["png"], { type: "image/png" }));
    const seenProgress: unknown[] = [];
    mocks.uploadFile.mockImplementation(
      async (args: { path: string; onProgress?: (p: unknown) => void }) => {
        if (args.onProgress) {
          args.onProgress({ loaded: 1, total: 2 });
          seenProgress.push(Object.values(useUploadStore.getState().progress)[0]);
        }
      },
    );

    await act(() => capture.current.captureFile(file("pic.png", "image/png", 2000)));

    const row = fake.state.inserts[0] as BoardItem;
    expect(row).toMatchObject({
      kind: "image",
      file_name: "pic.png",
      title: "pic",
      enrich_status: "pending",
    });
    expect(mocks.uploadFile).toHaveBeenCalledTimes(2);
    const [main, thumb] = mocks.uploadFile.mock.calls.map((c) => c[0]);
    expect(main).toMatchObject({ path: row.file_path, contentType: "image/png", isGuest: false });
    expect(thumb.path).toBe(thumbnailPath(USER, row.id));
    expect(thumb.contentType).toBe("image/png");
    expect(thumb.file.type).toBe("image/png");
    expect(seenProgress).toEqual([{ loaded: 1, total: 2 }]);
    expect(useUploadStore.getState().progress).toEqual({});

    expect(fake.state.updates[0]?.patch).toEqual({
      thumbnail_path: thumbnailPath(USER, row.id),
      enrich_status: "done",
    });
    const cachedRow = queryClient
      .getQueryData<InfiniteData<ItemsPage>>(itemsQueryKey(INBOX, "manual"))
      ?.pages[0]?.items.find((i) => i.id === row.id);
    expect(cachedRow).toMatchObject({ enrich_status: "done" });
  });

  it("stores the natural size of a raster image and sizes the card from it", async () => {
    const close = vi.fn();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => ({ width: 800, height: 400, close })),
    );
    try {
      const { fake, capture } = setup();
      await act(() =>
        capture.current.captureFile(file("wide.png", "image/png"), {
          canvasAt: { x: 500, y: 300 },
        }),
      );
      const row = fake.state.inserts[0] as BoardItem;
      expect(row.metadata).toMatchObject({ width: 800, height: 400 });
      expect(close).toHaveBeenCalled();
      // 320 wide, 160 high from the aspect ratio: centered on (500, 300) the corner is (340, 220).
      expect(row).toMatchObject({ canvas_x: 340, canvas_y: 220 });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("reserves an image's position before reading its size, so call order wins", async () => {
    let finishDecode: (size: {
      width: number;
      height: number;
      close: () => void;
    }) => void = () => {};
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(() => new Promise((resolve) => (finishDecode = resolve))),
    );
    try {
      const { fake, capture } = setup();
      await act(async () => {
        const image = capture.current.captureFile(file("slow.png", "image/png"));
        const note = capture.current.captureNote("after");
        await note;
        finishDecode({ width: 10, height: 10, close: () => {} });
        await image;
      });
      const byKind = new Map(fake.state.inserts.map((row) => [row.kind, row.position ?? ""]));
      // Called first, so its key is handed out first and the note's sorts before it.
      expect((byKind.get("note") ?? "") < (byKind.get("image") ?? "")).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("skips SVGs and images the browser cannot decode", async () => {
    const decode = vi.fn(async () => {
      throw new Error("bad image");
    });
    vi.stubGlobal("createImageBitmap", decode);
    try {
      const { fake, capture } = setup();
      await act(() => capture.current.captureFile(file("a.svg", "image/svg+xml")));
      await act(() => capture.current.captureFile(file("broken.png", "image/png")));
      expect(decode).toHaveBeenCalledTimes(1);
      expect(fake.state.inserts[0]?.metadata).toEqual({});
      expect(fake.state.inserts[1]?.metadata).toEqual({});
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("finishes without a thumbnail when there is none or its upload fails", async () => {
    const { fake, capture } = setup();
    mocks.createThumbnail.mockResolvedValue(new Blob(["w"], { type: "image/webp" }));
    mocks.uploadFile
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new UploadError("network"));
    await act(() => capture.current.captureFile(file("pic.png", "image/png")));

    expect(fake.state.updates[0]?.patch).toEqual({ thumbnail_path: null, enrich_status: "done" });
    expect(mocks.toast.error).not.toHaveBeenCalled();
  });

  it.each([
    ["too_large", "Files can be up to 50 MB.", undefined],
    ["guest_file_too_large", "Guest files can be up to 10 MB.", undefined],
    ["guest_quota", guestQuotaCopy(), "Add email"],
    ["network", "Couldn't upload a.pdf.", "Retry"],
    ["unknown", "Couldn't upload a.pdf.", "Retry"],
  ] as const)(
    "rolls the card back when the upload fails with %s",
    async (code, message, actionLabel) => {
      const { fake, capture, queryClient, ids } = setup({ isGuest: true });
      mocks.uploadFile.mockRejectedValue(new UploadError(code));
      await act(() => capture.current.captureFile(file("a.pdf", "application/pdf", 1000)));

      const id = fake.state.inserts[0]?.id as string;
      expect(fake.state.deletes).toEqual([id]);
      expect(ids(itemsQueryKey(INBOX, "manual"))).toEqual([EXISTING.id]);
      expect(queryClient.getQueryData(["counts"])).toEqual(SEEDED_COUNTS);
      expect(useUploadStore.getState().progress).toEqual({});
      expect(mocks.createThumbnail).not.toHaveBeenCalled();

      const call = mocks.toast.error.mock.calls[0] as [
        string,
        { action?: { label: string; onClick: () => void } }?,
      ];
      expect(call[0]).toBe(message);
      expect(call[1]?.action?.label).toBe(actionLabel);
    },
  );

  it("marks the row failed when the rollback delete fails too", async () => {
    const { fake, capture } = setup();
    mocks.uploadFile.mockRejectedValue(new UploadError("network"));
    fake.state.deleteResult = () => ({ error: { message: "offline" } });
    await act(() => capture.current.captureFile(file("a.pdf", "application/pdf", 1000)));

    const id = fake.state.inserts[0]?.id as string;
    expect(fake.state.deletes).toEqual([id]);
    expect(fake.state.updates).toContainEqual({ id, patch: { enrich_status: "failed" } });
  });

  it("runs the capture again from the Retry action", async () => {
    const { fake, capture } = setup();
    mocks.uploadFile.mockRejectedValueOnce(new UploadError("network"));
    const pdf = file("a.pdf", "application/pdf", 1000);
    await act(() => capture.current.captureFile(pdf));

    const options = mocks.toast.error.mock.calls[0]?.[1] as { action: { onClick: () => void } };
    await act(async () => {
      options.action.onClick();
      await waitFor(() =>
        expect(fake.state.serverRows.some((r) => r.file_name === "a.pdf")).toBe(true),
      );
    });
    expect(fake.state.inserts).toHaveLength(2);
    expect(fake.state.inserts[1]?.id).not.toBe(fake.state.inserts[0]?.id);
  });

  it("refuses an oversized file before inserting anything", async () => {
    const { fake, capture } = setup();
    await act(() => capture.current.captureFile(file("huge.bin", "", 51 * 1024 * 1024)));
    expect(mocks.toast.error).toHaveBeenCalledWith("Files can be up to 50 MB.");
    expect(fake.state.inserts).toHaveLength(0);

    const guest = setup({ isGuest: true });
    mocks.toast.error.mockClear();
    await act(() => guest.capture.current.captureFile(file("big.bin", "", 11 * 1024 * 1024)));
    expect(mocks.toast.error).toHaveBeenCalledWith("Guest files can be up to 10 MB.");
    expect(guest.fake.state.inserts).toHaveLength(0);
  });
});

describe("insertIntoCaches", () => {
  it("prepends to matching plain lists but never to search results", () => {
    const queryClient = makeTestQueryClient();
    const empty = { pages: [{ items: [] as BoardItem[], nextCursor: null }], pageParams: [null] };
    const plainKey = itemsQueryKey({ type: "inbox" }, "manual");
    const searchKey = [...plainKey, { search: { text: "x" } }];
    queryClient.setQueryData(plainKey, empty);
    queryClient.setQueryData(searchKey, empty);
    const row = makeItem({ id: "00000000-0000-4000-8000-0000000000aa" });
    insertIntoCaches(queryClient, row);
    const ids = (key: readonly unknown[]) =>
      queryClient.getQueryData<InfiniteData<ItemsPage>>(key)?.pages[0]?.items.map((i) => i.id);
    expect(ids(plainKey)).toEqual([row.id]);
    expect(ids(searchKey)).toEqual([]);
  });
});
