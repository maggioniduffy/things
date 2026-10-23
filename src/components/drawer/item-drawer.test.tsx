import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { itemQueryKey, itemTagsQueryKey } from "@/lib/items/item-query";
import type { BoardItem } from "@/lib/items/queries";
import type { SidebarCollection, SidebarTag } from "@/lib/sidebar/queries";
import type { ViewSpec } from "@/lib/views";
import { useUploadStore } from "@/stores/upload-store";
import { makeItem, makeTestQueryClient } from "@/test/fixtures";
import { ItemDrawerHost } from "./item-drawer";

const ID = "11111111-1111-4111-8111-111111111111";
const COLLECTION = "33333333-3333-4333-8333-333333333333";
const TAG_A = "44444444-4444-4444-8444-444444444444";
const TAG_B = "55555555-5555-4555-8555-555555555555";
const YOUTUBE = "dQw4w9WgXcQ";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  params: new URLSearchParams(),
  toast: Object.assign(
    vi.fn<(message: string, options?: unknown) => string>(() => "toast-id"),
    { error: vi.fn(), dismiss: vi.fn() },
  ),
  client: undefined as unknown,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  usePathname: () => "/app/all",
  useSearchParams: () => mocks.params,
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => mocks.client }));

// ---------------------------------------------------------------------------
// A Supabase stand-in
// ---------------------------------------------------------------------------

type Result = { data?: unknown; error: unknown };

function makeFakeClient() {
  const state = {
    /** Rows `items.select().eq("id").maybeSingle()` can return. */
    rows: new Map<string, BoardItem>(),
    fetches: [] as string[],
    updates: [] as { id: string; patch: Partial<BoardItem> }[],
    deletes: [] as string[],
    removed: [] as string[][],
    signed: [] as { path: string; seconds: number; options: unknown }[],
    attached: [] as string[],
    tagInserts: [] as { item_id: string; tag_id: string }[],
    tagDeletes: [] as { item_id: string; tag_id: string }[],
    tagCreates: [] as { id: string; name: string }[],
    updateResult: (): Result => ({ error: null }),
  };
  const thenable = (run: () => Result | Promise<Result>) => ({
    then: (resolve: (value: Result) => void, reject: (reason: unknown) => void) =>
      Promise.resolve().then(run).then(resolve, reject),
  });

  const client = {
    from(table: string) {
      const chain = {
        select: () => chain,
        order: () => chain,
        eq: (_column: string, id: string) => {
          chain.id = id;
          return chain;
        },
        id: "",
        maybeSingle: () =>
          thenable(() => {
            state.fetches.push(chain.id);
            return { data: state.rows.get(chain.id) ?? null, error: null };
          }),
        then: (resolve: (value: Result) => void, reject: (reason: unknown) => void) =>
          Promise.resolve({
            data:
              table === "item_tags"
                ? state.attached.map((tag_id) => ({ tag_id }))
                : table === "tags"
                  ? [...TAGS, ...state.tagCreates.map((row) => ({ ...row, color: null }))]
                  : [],
            error: null,
          }).then(resolve, reject),
        update: (patch: Partial<BoardItem>) => ({
          eq: (_column: string, id: string) =>
            thenable(() => {
              state.updates.push({ id, patch });
              const result = state.updateResult();
              const row = state.rows.get(id);
              if (!result.error && row) state.rows.set(id, { ...row, ...patch });
              return result;
            }),
        }),
        delete: () => ({
          eq: (column: string, value: string) =>
            Object.assign(
              thenable(() => {
                if (table === "items") state.deletes.push(value);
                return { error: null };
              }),
              {
                in: (_column: string, tagIds: string[]) =>
                  thenable(() => {
                    for (const tagId of tagIds) {
                      state.tagDeletes.push({ item_id: value, tag_id: tagId });
                    }
                    state.attached = state.attached.filter((id) => !tagIds.includes(id));
                    void column;
                    return { error: null };
                  }),
              },
            ),
        }),
        upsert: (rows: { item_id: string; tag_id: string }[]) =>
          thenable(() => {
            state.tagInserts.push(...rows);
            state.attached.push(...rows.map((row) => row.tag_id));
            return { error: null };
          }),
        /** `tags` inserts: `insert(rows).select()`. */
        insert: (payload: { id: string; name: string } | { id: string; name: string }[]) => {
          const rows = Array.isArray(payload) ? payload : [payload];
          state.tagCreates.push(...rows);
          const created = rows.map((row) => ({ id: row.id, name: row.name, color: null }));
          return {
            select: () =>
              Object.assign(
                thenable(() => ({ data: created, error: null })),
                { single: () => thenable(() => ({ data: created[0], error: null })) },
              ),
          };
        },
      };
      return chain;
    },
    storage: {
      from: () => ({
        createSignedUrls: async (paths: string[]) => ({
          data: paths.map((path) => ({
            path,
            signedUrl: `https://signed.example/${path}?token=t`,
            error: null,
          })),
          error: null,
        }),
        createSignedUrl: async (path: string, seconds: number, options: unknown) => {
          state.signed.push({ path, seconds, options });
          return { data: { signedUrl: `https://signed.example/${path}?download=1` }, error: null };
        },
        remove: async (paths: string[]) => {
          state.removed.push(paths);
          return { error: null };
        },
      }),
    },
  };
  return { client, state };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const COLLECTIONS: SidebarCollection[] = [
  { id: COLLECTION, name: "Reading", emoji: "📚", color: null, position: "a0" },
];
const TAGS: SidebarTag[] = [
  { id: TAG_A, name: "alpha", color: null },
  { id: TAG_B, name: "beta", color: null },
];

type Options = {
  view?: ViewSpec;
  /** Seed the drawer's cache entry (a card click does this); false makes the drawer fetch it. */
  seeded?: boolean;
  attachedTags?: string[];
  /** false renders the host without `?item=`. */
  open?: boolean;
};

function renderDrawer(
  item: BoardItem | null,
  { view, seeded = true, attachedTags = [], open = true }: Options = {},
) {
  const fake = makeFakeClient();
  fake.state.attached = [...attachedTags];
  mocks.client = fake.client;
  mocks.params = open ? new URLSearchParams({ item: item?.id ?? ID }) : new URLSearchParams();
  const queryClient = makeTestQueryClient();
  queryClient.setQueryData(["collections"], COLLECTIONS);
  queryClient.setQueryData(["tags"], TAGS);
  queryClient.setQueryData(itemTagsQueryKey(item?.id ?? ID), attachedTags);
  if (item) {
    fake.state.rows.set(item.id, item);
    if (seeded) queryClient.setQueryData(itemQueryKey(item.id), item);
  }

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <TooltipProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </TooltipProvider>
    );
  }
  const utils = render(<ItemDrawerHost view={view ?? { type: "all" }} />, { wrapper: Wrapper });
  return { ...utils, ...fake, queryClient };
}

