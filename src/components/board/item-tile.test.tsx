import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUploadStore } from "@/stores/upload-store";
import { makeItem } from "@/test/fixtures";
import { ItemTile, isStalePending, itemDisplayTitle } from "./item-tile";

describe("itemDisplayTitle", () => {
  it("falls back from title to url to file name to Untitled", () => {
    expect(itemDisplayTitle(makeItem({ title: "Hello", url: "https://a.example" }))).toBe("Hello");
    expect(itemDisplayTitle(makeItem({ title: null, url: "https://a.example" }))).toBe(
      "https://a.example",
    );
    expect(itemDisplayTitle(makeItem({ title: null, file_name: "thesis.pdf" }))).toBe("thesis.pdf");
    expect(itemDisplayTitle(makeItem({ title: "", url: null, file_name: null }))).toBe("Untitled");
  });

  it("uses the trimmed note text when there is no title, cut at about 140 characters", () => {
    expect(itemDisplayTitle(makeItem({ title: null, note: "  Buy milk\nand eggs  " }))).toBe(
      "Buy milk\nand eggs",
    );
    const long = itemDisplayTitle(makeItem({ title: null, note: "word ".repeat(100) }));
    expect(long.length).toBeLessThanOrEqual(141);
    expect(long.endsWith("…")).toBe(true);
    expect(itemDisplayTitle(makeItem({ title: "Named", note: "body" }))).toBe("Named");
  });
});

describe("ItemTile", () => {
  it("shows title, kind badge and domain in the grid", () => {
    render(
      <ul>
        <ItemTile
          variant="grid"
          item={makeItem({ kind: "link", title: "A link", domain: "example.com" })}
        />
      </ul>,
    );
    expect(screen.getByText("A link")).toBeInTheDocument();
    expect(screen.getByText("Link")).toBeInTheDocument();
    expect(screen.getByText("example.com")).toBeInTheDocument();
  });

  it("renders a row in the list variant", () => {
    const { container } = render(
      <ul>
        <ItemTile variant="list" item={makeItem({ kind: "pdf", title: "Paper" })} />
      </ul>,
    );
    expect(container.querySelector('[data-slot="item-row"]')).toBeInTheDocument();
    expect(screen.getByText("PDF")).toBeInTheDocument();
  });
});

