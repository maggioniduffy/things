import { act, fireEvent, render, screen } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useUiStore } from "@/stores/ui-store";
import { makeItem, makeTestQueryClient } from "@/test/fixtures";
import { itemsQueryKey } from "@/lib/items/queries";
import { ShortcutsHost } from "./use-shortcuts";

const push = vi.hoisted(() => vi.fn());
const toggleFavorite = vi.hoisted(() => vi.fn(async () => {}));
const archive = vi.hoisted(() => vi.fn(async () => {}));
const trash = vi.hoisted(() => vi.fn(async () => {}));
const batch = vi.hoisted(() => vi.fn(async () => true));
const openItem = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/components/drawer/item-param", () => ({ useOpenItem: () => openItem }));
vi.mock("@/lib/items/batch-mutations", () => ({ useBatchMove: () => batch }));
vi.mock("@/lib/items/state-mutations", () => ({
  useItemActions: () => ({ toggleFavorite, archive, trash, unarchive: vi.fn() }),
}));

const A = "00000000-0000-4000-8000-000000000001";
const B = "00000000-0000-4000-8000-000000000002";
const VIEW = { type: "inbox" } as const;

function press(key: string, init: KeyboardEventInit = {}, target: Element = document.body) {
  act(() => {
    fireEvent.keyDown(target, { key, ...init });
  });
}

function mount() {
  const client = makeTestQueryClient();
  client.setQueryData(itemsQueryKey(VIEW, "manual"), {
    pages: [
      {
        items: [makeItem({ id: A, title: "Alpha" }), makeItem({ id: B, title: "Beta" })],
        nextCursor: null,
      },
    ],
    pageParams: [null],
  });
  return render(
    <QueryClientProvider client={client}>
      <ShortcutsHost />
      <ul>
        <li data-item-id={A}>Alpha</li>
        <li data-item-id={B}>Beta</li>
      </ul>
      <input aria-label="field" />
      <input aria-label="search" data-search-input="" />
    </QueryClientProvider>,
  );
}

describe("useShortcuts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useUiStore.setState({
      cursorId: null,
      selectedIds: [],
      paletteOpen: false,
      shortcutDialog: null,
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("J and K walk the cards, starting at the first and stopping at the ends", () => {
    mount();
    press("j");
    expect(useUiStore.getState().cursorId).toBe(A);
    press("j");
    expect(useUiStore.getState().cursorId).toBe(B);
    press("j");
    expect(useUiStore.getState().cursorId).toBe(B);
    press("k");
    expect(useUiStore.getState().cursorId).toBe(A);
  });

  it("G then A navigates; the chord expires after 1200 ms", () => {
    mount();
    press("g");
    press("a");
    expect(push).toHaveBeenCalledWith("/app/all");

    press("g");
    act(() => {
      vi.advanceTimersByTime(1300);
    });
    press("i");
    expect(push).toHaveBeenCalledTimes(1);

    press("g");
    press("f");
    expect(push).toHaveBeenLastCalledWith("/app/favorites");
    press("g");
    press("i");
    expect(push).toHaveBeenLastCalledWith("/app");
  });

  it("any other key cancels the chord", () => {
    mount();
    press("g");
    press("x");
    press("a");
    expect(push).not.toHaveBeenCalled();
  });

  it("does nothing while typing in a field", () => {
    mount();
    press("j", {}, screen.getByLabelText("field"));
    press("g", {}, screen.getByLabelText("field"));
    press("a", {}, screen.getByLabelText("field"));
    expect(useUiStore.getState().cursorId).toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it("does nothing while a dialog or a menu is open", () => {
    mount();
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.appendChild(dialog);
    press("j");
    expect(useUiStore.getState().cursorId).toBeNull();
    dialog.remove();

    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    document.body.appendChild(menu);
    press("j");
    expect(useUiStore.getState().cursorId).toBeNull();
    menu.remove();
  });

  it("Cmd/Ctrl+K toggles the palette, even from a field and with a dialog open", () => {
    mount();
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.appendChild(dialog);
    press("k", { metaKey: true }, screen.getByLabelText("field"));
    expect(useUiStore.getState().paletteOpen).toBe(true);
    press("k", { ctrlKey: true }, screen.getByLabelText("field"));
    expect(useUiStore.getState().paletteOpen).toBe(false);
    dialog.remove();
  });

  it("Cmd/Ctrl+K still toggles when a list in a dialog already claimed the key", () => {
    mount();
    const list = document.createElement("div");
    list.addEventListener("keydown", (event) => event.preventDefault());
    document.body.appendChild(list);
    press("k", { ctrlKey: true }, list);
    expect(useUiStore.getState().paletteOpen).toBe(true);
    list.remove();
  });

  it("/ focuses the search field and is left alone when there is none", () => {
    mount();
    press("/");
    expect(screen.getByLabelText("search")).toHaveFocus();
  });

  it("acts on the cursor card: F, E, Backspace, Enter, M, T, Space", () => {
    mount();
    press("f");
    expect(toggleFavorite).not.toHaveBeenCalled();
    useUiStore.setState({ cursorId: A });
    press("f");
    expect(toggleFavorite).toHaveBeenCalledWith(expect.objectContaining({ id: A }));
    press("e");
    expect(archive).toHaveBeenCalledWith(expect.objectContaining({ id: A }));
    // E and Backspace move the cursor off the card that leaves (tested below); put it back.
    useUiStore.setState({ cursorId: A });
    press("Backspace");
    expect(trash).toHaveBeenCalledWith(expect.objectContaining({ id: A }));
    useUiStore.setState({ cursorId: A });
    press("Enter");
    expect(openItem).toHaveBeenCalledWith(expect.objectContaining({ id: A }));
    press("m");
    expect(useUiStore.getState().shortcutDialog).toBe("move");
    useUiStore.setState({ shortcutDialog: null });
    press("t");
    expect(useUiStore.getState().shortcutDialog).toBe("tag");
    useUiStore.setState({ shortcutDialog: null });
    press(" ");
    expect(useUiStore.getState().shortcutDialog).toBe("quick-look");
  });

  it("E or Backspace on the cursor card moves the cursor to the next card, or back at the end", () => {
    mount();
    act(() => useUiStore.getState().setCursor(A));
    press("e");
    expect(archive).toHaveBeenCalledWith(expect.objectContaining({ id: A }));
    expect(useUiStore.getState().cursorId).toBe(B);
    press("Backspace");
    expect(trash).toHaveBeenCalledWith(expect.objectContaining({ id: B }));
    expect(useUiStore.getState().cursorId).toBe(A);
  });

  it("F leaves the cursor where it is", () => {
    mount();
    act(() => useUiStore.getState().setCursor(A));
    press("f");
    expect(useUiStore.getState().cursorId).toBe(A);
  });

  it("acts on the selection when there is one", () => {
    mount();
    useUiStore.setState({ cursorId: A, selectedIds: [A, B] });
    press("e");
    expect(batch).toHaveBeenCalledWith([A, B], { type: "archive" });
    press("Delete");
    expect(batch).toHaveBeenCalledWith([A, B], { type: "trash" });
    press("f");
    expect(batch).toHaveBeenCalledWith([A, B], { type: "favorite" });
    expect(archive).not.toHaveBeenCalled();
  });

  it("board keys do nothing without cards on screen", () => {
    render(
      <QueryClientProvider client={makeTestQueryClient()}>
        <ShortcutsHost />
      </QueryClientProvider>,
    );
    useUiStore.setState({ cursorId: A });
    press("m");
    expect(useUiStore.getState().shortcutDialog).toBeNull();
  });
});
