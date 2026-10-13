import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeCounts, makeTestQueryClient, renderWithQuery } from "@/test/fixtures";
import { Sidebar } from "./sidebar";

const COLLECTION_ID = "33333333-3333-4333-8333-333333333333";
const TAG_ID = "44444444-4444-4444-8444-444444444444";

const mocks = vi.hoisted(() => ({
  collections: {
    create: vi.fn(async () => null),
    update: vi.fn(async () => true),
    remove: vi.fn(async () => true),
  },
  tags: {
    create: vi.fn(async () => null),
    rename: vi.fn(async () => true),
    remove: vi.fn(async () => true),
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/app",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/collections/mutations", () => ({ useCollectionActions: () => mocks.collections }));
vi.mock("@/lib/tags/mutations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/tags/mutations")>()),
  useTagManager: () => mocks.tags,
}));

function renderSidebar() {
  const client = makeTestQueryClient();
  client.setQueryData(["counts"], makeCounts({ collections: { [COLLECTION_ID]: 2 } }));
  client.setQueryData(
    ["collections"],
    [
      {
        id: COLLECTION_ID,
        name: "Reading list",
        emoji: "📚",
        color: "aurora-violet",
        position: "a0",
      },
    ],
  );
  client.setQueryData(["tags"], [{ id: TAG_ID, name: "thesis", color: null }]);
  client.setQueryData(["smart-views"], []);
  return renderWithQuery(<Sidebar email={null} />, client);
}

async function openMenu(name: string) {
  await userEvent.click(screen.getByRole("button", { name }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("new collection", () => {
  it("creates with a name, an emoji and a color from the dialog", async () => {
    renderSidebar();
    await userEvent.click(screen.getByRole("button", { name: "New collection" }));
    const dialog = await screen.findByRole("dialog", { name: "New collection" });

    const create = within(dialog).getByRole("button", { name: "Create" });
    expect(create).toBeDisabled();

    await userEvent.type(within(dialog).getByRole("textbox", { name: "Name" }), "  Ideas ");
    await userEvent.type(within(dialog).getByRole("textbox", { name: /Emoji/ }), "💡");
    await userEvent.click(within(dialog).getByRole("radio", { name: "Blue" }));
    expect(within(dialog).getByRole("radio", { name: "None" })).not.toBeChecked();
    await userEvent.click(create);

    expect(mocks.collections.create).toHaveBeenCalledWith({
      name: "Ideas",
      emoji: "💡",
      color: "aurora-blue",
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("offers the six aurora colors and none, none selected by default", async () => {
    renderSidebar();
    await userEvent.click(screen.getByRole("button", { name: "New collection" }));
    const dialog = await screen.findByRole("dialog");
    const group = within(dialog).getByRole("group", { name: "Color" });
    const radios = within(group).getAllByRole("radio");
    expect(radios.map((radio) => (radio as HTMLInputElement).labels?.[0]?.textContent)).toEqual([
      "None",
      "Pink",
      "Violet",
      "Blue",
      "Red",
      "Coral",
      "Olive",
    ]);
    expect(radios[0]).toBeChecked();
  });

  it("rejects more than one emoji and keeps the dialog open", async () => {
    renderSidebar();
    await userEvent.click(screen.getByRole("button", { name: "New collection" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Name" }), "Ideas");
    await userEvent.type(within(dialog).getByRole("textbox", { name: /Emoji/ }), "💡📚");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Use a single emoji.");
    expect(mocks.collections.create).not.toHaveBeenCalled();
  });

  it("creates with Enter and sends no emoji or color when left empty", async () => {
    renderSidebar();
    await userEvent.click(screen.getByRole("button", { name: "New collection" }));
    await userEvent.type(await screen.findByRole("textbox", { name: "Name" }), "Plain{Enter}");
    expect(mocks.collections.create).toHaveBeenCalledWith({
      name: "Plain",
      emoji: null,
      color: null,
    });
  });
});

describe("collection menu", () => {
  it("edits name, emoji and color from a prefilled dialog", async () => {
    renderSidebar();
    await openMenu("Reading list options");
    await userEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit collection" });
    const name = within(dialog).getByRole("textbox", { name: "Name" });
    expect(name).toHaveValue("Reading list");
    expect(within(dialog).getByRole("textbox", { name: /Emoji/ })).toHaveValue("📚");
    expect(within(dialog).getByRole("radio", { name: "Violet" })).toBeChecked();

    await userEvent.clear(name);
    await userEvent.type(name, "Books");
    await userEvent.click(within(dialog).getByRole("radio", { name: "None" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(mocks.collections.update).toHaveBeenCalledWith(COLLECTION_ID, {
      name: "Books",
      emoji: "📚",
      color: null,
    });
  });

  it("deletes only after confirming, with the Inbox copy", async () => {
    renderSidebar();
    await openMenu("Reading list options");
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete Reading list?" });
    expect(dialog).toHaveTextContent("Items in it move to Inbox.");
    expect(mocks.collections.remove).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(mocks.collections.remove).toHaveBeenCalledWith(COLLECTION_ID);
  });

  it("does not delete when cancelled", async () => {
    renderSidebar();
    await openMenu("Reading list options");
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(mocks.collections.remove).not.toHaveBeenCalled();
  });

  it("shows the color as a dot on the row", () => {
    renderSidebar();
    const row = screen.getByRole("link", { name: /Reading list/ });
    const dot = row.querySelector('[data-slot="collection-color"]') as HTMLElement;
    expect(dot.style.backgroundColor).toBe("var(--color-aurora-violet)");
  });
});

describe("tag menu", () => {
  it("renames from a prefilled dialog", async () => {
    renderSidebar();
    await openMenu("Tag thesis options");
    await userEvent.click(await screen.findByRole("menuitem", { name: "Rename" }));
    const dialog = await screen.findByRole("dialog", { name: "Rename tag" });
    const name = within(dialog).getByRole("textbox", { name: "Name" });
    expect(name).toHaveValue("thesis");
    await userEvent.clear(name);
    await userEvent.type(name, "Dissertation{Enter}");
    expect(mocks.tags.rename).toHaveBeenCalledWith(TAG_ID, "Dissertation");
  });

  it("deletes only after confirming, with the 'keep everything else' copy", async () => {
    renderSidebar();
    await openMenu("Tag thesis options");
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete #thesis?" });
    expect(dialog).toHaveTextContent("Items keep everything else.");
    expect(mocks.tags.remove).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(mocks.tags.remove).toHaveBeenCalledWith(TAG_ID);
  });
});