describe("ItemTile capture status", () => {
  beforeEach(() => useUploadStore.setState({ progress: {} }));

  function renderGrid(props: Parameters<typeof ItemTile>[0]) {
    return render(
      <ul>
        <ItemTile {...props} />
      </ul>,
    );
  }

  it("exposes the enrich status on the root", () => {
    const { container } = renderGrid({
      variant: "grid",
      item: makeItem({ enrich_status: "done" }),
    });
    expect(container.querySelector('[data-slot="item-tile"]')).toHaveAttribute(
      "data-enrich-status",
      "done",
    );
  });

  it("shows a skeleton and aria-busy while pending", () => {
    const { container } = renderGrid({
      variant: "grid",
      item: makeItem({
        kind: "link",
        url: "https://a.example",
        title: null,
        enrich_status: "pending",
        updated_at: new Date().toISOString(),
      }),
    });
    expect(container.querySelector('[data-slot="item-tile"]')).toHaveAttribute("aria-busy", "true");
    expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("shows determinate upload progress", () => {
    const item = makeItem({ kind: "pdf", enrich_status: "pending" });
    useUploadStore.setState({ progress: { [item.id]: { loaded: 25, total: 100 } } });
    renderGrid({ variant: "grid", item });
    expect(screen.getByRole("progressbar", { name: "Uploading" })).toHaveAttribute(
      "aria-valuenow",
      "25",
    );
  });

  it("shows an indeterminate bar when progress is unknown", () => {
    const item = makeItem({ kind: "pdf", enrich_status: "pending" });
    useUploadStore.setState({ progress: { [item.id]: null } });
    renderGrid({ variant: "grid", item });
    expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
  });

  it("offers Retry on a failed link and calls the handler with the item", async () => {
    const onRetry = vi.fn();
    const item = makeItem({ kind: "link", url: "https://a.example", enrich_status: "failed" });
    renderGrid({ variant: "grid", item, onRetry });
    expect(screen.getByText("Couldn't fetch details")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledWith(item);
  });

  it("shows no Retry on a done item", () => {
    renderGrid({ variant: "grid", item: makeItem({ enrich_status: "done" }), onRetry: vi.fn() });
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("shows the note text when a note has no title", () => {
    renderGrid({
      variant: "grid",
      item: makeItem({ kind: "note", title: null, note: "Remember this" }),
    });
    expect(screen.getByText("Remember this")).toBeInTheDocument();
  });

  it("renders the signed thumbnail, falling back to the remote image", () => {
    const { container, rerender } = renderGrid({
      variant: "grid",
      item: makeItem({ kind: "image", image_url: "https://img.example/og.png" }),
      thumbnailUrl: "https://signed.example/t.webp",
    });
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "https://signed.example/t.webp");
    expect(img).toHaveAttribute("alt", "");
    expect(img).toHaveAttribute("loading", "lazy");

    rerender(
      <ul>
        <ItemTile
          variant="grid"
          item={makeItem({ kind: "link", image_url: "https://img.example/og.png" })}
        />
      </ul>,
    );
    expect(container.querySelector("img")).toHaveAttribute("src", "https://img.example/og.png");
  });

  it("has no thumbnail in list rows", () => {
    const { container } = render(
      <ul>
        <ItemTile
          variant="list"
          item={makeItem({ image_url: "https://img.example/og.png" })}
          thumbnailUrl="https://signed.example/t.webp"
        />
      </ul>,
    );
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });
});

describe("isStalePending", () => {
  const NOW = Date.parse("2026-01-01T00:10:00Z");
  const link = (overrides: Partial<Parameters<typeof makeItem>[0]>) =>
    makeItem({ kind: "link", url: "https://a.example", enrich_status: "pending", ...overrides });

  it("is true for a pending link last updated more than 2 minutes ago", () => {
    expect(isStalePending(link({ updated_at: "2026-01-01T00:07:59Z" }), NOW)).toBe(true);
  });

  it("is false up to and including 2 minutes", () => {
    expect(isStalePending(link({ updated_at: "2026-01-01T00:08:00Z" }), NOW)).toBe(false);
    expect(isStalePending(link({ updated_at: "2026-01-01T00:09:59Z" }), NOW)).toBe(false);
  });

  it("is false without a url, when not pending, or with an unreadable date", () => {
    const old = "2026-01-01T00:00:00Z";
    expect(isStalePending(link({ updated_at: old, url: null }), NOW)).toBe(false);
    expect(isStalePending(link({ updated_at: old, enrich_status: "failed" }), NOW)).toBe(false);
    expect(isStalePending(link({ updated_at: old, enrich_status: "done" }), NOW)).toBe(false);
    expect(isStalePending(link({ updated_at: "not a date" }), NOW)).toBe(false);
  });

  it("covers a pending file whose upload is not running in this tab", () => {
    const old = "2026-01-01T00:00:00Z";
    const pendingFile = link({ updated_at: old, url: null, file_path: "u/i/a.pdf" });
    expect(isStalePending(pendingFile, NOW)).toBe(true);
    expect(isStalePending(pendingFile, NOW, true)).toBe(false);
  });
});

describe("ItemTile stale pending link", () => {
  const stale = makeItem({
    kind: "link",
    url: "https://a.example",
    enrich_status: "pending",
    updated_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  });

  it("shows the failed state with Retry instead of a skeleton", () => {
    const { container } = render(
      <ul>
        <ItemTile variant="grid" item={stale} onRetry={vi.fn()} />
      </ul>,
    );
    expect(screen.getByText("Couldn't fetch details")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(container.querySelector('[data-slot="skeleton"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-slot="item-tile"]')).not.toHaveAttribute("aria-busy");
  });

  it("does the same in the list variant", () => {
    render(
      <ul>
        <ItemTile variant="list" item={stale} onRetry={vi.fn()} />
      </ul>,
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("goes back to the skeleton while the retry runs", async () => {
    let finish: () => void = () => {};
    const onRetry = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const { container } = render(
      <ul>
        <ItemTile variant="grid" item={stale} onRetry={onRetry} />
      </ul>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    finish();
    expect(await screen.findByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("turns a pending link into Retry once it goes stale while shown", () => {
    vi.useFakeTimers();
    try {
      const almostStale = {
        ...stale,
        updated_at: new Date(Date.now() - 2 * 60 * 1000 + 10_000).toISOString(),
      };
      render(
        <ul>
          <ItemTile variant="grid" item={almostStale} onRetry={vi.fn()} />
        </ul>,
      );
      expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
      act(() => {
        vi.advanceTimersByTime(30_000);
      });
      expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("says an interrupted file upload didn't finish, without a link Retry", () => {
    render(
      <ul>
        <ItemTile
          variant="grid"
          item={{ ...stale, url: null, file_path: "u/i/a.pdf" }}
          onRetry={vi.fn()}
        />
      </ul>,
    );
    expect(screen.getByText("Upload didn't finish")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("keeps a pending file that is uploading in this tab as a skeleton", () => {
    const uploadingFile = { ...stale, url: null, file_path: "u/i/a.pdf" };
    useUploadStore.getState().set(uploadingFile.id, null);
    try {
      const { container } = render(
        <ul>
          <ItemTile variant="grid" item={uploadingFile} />
        </ul>,
      );
      expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
    } finally {
      useUploadStore.getState().clear(uploadingFile.id);
    }
  });

  it("leaves a fresh pending link as a skeleton", () => {
    const { container } = render(
      <ul>
        <ItemTile
          variant="grid"
          item={{ ...stale, updated_at: new Date().toISOString() }}
          onRetry={vi.fn()}
        />
      </ul>,
    );
    expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });
});
