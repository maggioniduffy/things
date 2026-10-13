import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardItem } from "@/lib/items/queries";
import { useUploadStore } from "@/stores/upload-store";
import { makeItem } from "@/test/fixtures";
import type { ItemKind } from "@/types/supabase";
import { ItemCard, cardTypeFor } from "./item-card";
import type { CardType, CardVariant } from "./types";

function renderCard(item: BoardItem, variant: CardVariant = "grid", extra = {}) {
  return render(
    <ul>
      <ItemCard item={item} variant={variant} {...extra} />
    </ul>,
  );
}

const KIND_TO_CARD: [ItemKind, CardType][] = [
  ["link", "link"],
  ["article", "link"],
  ["video", "video"],
  ["image", "image"],
  ["pdf", "pdf"],
  ["note", "note"],
  ["document", "file"],
  ["audio", "file"],
  ["code", "file"],
  ["other", "file"],
];

describe("ItemCard dispatch", () => {
  it.each(KIND_TO_CARD)("renders %s as the %s card", (kind, card) => {
    expect(cardTypeFor(kind)).toBe(card);
    for (const variant of ["grid", "list"] as const) {
      const { container, unmount } = renderCard(makeItem({ kind, title: "Thing" }), variant);
      const root = container.querySelector(
        variant === "grid" ? '[data-slot="item-tile"]' : '[data-slot="item-row"]',
      );
      expect(root).toHaveAttribute("data-card", card);
      unmount();
    }
  });
});

