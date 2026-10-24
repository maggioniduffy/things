import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ViewerProvider } from "@/components/providers/viewer-provider";
import { I18nProvider } from "@/i18n/client";
import { itemQueryKey } from "@/lib/items/item-query";
import { useUiStore } from "@/stores/ui-store";
import { makeItem, makeTestQueryClient, renderWithQuery } from "@/test/fixtures";
import { CommandPalette } from "./command-palette";

const COLLECTION = "33333333-3333-4333-8333-333333333333";
const TAG = "44444444-4444-4444-8444-444444444444";
const SMART = "55555555-5555-4555-8555-555555555555";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  searchItems: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
  readClipboard: vi.fn(),
  capture: { captureLink: vi.fn(), captureNote: vi.fn(), captureFile: vi.fn() },
  actions: {
    toggleFavorite: vi.fn(),
    archive: vi.fn(),
    unarchive: vi.fn(),
    trash: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  usePathname: () => "/app",
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ marker: "client" }) }));
vi.mock("@/lib/items/search", () => ({ searchItems: mocks.searchItems }));
vi.mock("@/lib/items/mutations", () => ({ useCapture: () => mocks.capture }));
vi.mock("@/lib/items/state-mutations", () => ({ useItemActions: () => mocks.actions }));
vi.mock("./clipboard-save", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./clipboard-save")>()),
  readClipboardRequests: mocks.readClipboard,
}));

Element.prototype.scrollIntoView = vi.fn();
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const NOTE = makeItem({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", title: "Canción de cuna" });

function setup({ isGuest = false, locale }: { isGuest?: boolean; locale?: "es" } = {}) {
  const client = makeTestQueryClient();
  client.setQueryData(["collections"], [
    { id: COLLECTION, name: "Recipes", emoji: null, color: null, position: "a0" },
  ]);
  client.setQueryData(["tags"], [{ id: TAG, name: "thesis", color: null }]);
  client.setQueryData(["smart-views"], [
    { id: SMART, name: "Long reads", icon: null, position: "a0", rules: {} },
  ]);
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <I18nProvider locale={locale ?? "en"}>
        <ViewerProvider userId="u1" isGuest={isGuest}>
          {children}
        </ViewerProvider>
      </I18nProvider>
    );
  }
  renderWithQuery(
    <Wrapper>
      <CommandPalette />
    </Wrapper>,
    client,
  );
  return { client, user: userEvent.setup() };
}

const open = () => act(() => useUiStore.getState().setPaletteOpen(true));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.searchItems.mockResolvedValue([NOTE]);
  useUiStore.setState({
    paletteOpen: false,
    quickAddOpen: false,
    upgradeOpen: false,
    cursorId: null,
    shortcutDialog: null,
  });
  window.history.replaceState(null, "", "/app");
});

