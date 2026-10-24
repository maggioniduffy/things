import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUiStore } from "@/stores/ui-store";
import { makeItem, renderWithQuery } from "@/test/fixtures";
import { QuickLook } from "./quick-look";

const openItem = vi.hoisted(() => vi.fn());
vi.mock("@/components/drawer/item-param", () => ({ useOpenItem: () => openItem }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

const A = makeItem({
  id: "00000000-0000-4000-8000-000000000001",
  title: "Alpha",
  kind: "link",
  url: "https://example.com/a",
  domain: "example.com",
  note: "A short note",
});
const B = makeItem({ id: "00000000-0000-4000-8000-000000000002", title: "Beta" });

function mount() {
  return renderWithQuery(
    <div>
      <ul>
        <li data-item-id={A.id} />
        <li data-item-id={B.id} />
      </ul>
      <QuickLook items={[A, B]} />
    </div>,
  );
}

describe("QuickLook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUiStore.setState({ cursorId: A.id, shortcutDialog: "quick-look" });
  });

  it("shows the cursor item's title, domain and note", () => {
    mount();
    expect(screen.getByRole("dialog", { name: "Alpha" })).toBeInTheDocument();
    expect(screen.getByText("example.com")).toBeInTheDocument();
    expect(screen.getByText("A short note")).toBeInTheDocument();
  });

  it("renders nothing when closed", () => {
    useUiStore.setState({ shortcutDialog: null });
    mount();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Space closes it", async () => {
    mount();
    await userEvent.keyboard(" ");
    expect(useUiStore.getState().shortcutDialog).toBeNull();
  });

  it("Escape closes it", async () => {
    mount();
    await userEvent.keyboard("{Escape}");
    expect(useUiStore.getState().shortcutDialog).toBeNull();
  });

  it("J moves to the next card and the preview follows", async () => {
    mount();
    await userEvent.keyboard("j");
    expect(useUiStore.getState().cursorId).toBe(B.id);
    expect(await screen.findByRole("dialog", { name: "Beta" })).toBeInTheDocument();
    await userEvent.keyboard("{ArrowUp}");
    expect(useUiStore.getState().cursorId).toBe(A.id);
  });

  it("Enter closes it and opens the item", async () => {
    mount();
    await userEvent.keyboard("{Enter}");
    expect(useUiStore.getState().shortcutDialog).toBeNull();
    expect(openItem).toHaveBeenCalledWith(A);
  });
});