describe("ItemCard content per kind", () => {
  it("link: image, title, favicon, site name and domain", () => {
    const { container } = renderCard(
      makeItem({
        kind: "article",
        title: "A post",
        image_url: "https://img.example/og.png",
        favicon_url: "https://example.com/favicon.ico",
        site_name: "Example Blog",
        domain: "example.com",
      }),
    );
    const imgs = container.querySelectorAll("img");
    expect(imgs[0]).toHaveAttribute("src", "https://img.example/og.png");
    expect(imgs[1]).toHaveAttribute("src", "https://example.com/favicon.ico");
    expect(imgs[1]).toHaveAttribute("referrerpolicy", "no-referrer");
    expect(screen.getByText("Article")).toBeInTheDocument();
    expect(screen.getByText("Example Blog")).toBeInTheDocument();
    expect(screen.getByText("example.com")).toBeInTheDocument();
  });

  it("link: does not repeat a site name equal to the domain, and has no image slot", () => {
    const { container } = renderCard(
      makeItem({ kind: "link", title: "A link", site_name: "example.com", domain: "example.com" }),
    );
    expect(screen.getAllByText("example.com")).toHaveLength(1);
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("video: thumbnail with a play glyph and the provider", () => {
    const { container } = renderCard(
      makeItem({
        kind: "video",
        title: "A talk",
        image_url: "https://img.example/t.jpg",
        site_name: "YouTube",
        domain: "youtube.com",
      }),
    );
    expect(container.querySelector("img")).toHaveAttribute("src", "https://img.example/t.jpg");
    expect(container.querySelector("svg.lucide-play")).toBeInTheDocument();
    expect(screen.getByText("YouTube")).toBeInTheDocument();
  });

  it("video without a thumbnail keeps a placeholder with the play glyph", () => {
    const { container } = renderCard(makeItem({ kind: "video", title: "A talk" }));
    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(container.querySelector("svg.lucide-play")).toBeInTheDocument();
  });

  it("image: the picture and a small title", () => {
    const { container } = renderCard(makeItem({ kind: "image", title: "Sunset" }), "grid", {
      thumbnailUrl: "https://signed.example/t.webp",
    });
    expect(container.querySelector("img")).toHaveAttribute("src", "https://signed.example/t.webp");
    expect(screen.getByText("Sunset")).toHaveClass("text-meta");
  });

  it("pdf: page-1 thumbnail, title, PDF badge and size", () => {
    const { container } = renderCard(
      makeItem({ kind: "pdf", title: "Paper", file_size: 2 * 1024 * 1024 }),
      "grid",
      { thumbnailUrl: "https://signed.example/p1.webp" },
    );
    expect(container.querySelector("img")).toHaveAttribute("src", "https://signed.example/p1.webp");
    expect(screen.getByText("PDF")).toBeInTheDocument();
    expect(screen.getByText("2 MB")).toBeInTheDocument();
  });

  it("note: shows a text excerpt and never a thumbnail", () => {
    const { container } = renderCard(
      makeItem({
        kind: "note",
        title: "Groceries",
        note: "Milk\nEggs",
        image_url: "https://img.example/x.png",
      }),
    );
    expect(screen.getByText("Groceries")).toBeInTheDocument();
    expect(screen.getByText(/Milk/)).toBeInTheDocument();
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("note without a title shows its text once", () => {
    renderCard(makeItem({ kind: "note", title: null, note: "Remember this" }));
    expect(screen.getAllByText("Remember this")).toHaveLength(1);
  });

  it("file: kind icon, file name and size, no thumbnail", () => {
    const { container } = renderCard(
      makeItem({ kind: "code", title: null, file_name: "main.rs", file_size: 34 * 1024 }),
      "grid",
      { thumbnailUrl: "https://signed.example/t.webp" },
    );
    expect(screen.getByText("main.rs")).toBeInTheDocument();
    expect(screen.getByText("34 KB")).toBeInTheDocument();
    expect(container.querySelector("svg.lucide-code")).toBeInTheDocument();
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("shows the favorite and unread markers only when they apply", () => {
    const { unmount } = renderCard(makeItem({ is_favorite: true, is_read: false }));
    expect(screen.getByRole("img", { name: "Favorite" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Unread" })).toBeInTheDocument();
    unmount();
    renderCard(makeItem({ is_favorite: false, is_read: true }));
    expect(screen.queryByRole("img", { name: "Favorite" })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Unread" })).not.toBeInTheDocument();
  });
});

describe("ItemCard open button", () => {
  it.each(["grid", "list"] as const)(
    "is named after the title in the %s variant",
    async (variant) => {
      const onOpen = vi.fn();
      const item = makeItem({ kind: "link", title: "A link" });
      renderCard(item, variant, { onOpen });
      await userEvent.click(screen.getByRole("button", { name: "Open A link" }));
      expect(onOpen).toHaveBeenCalledWith(item);
    },
  );

  it("does nothing without an onOpen handler", async () => {
    renderCard(makeItem({ title: "A note" }));
    await userEvent.click(screen.getByRole("button", { name: "Open A note" }));
  });

  it("keeps the title as the first paragraph of a grid card", () => {
    const { container } = renderCard(
      makeItem({ kind: "link", title: "A link", domain: "example.com" }),
    );
    expect(container.querySelector('[data-slot="item-tile"] > p:first-of-type')).toHaveTextContent(
      "A link",
    );
  });
});

describe("ItemCard states", () => {
  const states = [
    ["pending", { enrich_status: "pending", updated_at: new Date().toISOString() }],
    ["failed", { enrich_status: "failed" }],
  ] as const;

  it.each(
    (["grid", "list"] as const).flatMap((variant) =>
      states.map(([state, patch]) => [variant, state, patch] as const),
    ),
  )("%s variant, %s link", (variant, state, patch) => {
    const { container } = renderCard(
      makeItem({ kind: "link", url: "https://a.example", title: null, ...patch }),
      variant,
      { onRetry: vi.fn() },
    );
    const root = container.querySelector("li");
    expect(root).toHaveAttribute("data-enrich-status", state);
    if (state === "pending") {
      expect(root).toHaveAttribute("aria-busy", "true");
      expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
    } else {
      expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
      expect(screen.getByText("Couldn't fetch details")).toBeInTheDocument();
    }
  });

  it.each(["video", "image", "pdf"] as const)(
    "pending %s shows a skeleton in the media slot",
    (kind) => {
      const { container } = renderCard(
        makeItem({
          kind,
          file_path: "u/i/a.bin",
          enrich_status: "pending",
          updated_at: new Date().toISOString(),
        }),
      );
      expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThanOrEqual(2);
    },
  );
});

describe("ItemCard capture status", () => {
  beforeEach(() => useUploadStore.setState({ progress: {} }));

  function renderGrid(props: Parameters<typeof ItemCard>[0]) {
    return render(
      <ul>
        <ItemCard {...props} />
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
        <ItemCard
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
        <ItemCard
          variant="list"
          item={makeItem({ image_url: "https://img.example/og.png" })}
          thumbnailUrl="https://signed.example/t.webp"
        />
      </ul>,
    );
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });
});

describe("ItemCard stale pending link", () => {
  const stale = makeItem({
    kind: "link",
    url: "https://a.example",
    enrich_status: "pending",
    updated_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  });

  it("shows the failed state with Retry instead of a skeleton", () => {
    const { container } = render(
      <ul>
        <ItemCard variant="grid" item={stale} onRetry={vi.fn()} />
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
        <ItemCard variant="list" item={stale} onRetry={vi.fn()} />
      </ul>,
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("goes back to the skeleton while the retry runs", async () => {
    let finish: () => void = () => {};
    const onRetry = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const { container } = render(
      <ul>
        <ItemCard variant="grid" item={stale} onRetry={onRetry} />
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
          <ItemCard variant="grid" item={almostStale} onRetry={vi.fn()} />
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
        <ItemCard
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
          <ItemCard variant="grid" item={uploadingFile} />
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
        <ItemCard
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