describe("CommandPalette", () => {
  it("renders nothing until paletteOpen is set, then shows the three groups", async () => {
    setup();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await open();
    expect(await screen.findByRole("dialog", { name: "Command palette" })).toBeInTheDocument();
    for (const heading of ["Actions", "Go to"]) {
      expect(screen.getByText(heading)).toBeInTheDocument();
    }
    // No text, no search.
    expect(screen.queryByText("Results")).not.toBeInTheDocument();
    expect(mocks.searchItems).not.toHaveBeenCalled();
  });

  it("searches live items with limit 8 once the text settles, and opens the drawer on select", async () => {
    const { user, client } = setup();
    await open();
    await user.type(await screen.findByPlaceholderText(/Search things/), "cancion");

    const row = await screen.findByRole("option", { name: /Canción de cuna/ });
    expect(mocks.searchItems).toHaveBeenCalledTimes(1);
    expect(mocks.searchItems).toHaveBeenCalledWith({ marker: "client" }, "cancion", {}, 8);
    expect(client.getQueryData(["palette-search", "cancion"])).toEqual([NOTE]);

    await user.click(row);
    expect(useUiStore.getState().paletteOpen).toBe(false);
    expect(mocks.push).toHaveBeenCalledWith(`/app?item=${NOTE.id}`, { scroll: false });
    expect(client.getQueryData(itemQueryKey(NOTE.id))).toEqual(NOTE);
  });

  it("does not search for blank text", async () => {
    const { user } = setup();
    await open();
    await user.type(await screen.findByPlaceholderText(/Search things/), "   ");
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(mocks.searchItems).not.toHaveBeenCalled();
  });

  it("Add item opens quick add and closes the palette", async () => {
    const { user } = setup();
    await open();
    await user.click(await screen.findByRole("option", { name: "Add item" }));
    expect(useUiStore.getState()).toMatchObject({ quickAddOpen: true, paletteOpen: false });
  });

  it("offers Add email to guests only, and it opens the upgrade dialog", async () => {
    const guest = setup({ isGuest: true });
    await open();
    await guest.user.click(await screen.findByRole("option", { name: "Add email" }));
    expect(useUiStore.getState()).toMatchObject({ upgradeOpen: true, paletteOpen: false });
  });

  it("hides Add email for regular accounts", async () => {
    setup();
    await open();
    await screen.findByRole("option", { name: "Add item" });
    expect(screen.queryByRole("option", { name: "Add email" })).not.toBeInTheDocument();
  });

  it("shows item actions only when the cursor names an item", async () => {
    setup();
    await open();
    await screen.findByRole("option", { name: "Add item" });
    for (const name of [/favorites/, /^Archive\s?E$/, /Move to trash/, /Add tag/, /^Open/]) {
      expect(screen.queryByRole("option", { name })).not.toBeInTheDocument();
    }
  });

  it("runs the cursor item's actions", async () => {
    const { user, client } = setup();
    client.setQueryData(itemQueryKey(NOTE.id), NOTE);
    act(() => useUiStore.getState().setCursor(NOTE.id));
    await open();

    await user.click(await screen.findByRole("option", { name: /Add to favorites/ }));
    expect(mocks.actions.toggleFavorite).toHaveBeenCalledWith(NOTE);

    await open();
    await user.click(await screen.findByRole("option", { name: /^Archive\s?E$/ }));
    expect(mocks.actions.archive).toHaveBeenCalledWith(NOTE);

    await open();
    await user.click(await screen.findByRole("option", { name: /Move to trash/ }));
    expect(mocks.actions.trash).toHaveBeenCalledWith(NOTE);

    await open();
    await user.click(await screen.findByRole("option", { name: /Move to collection/ }));
    expect(useUiStore.getState().shortcutDialog).toBe("move");

    await open();
    await user.click(await screen.findByRole("option", { name: /Add tag/ }));
    expect(useUiStore.getState().shortcutDialog).toBe("tag");
  });

  it("Open on the cursor item opens the drawer", async () => {
    const { user, client } = setup();
    client.setQueryData(itemQueryKey(NOTE.id), NOTE);
    act(() => useUiStore.getState().setCursor(NOTE.id));
    await open();
    await user.click(await screen.findByRole("option", { name: /^Open\s?Enter$/ }));
    expect(mocks.push).toHaveBeenCalledWith(`/app?item=${NOTE.id}`, { scroll: false });
  });

  it("shows the shortcut hints", async () => {
    setup();
    await open();
    await screen.findByRole("option", { name: "Add item" });
    expect(screen.getByRole("option", { name: /Save clipboard/ })).toHaveTextContent("⌘V");
    expect(screen.getByRole("option", { name: /Inbox/ })).toHaveTextContent("G I");
    expect(screen.getByRole("option", { name: /^All/ })).toHaveTextContent("G A");
    expect(screen.getByRole("option", { name: /Favorites/ })).toHaveTextContent("G F");
  });

  it.each([
    ["Inbox", "/app"],
    ["All", "/app/all"],
    ["Unread", "/app/unread"],
    ["Favorites", "/app/favorites"],
    ["Archive", "/app/archive"],
    ["Trash", "/app/trash"],
    ["Recipes", `/app/c/${COLLECTION}`],
    ["#thesis", `/app/t/${TAG}`],
    ["Long reads", `/app/v/${SMART}`],
  ])("Go to %s pushes %s", async (name, href) => {
    const { user } = setup();
    await open();
    await user.click(await screen.findByRole("option", { name: new RegExp(`^${name}`) }));
    expect(mocks.push).toHaveBeenCalledWith(href);
    expect(useUiStore.getState().paletteOpen).toBe(false);
  });

  it("Save clipboard saves what the clipboard holds", async () => {
    const found = { requests: [{ type: "note" as const, text: "hello" }], capped: false };
    mocks.readClipboard.mockResolvedValue(found);
    const { user } = setup();
    await open();
    await user.click(await screen.findByRole("option", { name: /Save clipboard/ }));
    await waitFor(() => expect(mocks.capture.captureNote).toHaveBeenCalledWith("hello"));
  });

  it("toasts when clipboard permission is denied", async () => {
    const { ClipboardDeniedError } = await import("./clipboard-save");
    mocks.readClipboard.mockRejectedValue(new ClipboardDeniedError());
    const { user } = setup();
    await open();
    await user.click(await screen.findByRole("option", { name: /Save clipboard/ }));
    await waitFor(() =>
      expect(mocks.toast.error).toHaveBeenCalledWith(
        "Couldn't read the clipboard. Allow clipboard access and try again.",
      ),
    );
    expect(mocks.capture.captureNote).not.toHaveBeenCalled();
  });

  it("renders Spanish inside the es provider", async () => {
    setup({ locale: "es" });
    await open();
    expect(await screen.findByRole("option", { name: "Agregar cosa" })).toBeInTheDocument();
    expect(screen.getByText("Ir a")).toBeInTheDocument();
  });
});