const NOTE = makeItem({ id: ID, kind: "note", title: "My note", note: "Some text", is_read: true });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.params = new URLSearchParams();
  useUploadStore.setState({ progress: {} });
});

describe("ItemDrawerHost", () => {
  it("renders nothing without ?item=", () => {
    renderDrawer(NOTE, { open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens as an accessible dialog titled with the item, and Esc asks to close it", async () => {
    renderDrawer(NOTE);
    const dialog = await screen.findByRole("dialog", { name: "My note" });
    expect(dialog).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(mocks.replace).toHaveBeenCalledWith("/app/all", { scroll: false });
  });

  it("has a Close button in the footer (mobile only via CSS) that closes the drawer", async () => {
    renderDrawer(NOTE);
    const dialog = await screen.findByRole("dialog", { name: "My note" });
    const buttons = within(dialog).getAllByRole("button", { name: "Close" });
    const footer = buttons.find((b) => b.className.includes("sm:hidden"));
    expect(footer).toBeDefined();
    await userEvent.click(footer!);
    expect(mocks.replace).toHaveBeenCalledWith("/app/all", { scroll: false });
  });

  it("fetches an item that is not in the cache by id", async () => {
    const { state } = renderDrawer(NOTE, { seeded: false });
    expect(await screen.findByRole("textbox", { name: "Title" })).toHaveValue("My note");
    expect(state.fetches).toEqual([ID]);
  });

  it("says the item isn't available for an unknown or foreign id, without crashing", async () => {
    renderDrawer(null);
    expect(await screen.findByText("This item isn't available")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(mocks.replace).toHaveBeenCalledWith("/app/all", { scroll: false });
  });

  it("does not query the database for an id that is not a uuid", async () => {
    mocks.params = new URLSearchParams({ item: "nope" });
    const fake = makeFakeClient();
    mocks.client = fake.client;
    const queryClient = makeTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <ItemDrawerHost view={{ type: "all" }} />
      </QueryClientProvider>,
    );
    expect(await screen.findByText("This item isn't available")).toBeInTheDocument();
    expect(fake.state.fetches).toEqual([]);
  });
});

describe("marking read", () => {
  it("marks an unread item read when it opens, once, even if the write fails and rolls back", async () => {
    const unread = makeItem({ ...NOTE, is_read: false });
    const { state } = renderDrawer(unread);
    state.updateResult = () => ({ error: new Error("boom") });
    await waitFor(() => expect(state.updates).toHaveLength(1));
    expect(state.updates[0]).toEqual({ id: ID, patch: { is_read: true } });
    // The failed write rolls the row back to unread; the drawer must not try again.
    await waitFor(() => expect(mocks.toast.error).toHaveBeenCalledWith("Couldn't mark as read."));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(state.updates).toHaveLength(1);
  });

  it("leaves an already read item alone", async () => {
    const { state } = renderDrawer(NOTE);
    await screen.findByRole("textbox", { name: "Title" });
    expect(state.updates).toEqual([]);
  });
});

describe("editing", () => {
  it("saves the title on blur and on Enter, and skips unchanged values", async () => {
    const { state } = renderDrawer(NOTE);
    const title = await screen.findByRole("textbox", { name: "Title" });

    await userEvent.click(title);
    await userEvent.tab();
    expect(state.updates).toEqual([]);

    await userEvent.clear(title);
    await userEvent.type(title, "Renamed{Enter}");
    await waitFor(() => expect(state.updates).toHaveLength(1));
    expect(state.updates[0]?.patch).toEqual({ title: "Renamed" });
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("Renamed");
  });

  it("turns #tags typed in the title into tags and strips them from the title", async () => {
    const { state } = renderDrawer(NOTE);
    const title = await screen.findByRole("textbox", { name: "Title" });
    await userEvent.clear(title);
    await userEvent.type(title, "Read later #ALPHA #fresh{Enter}");
    await waitFor(() => expect(state.updates[0]?.patch).toEqual({ title: "Read later" }));
    // "alpha" exists (any casing) and is reused; "fresh" is created; one insert attaches both.
    await waitFor(() => expect(state.tagInserts).toHaveLength(2));
    expect(state.tagCreates.map((row) => row.name)).toEqual(["fresh"]);
    expect(state.tagInserts[0]).toEqual({ item_id: ID, tag_id: TAG_A });
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("Read later");
  });

  it("keeps a title that is only tags as typed", async () => {
    const { state } = renderDrawer(NOTE);
    const title = await screen.findByRole("textbox", { name: "Title" });
    await userEvent.clear(title);
    await userEvent.type(title, "#beta{Enter}");
    await waitFor(() => expect(state.updates[0]?.patch).toEqual({ title: "#beta" }));
    await waitFor(() => expect(state.tagInserts).toEqual([{ item_id: ID, tag_id: TAG_B }]));
  });

  it("attaches #tags new to the note without changing the note text", async () => {
    const { state } = renderDrawer(NOTE);
    const note = await screen.findByRole("textbox", { name: "Note" });
    await userEvent.type(note, " #beta");
    await userEvent.tab();
    await waitFor(() => expect(state.updates[0]?.patch).toEqual({ note: "Some text #beta" }));
    await waitFor(() => expect(state.tagInserts).toEqual([{ item_id: ID, tag_id: TAG_B }]));
  });

  it("does not re-attach a #tag that was already in the note", async () => {
    const { state } = renderDrawer(makeItem({ ...NOTE, note: "Some #beta text" }));
    const note = await screen.findByRole("textbox", { name: "Note" });
    await userEvent.type(note, "!");
    await userEvent.tab();
    await waitFor(() => expect(state.updates).toHaveLength(1));
    expect(state.tagInserts).toEqual([]);
  });

  it("clears the title to null when emptied", async () => {
    const { state } = renderDrawer(NOTE);
    const title = await screen.findByRole("textbox", { name: "Title" });
    await userEvent.clear(title);
    await userEvent.tab();
    await waitFor(() => expect(state.updates[0]?.patch).toEqual({ title: null }));
  });

  it("saves the note text on blur", async () => {
    const { state } = renderDrawer(NOTE);
    const note = await screen.findByRole("textbox", { name: "Note" });
    expect(note).toHaveValue("Some text");
    await userEvent.type(note, " and more");
    await userEvent.tab();
    await waitFor(() => expect(state.updates).toHaveLength(1));
    expect(state.updates[0]?.patch).toEqual({ note: "Some text and more" });
  });

  it("changes the collection", async () => {
    const { state } = renderDrawer(NOTE);
    const select = await screen.findByRole("combobox", { name: "Collection" });
    await userEvent.selectOptions(select, COLLECTION);
    await waitFor(() => expect(state.updates[0]?.patch).toEqual({ collection_id: COLLECTION }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Collection" }), "");
    await waitFor(() => expect(state.updates[1]?.patch).toEqual({ collection_id: null }));
  });

  it("adds and removes existing tags", async () => {
    const { state } = renderDrawer(NOTE, { attachedTags: [TAG_A] });
    const list = await screen.findByRole("list", { name: "Tags" });
    expect(within(list).getByText("alpha")).toBeInTheDocument();
    // Only tags that are not attached yet can be added.
    const add = screen.getByRole("combobox", { name: "Add a tag" });
    expect(within(add).queryByRole("option", { name: "alpha" })).not.toBeInTheDocument();

    await userEvent.selectOptions(add, TAG_B);
    await waitFor(() => expect(state.tagInserts).toEqual([{ item_id: ID, tag_id: TAG_B }]));
    expect(await screen.findByText("beta")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Remove tag alpha" }));
    await waitFor(() => expect(state.tagDeletes).toEqual([{ item_id: ID, tag_id: TAG_A }]));
  });
});

describe("creating a tag in the drawer", () => {
  it("creates a new tag on Enter and attaches it", async () => {
    const { state } = renderDrawer(NOTE);
    const input = await screen.findByRole("textbox", { name: "New tag" });
    await userEvent.type(input, "#Fresh{Enter}");
    await waitFor(() => expect(state.tagCreates.map((row) => row.name)).toEqual(["Fresh"]));
    await waitFor(() => expect(state.tagInserts).toHaveLength(1));
    expect(state.tagInserts[0]?.item_id).toBe(ID);
    expect(state.tagInserts[0]?.tag_id).toBe(state.tagCreates[0]?.id);
    expect(input).toHaveValue("");
    expect(await screen.findByText("Fresh")).toBeInTheDocument();
  });

  it("attaches an existing tag typed in another casing instead of creating one", async () => {
    const { state } = renderDrawer(NOTE);
    await userEvent.type(await screen.findByRole("textbox", { name: "New tag" }), "BETA{Enter}");
    await waitFor(() => expect(state.tagInserts).toEqual([{ item_id: ID, tag_id: TAG_B }]));
    expect(state.tagCreates).toEqual([]);
  });

  it("does nothing for an empty name", async () => {
    const { state } = renderDrawer(NOTE);
    await userEvent.type(await screen.findByRole("textbox", { name: "New tag" }), "  {Enter}");
    expect(state.tagCreates).toEqual([]);
    expect(state.tagInserts).toEqual([]);
  });
});

describe("metadata", () => {
  it("shows kind, saved date, source, size and status", async () => {
    renderDrawer(
      makeItem({
        id: ID,
        kind: "pdf",
        title: "Paper",
        is_read: true,
        file_name: "paper.pdf",
        file_path: "u/i/paper.pdf",
        file_size: 2 * 1024 * 1024,
        url: "https://example.com/paper",
        domain: "example.com",
        created_at: "2026-03-04T10:00:00Z",
      }),
    );
    await screen.findByRole("dialog");
    const meta = screen.getByText("Kind").closest("dl") as HTMLElement;
    expect(within(meta).getByText("PDF")).toBeInTheDocument();
    expect(within(meta).getByText(/Mar 4, 2026/)).toBeInTheDocument();
    expect(within(meta).getByRole("link", { name: "example.com" })).toHaveAttribute(
      "href",
      "https://example.com/paper",
    );
    expect(within(meta).getByText("paper.pdf")).toBeInTheDocument();
    expect(within(meta).getByText("2 MB")).toBeInTheDocument();
    expect(within(meta).getByText("Read")).toBeInTheDocument();
  });
});

describe("previews", () => {
  it("image: a large signed image that opens a lightbox", async () => {
    renderDrawer(
      makeItem({
        id: ID,
        kind: "image",
        title: "Photo",
        is_read: true,
        file_path: "u/i/photo.png",
      }),
    );
    const preview = await screen.findByRole("img", { name: "Photo" });
    expect(preview).toHaveAttribute("src", "https://signed.example/u/i/photo.png?token=t");

    await userEvent.click(screen.getByRole("button", { name: "View full size" }));
    const lightbox = await screen.findByRole("dialog", { name: "Photo" });
    expect(within(lightbox).getByRole("img", { name: "Photo" })).toHaveAttribute(
      "src",
      "https://signed.example/u/i/photo.png?token=t",
    );
  });

  it("pdf: an iframe of the signed URL", async () => {
    renderDrawer(
      makeItem({ id: ID, kind: "pdf", title: "Paper", is_read: true, file_path: "u/i/p.pdf" }),
    );
    const frame = await screen.findByTitle("PDF: Paper");
    expect(frame.tagName).toBe("IFRAME");
    expect(frame).toHaveAttribute("src", "https://signed.example/u/i/p.pdf?token=t");
  });

  it("video: embeds YouTube through youtube-nocookie.com from the parsed id", async () => {
    renderDrawer(
      makeItem({
        id: ID,
        kind: "video",
        title: "Talk",
        is_read: true,
        url: `https://www.youtube.com/watch?v=${YOUTUBE}&list=x`,
      }),
    );
    const frame = await screen.findByTitle("Video: Talk");
    expect(frame).toHaveAttribute("src", `https://www.youtube-nocookie.com/embed/${YOUTUBE}`);
  });

  it("video: embeds Vimeo through player.vimeo.com", async () => {
    renderDrawer(
      makeItem({
        id: ID,
        kind: "video",
        title: "Reel",
        is_read: true,
        url: "https://vimeo.com/76979871",
      }),
    );
    expect(await screen.findByTitle("Video: Reel")).toHaveAttribute(
      "src",
      "https://player.vimeo.com/video/76979871",
    );
  });

  it("video: never puts another host in an iframe; it falls back to the link card", async () => {
    renderDrawer(
      makeItem({
        id: ID,
        kind: "video",
        title: "Sneaky",
        is_read: true,
        url: `https://evilyoutube.com/watch?v=${YOUTUBE}`,
      }),
    );
    await screen.findByRole("dialog");
    expect(document.querySelector("iframe")).toBeNull();
    expect(screen.getByRole("link", { name: /Open link/ })).toHaveAttribute(
      "href",
      `https://evilyoutube.com/watch?v=${YOUTUBE}`,
    );
  });

  it("video: an uploaded file plays in a video element with the signed URL", async () => {
    renderDrawer(
      makeItem({ id: ID, kind: "video", title: "Clip", is_read: true, file_path: "u/i/clip.mp4" }),
    );
    await waitFor(() =>
      expect(document.querySelector("video")).toHaveAttribute(
        "src",
        "https://signed.example/u/i/clip.mp4?token=t",
      ),
    );
    expect(document.querySelector("video")).toHaveAttribute("controls");
  });

  it("article: image, site, description and a Read article link that opens safely in a new tab", async () => {
    renderDrawer(
      makeItem({
        id: ID,
        kind: "article",
        title: "A post",
        is_read: true,
        url: "https://example.com/post",
        domain: "example.com",
        site_name: "Example Blog",
        description: "About things",
        image_url: "https://img.example/og.png",
      }),
    );
    const read = await screen.findByRole("link", { name: /Read article/ });
    // The button, the title and the header icon all lead to the page, each safely in a new tab.
    for (const link of [
      read,
      screen.getByRole("link", { name: "A post" }),
      screen.getByRole("link", { name: "Open in new tab" }),
    ]) {
      expect(link).toHaveAttribute("href", "https://example.com/post");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    expect(screen.getByText("Example Blog")).toBeInTheDocument();
    expect(screen.getByText("About things")).toBeInTheDocument();
    expect(document.querySelector('img[src="https://img.example/og.png"]')).not.toBeNull();
  });

  it("link: a non-http URL never becomes a link", async () => {
    renderDrawer(
      makeItem({ id: ID, kind: "link", title: "Bad", is_read: true, url: "javascript:alert(1)" }),
    );
    await screen.findByRole("dialog");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("file: icon, name, size and a Download that asks for a signed URL with the download option", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const { state } = renderDrawer(
      makeItem({
        id: ID,
        kind: "document",
        title: "Report",
        is_read: true,
        file_name: "report.docx",
        file_path: "u/i/report.docx",
        file_size: 34 * 1024,
      }),
    );
    const preview = (await screen.findByText("report.docx", { selector: "p" })).parentElement;
    expect(within(preview as HTMLElement).getByText("34 KB")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Download" }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
    expect(state.signed).toEqual([
      { path: "u/i/report.docx", seconds: 60, options: { download: "report.docx" } },
    ]);
    click.mockRestore();
  });

  it("a file that never finished uploading says so and can be trashed", async () => {
    const { state } = renderDrawer(
      makeItem({
        id: ID,
        kind: "pdf",
        title: "Broken",
        is_read: true,
        file_path: "u/i/b.pdf",
        enrich_status: "failed",
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Upload didn't finish");
    expect(screen.queryByTitle(/PDF/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Move to trash" }));
    await waitFor(() =>
      expect(state.updates[0]?.patch).toEqual({ deleted_at: expect.any(String) }),
    );
  });

  it("a file still uploading in this tab shows Uploading", async () => {
    useUploadStore.setState({ progress: { [ID]: null } });
    renderDrawer(
      makeItem({
        id: ID,
        kind: "image",
        title: "Fresh",
        is_read: true,
        file_path: "u/i/f.png",
        enrich_status: "pending",
        updated_at: new Date().toISOString(),
      }),
    );
    expect(await screen.findByText("Uploading…")).toBeInTheDocument();
  });
});

describe("actions", () => {
  it("favorites without closing the drawer", async () => {
    const { state } = renderDrawer(NOTE);
    const button = await screen.findByRole("button", { name: "Favorite" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(button);
    await waitFor(() => expect(state.updates[0]?.patch).toEqual({ is_favorite: true }));
    expect(await screen.findByRole("button", { name: "Unfavorite" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("moves to trash, closes the drawer and offers Undo", async () => {
    const { state } = renderDrawer(NOTE);
    await userEvent.click(await screen.findByRole("button", { name: "Move to trash" }));
    await waitFor(() =>
      expect(state.updates[0]?.patch).toEqual({ deleted_at: expect.any(String) }),
    );
    expect(mocks.replace).toHaveBeenCalledWith("/app/all", { scroll: false });
    expect(mocks.toast).toHaveBeenCalledWith("Moved to trash", expect.anything());
  });

  it("archives and unarchives", async () => {
    const { state, unmount } = renderDrawer(NOTE);
    await userEvent.click(await screen.findByRole("button", { name: "Archive" }));
    await waitFor(() =>
      expect(state.updates[0]?.patch).toEqual({ archived_at: expect.any(String) }),
    );
    unmount();

    const archived = makeItem({ ...NOTE, archived_at: "2026-02-01T00:00:00Z" });
    const second = renderDrawer(archived);
    await userEvent.click(await screen.findByRole("button", { name: "Unarchive" }));
    await waitFor(() => expect(second.state.updates[0]?.patch).toEqual({ archived_at: null }));
  });

  it("restores a trashed item and only offers Delete forever in the Trash view", async () => {
    const trashed = makeItem({ ...NOTE, deleted_at: "2026-02-01T00:00:00Z" });
    const outside = renderDrawer(trashed, { view: { type: "all" } });
    expect(await screen.findByRole("button", { name: "Restore" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete forever" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Move to trash" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Restore" }));
    await waitFor(() => expect(outside.state.updates[0]?.patch).toEqual({ deleted_at: null }));
  });

  it("deletes forever after a confirmation: objects first, then the row", async () => {
    const trashed = makeItem({
      ...NOTE,
      kind: "pdf",
      user_id: "u",
      file_path: `u/${ID}/a.pdf`,
      deleted_at: "2026-02-01T00:00:00Z",
    });
    const { state } = renderDrawer(trashed, { view: { type: "trash" } });
    await userEvent.click(await screen.findByRole("button", { name: "Delete forever" }));

    const confirm = await screen.findByRole("dialog", { name: "Delete forever?" });
    // Nothing is deleted before the confirmation.
    expect(state.removed).toEqual([]);
    await userEvent.click(within(confirm).getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Delete forever?" })).toBeNull(),
    );
    expect(state.removed).toEqual([]);

    await userEvent.click(screen.getByRole("button", { name: "Delete forever" }));
    const again = await screen.findByRole("dialog", { name: "Delete forever?" });
    await userEvent.click(within(again).getByRole("button", { name: "Delete forever" }));
    await waitFor(() => expect(state.deletes).toEqual([ID]));
    expect(state.removed[0]).toContain(`u/${ID}/a.pdf`);
    expect(mocks.replace).toHaveBeenCalled();
  });
});
