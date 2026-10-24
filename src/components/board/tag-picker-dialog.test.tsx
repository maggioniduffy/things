import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeTestQueryClient, renderWithQuery } from "@/test/fixtures";
import { TagPickerDialog } from "./tag-picker-dialog";

const batch = vi.hoisted(() => vi.fn(async () => true));
const ensureTags = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/items/batch-mutations", () => ({ useBatchMove: () => batch }));
vi.mock("@/lib/tags/mutations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tags/mutations")>()),
  ensureTags,
}));

const IDS = ["a", "b"];

// cmdk observes its list size and scrolls the active row; jsdom has neither.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);
Element.prototype.scrollIntoView = vi.fn();

function mount(onOpenChange = vi.fn()) {
  const client = makeTestQueryClient();
  client.setQueryData(
    ["tags"],
    [
      { id: "t1", name: "Reading", color: null },
      { id: "t2", name: "Recipes", color: null },
      { id: "t3", name: "Work", color: null },
    ],
  );
  renderWithQuery(<TagPickerDialog open onOpenChange={onOpenChange} ids={IDS} />, client);
  return onOpenChange;
}

describe("TagPickerDialog", () => {
  beforeEach(() => vi.clearAllMocks());

  it("has a title and lists the tags", () => {
    mount();
    expect(screen.getByRole("dialog", { name: "Add a tag to 2 items" })).toBeInTheDocument();
    expect(screen.getByText("Reading")).toBeInTheDocument();
    expect(screen.getByText("Work")).toBeInTheDocument();
  });

  it("filters as you type and offers to create a new tag", async () => {
    mount();
    await userEvent.type(screen.getByPlaceholderText("Find or create a tag"), "rec");
    expect(screen.getByText("Recipes")).toBeInTheDocument();
    expect(screen.queryByText("Work")).not.toBeInTheDocument();
    expect(screen.getByText("Create tag “rec”")).toBeInTheDocument();
  });

  it("does not offer to create a tag that exists, ignoring case", async () => {
    mount();
    await userEvent.type(screen.getByPlaceholderText("Find or create a tag"), "work");
    expect(screen.queryByText(/Create tag/)).not.toBeInTheDocument();
  });

  it("picking a tag adds it to the items and closes", async () => {
    const onOpenChange = mount();
    await userEvent.click(screen.getByText("Work"));
    expect(batch).toHaveBeenCalledWith(IDS, { type: "tag", id: "t3" }, "Work");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("the create row makes the tag, then adds it", async () => {
    ensureTags.mockResolvedValue([{ id: "t9", name: "Ideas", color: null }]);
    mount();
    await userEvent.type(screen.getByPlaceholderText("Find or create a tag"), "Ideas");
    await userEvent.click(screen.getByText("Create tag “Ideas”"));
    await waitFor(() =>
      expect(batch).toHaveBeenCalledWith(IDS, { type: "tag", id: "t9" }, "Ideas"),
    );
    expect(ensureTags).toHaveBeenCalledWith(expect.anything(), expect.anything(), ["Ideas"]);
  });
});
