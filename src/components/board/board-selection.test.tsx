import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { itemsQueryKey } from "@/lib/items/queries";
import type { ViewSpec } from "@/lib/views";
import { useUiStore } from "@/stores/ui-store";
import { makeItem, makeTestQueryClient, renderWithQuery } from "@/test/fixtures";
import { Board } from "./board";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/app",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
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
const IDS = Array.from({ length: 6 }, (_, i) => `00000000-0000-4000-8000-00000000000${i}`);

function renderBoard(sort: "manual" | "newest" = "manual", view: ViewSpec = INBOX) {
  const client = makeTestQueryClient();
  client.setQueryData(itemsQueryKey(view, sort), {
    pages: [
      {
        items: IDS.map((id, index) =>
          makeItem({ id, title: `Card ${index}`, position: `a${index}` }),
        ),
        nextCursor: null,
      },
    ],
    pageParams: [null],
  });
  return renderWithQuery(<Board view={view} sort={sort} />, client);
}

const open = (index: number) => screen.getByRole("button", { name: `Open Card ${index}` });

describe("Board selection", () => {
  beforeEach(() => {
    push.mockClear();
    useUiStore.setState({ viewMode: "grid", selectedIds: [], anchorId: null, selectMode: false });
  });

  it("Ctrl-click toggles cards without opening them", async () => {
    const user = userEvent.setup();
    renderBoard();
    await user.keyboard("{Control>}");
    await user.click(open(1));
    await user.click(open(3));
    await user.click(open(1));
    await user.keyboard("{/Control}");
    expect(useUiStore.getState().selectedIds).toEqual([IDS[3]]);
    expect(push).not.toHaveBeenCalled();
  });

  it("Meta-click selects too, and marks the card as selected", async () => {
    const user = userEvent.setup();
    const { container } = renderBoard();
    await user.keyboard("{Meta>}");
    await user.click(open(2));
    await user.keyboard("{/Meta}");
    expect(container.querySelectorAll('[data-selected="true"]')).toHaveLength(1);
    expect(screen.getByText("Selected")).toBeInTheDocument();
  });

  it("Shift-click selects the range from the last clicked card", async () => {
    const user = userEvent.setup();
    renderBoard();
    await user.keyboard("{Control>}");
    await user.click(open(1));
    await user.keyboard("{/Control}{Shift>}");
    await user.click(open(4));
    await user.keyboard("{/Shift}");
    expect(useUiStore.getState().selectedIds).toEqual([IDS[1], IDS[2], IDS[3], IDS[4]]);
    expect(push).not.toHaveBeenCalled();
  });

  it("works in the list view and outside manual sort", async () => {
    useUiStore.setState({ viewMode: "list" });
    const user = userEvent.setup();
    renderBoard("newest");
    await user.keyboard("{Control>}");
    await user.click(open(0));
    await user.keyboard("{/Control}{Shift>}");
    await user.click(open(2));
    await user.keyboard("{/Shift}");
    expect(useUiStore.getState().selectedIds).toEqual([IDS[0], IDS[1], IDS[2]]);
  });

  it("a plain click still opens the card and leaves the selection alone", async () => {
    const user = userEvent.setup();
    renderBoard();
    useUiStore.getState().select(IDS[2]!);
    await user.click(open(0));
    expect(push).toHaveBeenCalledTimes(1);
    expect(useUiStore.getState().selectedIds).toEqual([IDS[2]]);
  });

  it("Escape clears the selection", async () => {
    const user = userEvent.setup();
    renderBoard();
    useUiStore.getState().select(IDS[0]!);
    useUiStore.getState().select(IDS[1]!, { additive: true });
    await user.keyboard("{Escape}");
    expect(useUiStore.getState().selectedIds).toEqual([]);
  });

  it("offers drag handles named for what they do", () => {
    const manual = renderBoard("manual");
    expect(screen.getAllByRole("button", { name: /^Reorder Card/ })).toHaveLength(6);
    manual.unmount();
    renderBoard("newest");
    expect(screen.queryByRole("button", { name: /^Reorder / })).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Move Card/ })).toHaveLength(6);
  });

  it("has no drag handles in Trash", () => {
    renderBoard("manual", { type: "trash" });
    expect(screen.queryByRole("button", { name: /^(Reorder|Move) / })).not.toBeInTheDocument();
  });

  it("selection mode: a plain click toggles, Select all selects every card", async () => {
    const user = userEvent.setup();
    renderBoard();
    await user.click(screen.getByRole("button", { name: "Select" }));
    await user.click(open(0));
    expect(useUiStore.getState().selectedIds).toEqual([IDS[0]]);
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByText("1 selected")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Select all" }));
    expect(useUiStore.getState().selectedIds).toEqual(IDS);
    await user.click(screen.getByRole("button", { name: "Deselect all" }));
    expect(useUiStore.getState().selectedIds).toEqual([]);

    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("toolbar", { name: "Selection" })).not.toBeInTheDocument();
  });

  it("offers move, archive and trash in a live view", async () => {
    const user = userEvent.setup();
    renderBoard();
    await user.click(screen.getByRole("button", { name: "Select" }));
    await user.click(screen.getByRole("button", { name: "Select all" }));
    const bar = screen.getByRole("toolbar", { name: "Selection" });
    expect(bar).toHaveTextContent("Move to…");
    expect(bar).toHaveTextContent("Archive");
    expect(bar).toHaveTextContent("Move to trash");
  });

  it("offers restore, archive and delete forever in the trash", async () => {
    const user = userEvent.setup();
    renderBoard("manual", { type: "trash" });
    await user.click(screen.getByRole("button", { name: "Select" }));
    await user.click(screen.getByRole("button", { name: "Select all" }));
    expect(screen.getByRole("button", { name: "Restore" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Archive" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Delete forever" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Delete 6 items forever?");
  });

  it("offers restore and trash in the archive", async () => {
    const user = userEvent.setup();
    renderBoard("manual", { type: "archive" });
    await user.click(screen.getByRole("button", { name: "Select" }));
    const bar = screen.getByRole("toolbar", { name: "Selection" });
    expect(bar).toHaveTextContent("Restore");
    expect(bar).toHaveTextContent("Move to trash");
    expect(bar).not.toHaveTextContent("Delete forever");
  });
});
