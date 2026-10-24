import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useUiStore } from "@/stores/ui-store";
import { makeCounts, makeTestQueryClient, renderWithQuery } from "@/test/fixtures";
import { Sidebar } from "./sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app/f/note",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

const COLLECTION_ID = "33333333-3333-4333-8333-333333333333";
const TAG_ID = "44444444-4444-4444-8444-444444444444";

function seed(
  options: {
    collections?: boolean;
    tags?: boolean;
    smart?: boolean;
  } = {},
) {
  const client = makeTestQueryClient();
  client.setQueryData(
    ["counts"],
    makeCounts({
      inbox: 5,
      all: 7,
      unread: 7,
      favorites: 1,
      archive: 2,
      trash: 0,
      kinds: { note: 3, link: 2, pdf: 1 },
      collections: { [COLLECTION_ID]: 2 },
    }),
  );
  client.setQueryData(
    ["collections"],
    options.collections
      ? [{ id: COLLECTION_ID, name: "Reading list", emoji: "📚", color: null, position: "a0" }]
      : [],
  );
  client.setQueryData(["tags"], options.tags ? [{ id: TAG_ID, name: "thesis", color: null }] : []);
  client.setQueryData(
    ["smart-views"],
    options.smart
      ? [{ id: TAG_ID, name: "Unread PDFs", icon: null, position: "a0", rules: {} }]
      : [],
  );
  return client;
}

describe("Sidebar", () => {
  it("lists only the formats that have items, in kind order, with counts", () => {
    renderWithQuery(<Sidebar email={null} />, seed());
    const formats = screen.getByRole("list", { name: "Formats" });
    const links = within(formats).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Links2", "PDFs1", "Notes3"]);
    expect(screen.queryByRole("link", { name: /^Videos/ })).not.toBeInTheDocument();
  });

  it("hides the Formats section when no format has items", () => {
    const client = seed();
    client.setQueryData(["counts"], makeCounts());
    renderWithQuery(<Sidebar email={null} />, client);
    expect(screen.queryByRole("heading", { name: "Formats" })).not.toBeInTheDocument();
  });

  it("shows counts from the query data only when above zero", () => {
    renderWithQuery(<Sidebar email={null} />, seed());
    const inbox = screen.getByRole("link", { name: /^Inbox/ });
    expect(within(inbox).getByText("5")).toBeInTheDocument();
    expect(
      within(screen.getByRole("link", { name: /^Archive/ })).getByText("2"),
    ).toBeInTheDocument();
    // Trash has 0 items: no count.
    expect(
      within(screen.getByRole("link", { name: /^Trash/ })).queryByText("0"),
    ).not.toBeInTheDocument();
  });

  it("marks the current view", () => {
    renderWithQuery(<Sidebar email={null} />, seed());
    expect(screen.getByRole("link", { name: /^Notes/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /^Inbox/ })).not.toHaveAttribute("aria-current");
  });

  it("says so when there are no collections", () => {
    renderWithQuery(<Sidebar email={null} />, seed());
    expect(screen.getByText("No collections yet")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Tags" })).not.toBeInTheDocument();
    // Smart views always show, with a way to create the first one.
    expect(screen.getByRole("heading", { name: "Smart views" })).toBeInTheDocument();
    expect(screen.getByText("No smart views yet")).toBeInTheDocument();
  });

  it("lists collections with emoji and count, tags and smart views", () => {
    renderWithQuery(<Sidebar email={null} />, seed({ collections: true, tags: true, smart: true }));
    const collection = screen.getByRole("link", { name: /Reading list/ });
    expect(collection).toHaveAttribute("href", `/app/c/${COLLECTION_ID}`);
    expect(within(collection).getByText("📚")).toBeInTheDocument();
    expect(within(collection).getByText("2")).toBeInTheDocument();
    expect(screen.queryByText("No collections yet")).not.toBeInTheDocument();

    expect(screen.getByRole("link", { name: "#thesis" })).toHaveAttribute(
      "href",
      `/app/t/${TAG_ID}`,
    );
    expect(screen.getByRole("link", { name: "Unread PDFs" })).toHaveAttribute(
      "href",
      `/app/v/${TAG_ID}`,
    );
  });

  it("shows who is signed in and a sign-out button", () => {
    const { unmount } = renderWithQuery(<Sidebar email={null} />, seed());
    const account = screen.getByRole("group", { name: "Account" });
    expect(account).toHaveTextContent("Guest");
    expect(within(account).getByRole("button", { name: "Sign out" })).toBeInTheDocument();
    unmount();

    renderWithQuery(<Sidebar email="ada@example.com" />, seed());
    expect(screen.getByRole("group", { name: "Account" })).toHaveTextContent("ada@example.com");
  });

  it("hides itself from the header icon and from the app name", async () => {
    const onClose = vi.fn();
    renderWithQuery(<Sidebar email={null} onClose={onClose} />, seed());
    await userEvent.click(screen.getByRole("button", { name: "Hide sidebar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByText("Thing", { exact: false }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("has no hide controls without onClose", () => {
    renderWithQuery(<Sidebar email={null} />, seed());
    expect(screen.queryByRole("button", { name: "Hide sidebar" })).not.toBeInTheDocument();
  });

  it("replays the tour from the account area", async () => {
    useUiStore.setState({ tourOpen: false });
    const onNavigate = vi.fn();
    renderWithQuery(<Sidebar email={null} onNavigate={onNavigate} />, seed());
    await userEvent.click(screen.getByRole("button", { name: "Show the tour" }));
    expect(useUiStore.getState().tourOpen).toBe(true);
    expect(onNavigate).toHaveBeenCalled();
  });
});
