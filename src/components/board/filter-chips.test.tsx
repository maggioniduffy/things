import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardSearch } from "@/lib/search-params";
import { makeItem, makeTestQueryClient, renderWithQuery } from "@/test/fixtures";
import { FilterChips } from "./filter-chips";

const nav = vi.hoisted(() => ({ replace: vi.fn(), search: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: nav.replace }),
  usePathname: () => "/app/all",
  useSearchParams: () => new URLSearchParams(nav.search),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

const TAG_ID = "44444444-4444-4444-8444-444444444444";

function search(overrides: Partial<BoardSearch> = {}): BoardSearch {
  return { q: "pan", kinds: [], tagIds: [], domains: [], statuses: [], ...overrides };
}

function renderChips(value: BoardSearch | null, items = [makeItem({ domain: "example.com" })]) {
  const client = makeTestQueryClient();
  client.setQueryData(["tags"], [{ id: TAG_ID, name: "thesis", color: null }]);
  return renderWithQuery(<FilterChips search={value} items={items} />, client);
}

describe("FilterChips", () => {
  beforeEach(() => {
    nav.replace.mockClear();
    nav.search = "";
  });

  it("renders nothing when not searching", () => {
    renderChips(null);
    expect(screen.queryByRole("group", { name: "Search filters" })).not.toBeInTheDocument();
  });

  it("shows only Add filter and Clear for a text-only search", () => {
    renderChips(search());
    expect(screen.getByRole("button", { name: "Add filter" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Remove filter/ })).not.toBeInTheDocument();
  });

  it("shows a removable chip per active filter", () => {
    nav.search = `q=pan&kind=note&tag=${TAG_ID}&domain=example.com&status=unread&sort=title`;
    renderChips(
      search({
        kinds: ["note"],
        tagIds: [TAG_ID],
        domains: ["example.com"],
        statuses: ["unread"],
      }),
    );
    for (const name of ["Notes", "#thesis", "example.com", "Unread"]) {
      expect(screen.getByRole("button", { name: `Remove filter: ${name}` })).toBeInTheDocument();
    }
  });

  it("removes a chip through the URL, keeping q and sort", async () => {
    nav.search = "q=pan&kind=note,pdf&sort=title";
    renderChips(search({ kinds: ["note", "pdf"] }));
    await userEvent.click(screen.getByRole("button", { name: "Remove filter: Notes" }));
    const [href] = nav.replace.mock.calls[0] as [string];
    const params = new URLSearchParams(href.split("?")[1]);
    expect(href.startsWith("/app/all?")).toBe(true);
    expect(params.get("kind")).toBe("pdf");
    expect(params.get("q")).toBe("pan");
    expect(params.get("sort")).toBe("title");
  });

  it("Clear resets q and the chips but keeps sort", async () => {
    nav.search = "q=pan&kind=note&status=read&sort=title";
    renderChips(search({ kinds: ["note"], statuses: ["read"] }));
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(nav.replace).toHaveBeenCalledWith("/app/all?sort=title", { scroll: false });
  });

  it("adds a kind from the Add filter menu", async () => {
    nav.search = "q=pan";
    renderChips(search());
    await userEvent.click(screen.getByRole("button", { name: "Add filter" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Kind" }));
    await userEvent.click(await screen.findByRole("menuitemcheckbox", { name: "PDFs" }));
    expect(nav.replace).toHaveBeenCalledWith("/app/all?q=pan&kind=pdf", { scroll: false });
  });

  it("offers the domains found in the results", async () => {
    nav.search = "q=pan";
    renderChips(search(), [
      makeItem({ id: "00000000-0000-4000-8000-000000000201", domain: "b.org" }),
      makeItem({ id: "00000000-0000-4000-8000-000000000202", domain: "a.com" }),
      makeItem({ id: "00000000-0000-4000-8000-000000000203", domain: null }),
    ]);
    await userEvent.click(screen.getByRole("button", { name: "Add filter" }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "Domain" }));
    const options = await screen.findAllByRole("menuitemcheckbox");
    expect(options.map((option) => option.textContent)).toEqual(["a.com", "b.org"]);
  });
});
