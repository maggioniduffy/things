import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUploadStore } from "@/stores/upload-store";
import { makeItem } from "@/test/fixtures";
import { ItemTile, itemDisplayTitle } from "./item-tile";

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
