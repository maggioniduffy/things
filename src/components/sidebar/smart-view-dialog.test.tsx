import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeCounts, makeTestQueryClient, renderWithQuery } from "@/test/fixtures";
import { Sidebar } from "./sidebar";

const COLLECTION_ID = "33333333-3333-4333-8333-333333333333";
const STALE_COLLECTION_ID = "99999999-9999-4999-8999-999999999999";
const TAG_A = "44444444-4444-4444-8444-444444444444";
const TAG_B = "55555555-5555-4555-8555-555555555555";
const VIEW_ID = "77777777-7777-4777-8777-777777777777";

const mocks = vi.hoisted(() => ({
  smart: {
    create: vi.fn(async () => null),
    update: vi.fn(async () => true),
    remove: vi.fn(async () => true),
  },
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/app",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));
vi.mock("@/lib/smart-views/mutations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/smart-views/mutations")>()),
  useSmartViewActions: () => mocks.smart,
}));

function renderSidebar(withView = false) {
  const client = makeTestQueryClient();
  client.setQueryData(["counts"], makeCounts());
  client.setQueryData(
    ["collections"],
    [{ id: COLLECTION_ID, name: "Reading list", emoji: "📚", color: null, position: "a0" }],
  );
  client.setQueryData(
    ["tags"],
    [
      { id: TAG_A, name: "thesis", color: null },
      { id: TAG_B, name: "later", color: null },
    ],
  );
  client.setQueryData(
    ["smart-views"],
    withView
      ? [
          {
            id: VIEW_ID,
            name: "Unread PDFs",
            icon: "📄",
            position: "a0",
            rules: {
              kinds: ["pdf"],
              collectionIds: [COLLECTION_ID, STALE_COLLECTION_ID],
              tagIds: [TAG_A],
              domains: ["example.com"],
              isRead: false,
              savedWithinDays: 7,
              query: "cats",
            },
          },
        ]
      : [],
  );
  return renderWithQuery(<Sidebar email={null} />, client);
}

beforeEach(() => vi.clearAllMocks());

describe("new smart view", () => {
  it("creates with a name, an emoji and every kind of rule", async () => {
    renderSidebar();
    await userEvent.click(screen.getByRole("button", { name: "New smart view" }));
    const dialog = await screen.findByRole("dialog", { name: "New smart view" });
    const create = within(dialog).getByRole("button", { name: "Create" });
    expect(create).toBeDisabled();

    await userEvent.type(within(dialog).getByRole("textbox", { name: "Name" }), " Reading ");
    await userEvent.type(within(dialog).getByRole("textbox", { name: /Emoji/ }), "📖");
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "PDFs" }));
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Links" }));
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "📚 Reading list" }));
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "#thesis" }));
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "#later" }));
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: /Domains/ }),
      "https://www.Example.com/a, news.org",
    );
    await userEvent.click(within(dialog).getByRole("radio", { name: "Unread" }));
    await userEvent.click(within(dialog).getByRole("radio", { name: "Favorites" }));
    await userEvent.type(within(dialog).getByRole("spinbutton"), "14");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Contains text" }), "cats");
    await userEvent.click(create);

    expect(mocks.smart.create).toHaveBeenCalledWith({
      name: "Reading",
      icon: "📖",
      rules: {
        kinds: ["pdf", "link"],
        collectionIds: [COLLECTION_ID],
        tagIds: [TAG_A, TAG_B],
        domains: ["example.com", "news.org"],
        isRead: false,
        isFavorite: true,
        savedWithinDays: 14,
        query: "cats",
      },
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("saves empty rules when nothing is chosen", async () => {
    renderSidebar();
    await userEvent.click(screen.getByRole("button", { name: "New smart view" }));
    await userEvent.type(await screen.findByRole("textbox", { name: "Name" }), "Everything{Enter}");
    expect(mocks.smart.create).toHaveBeenCalledWith({
      name: "Everything",
      icon: null,
      rules: {},
    });
  });

  it("keeps the dialog open on more than one emoji", async () => {
    renderSidebar();
    await userEvent.click(screen.getByRole("button", { name: "New smart view" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Name" }), "X");
    await userEvent.type(within(dialog).getByRole("textbox", { name: /Emoji/ }), "📖📚");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Use a single emoji.");
    expect(mocks.smart.create).not.toHaveBeenCalled();
  });

  it("blocks a days value that is not a whole number above zero", async () => {
    renderSidebar();
    await userEvent.click(screen.getByRole("button", { name: "New smart view" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.type(within(dialog).getByRole("textbox", { name: "Name" }), "X");
    await userEvent.type(within(dialog).getByRole("spinbutton"), "0");
    expect(within(dialog).getByRole("button", { name: "Create" })).toBeDisabled();
  });
});

describe("smart view row", () => {
  it("edits from a prefilled dialog and drops rules for things that no longer exist", async () => {
    renderSidebar(true);
    await userEvent.click(screen.getByRole("button", { name: "Unread PDFs options" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit smart view" });

    expect(within(dialog).getByRole("textbox", { name: "Name" })).toHaveValue("Unread PDFs");
    expect(within(dialog).getByRole("textbox", { name: /Emoji/ })).toHaveValue("📄");
    expect(within(dialog).getByRole("checkbox", { name: "PDFs" })).toBeChecked();
    expect(within(dialog).getByRole("checkbox", { name: "Links" })).not.toBeChecked();
    expect(within(dialog).getByRole("checkbox", { name: "#thesis" })).toBeChecked();
    expect(within(dialog).getByRole("textbox", { name: /Domains/ })).toHaveValue("example.com");
    expect(within(dialog).getByRole("radio", { name: "Unread" })).toBeChecked();
    expect(within(dialog).getByRole("spinbutton")).toHaveValue(7);

    await userEvent.click(within(dialog).getByRole("checkbox", { name: "PDFs" }));
    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Articles" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    expect(mocks.smart.update).toHaveBeenCalledWith(VIEW_ID, {
      name: "Unread PDFs",
      icon: "📄",
      rules: {
        kinds: ["article"],
        collectionIds: [COLLECTION_ID],
        tagIds: [TAG_A],
        domains: ["example.com"],
        isRead: false,
        savedWithinDays: 7,
        query: "cats",
      },
    });
  });

  it("renames", async () => {
    renderSidebar(true);
    await userEvent.click(screen.getByRole("button", { name: "Unread PDFs options" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");
    const name = within(dialog).getByRole("textbox", { name: "Name" });
    await userEvent.clear(name);
    await userEvent.type(name, "PDF inbox{Enter}");
    expect(mocks.smart.update).toHaveBeenCalledWith(
      VIEW_ID,
      expect.objectContaining({ name: "PDF inbox" }),
    );
  });

  it("asks before deleting, and says the items stay", async () => {
    renderSidebar(true);
    await userEvent.click(screen.getByRole("button", { name: "Unread PDFs options" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog", { name: "Delete Unread PDFs?" });
    expect(dialog).toHaveTextContent("Your items stay where they are.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete" }));
    expect(mocks.smart.remove).toHaveBeenCalledWith(VIEW_ID);
  });

  it("lists the view with its emoji and a reorder handle", () => {
    renderSidebar(true);
    const list = screen.getByRole("list", { name: "Smart views" });
    expect(within(list).getByRole("link", { name: /Unread PDFs/ })).toHaveTextContent("📄");
    expect(
      within(list).getByRole("button", { name: "Drag to reorder smart view Unread PDFs" }),
    ).toBeInTheDocument();
  });
});
