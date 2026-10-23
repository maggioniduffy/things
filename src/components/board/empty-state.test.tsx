import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { messages } from "@/i18n/messages";
import type { ViewSpec } from "@/lib/views";
import { useUiStore } from "@/stores/ui-store";
import { EmptyState, emptyCopy } from "./empty-state";

const shell = messages.en.shell;
const ID = "33333333-3333-4333-8333-333333333333";

const CASES: [string, ViewSpec, string, string | null][] = [
  [
    "inbox",
    { type: "inbox" },
    "Drop anything here.",
    "Links, files and notes you save will land here.",
  ],
  ["all", { type: "all" }, "Nothing saved yet.", "Links, files and notes you save will land here."],
  [
    "unread",
    { type: "unread" },
    "You're all caught up.",
    "Things you haven't opened yet show up here.",
  ],
  [
    "favorites",
    { type: "favorites" },
    "No favorites yet.",
    "Star the things you want to keep close.",
  ],
  [
    "archive",
    { type: "archive" },
    "Nothing archived.",
    "Archive things you're done with to keep your inbox calm.",
  ],
  ["trash", { type: "trash" }, "Trash is empty.", "Things in Trash are deleted after 30 days."],
  [
    "kind",
    { type: "kind", kind: "video" },
    "No videos yet.",
    "They'll show up here once you save some.",
  ],
  [
    "pdf kind",
    { type: "kind", kind: "pdf" },
    "No PDFs yet.",
    "They'll show up here once you save some.",
  ],
  [
    "collection",
    { type: "collection", collectionId: ID },
    "This collection is empty.",
    "Things you file here will show up here.",
  ],
  ["smart view", { type: "smart", viewId: ID }, "Nothing matches yet.", null],
];

describe("emptyCopy", () => {
  it.each(CASES)("%s", (_name, view, heading, body) => {
    const copy = emptyCopy(view, shell);
    expect(copy.heading).toBe(heading);
    if (body !== null) expect(copy.body).toBe(body);
  });

  it("names the tag", () => {
    expect(emptyCopy({ type: "tag", tagId: ID }, shell, "thesis").heading).toBe(
      "Nothing tagged #thesis yet.",
    );
  });

  it("reads naturally for the Other format", () => {
    expect(emptyCopy({ type: "kind", kind: "other" }, shell).heading).toBe("No other things yet.");
  });

  it("says the page does not exist for an unknown collection, tag or smart view", () => {
    expect(emptyCopy({ type: "collection", collectionId: ID }, shell, null, true)).toEqual({
      heading: "This page doesn't exist.",
      body: null,
    });
  });
});

describe("EmptyState", () => {
  it("renders the heading and line over the subtle aurora", () => {
    const { container } = render(<EmptyState view={{ type: "inbox" }} />);
    expect(screen.getByRole("heading", { name: "Drop anything here." })).toBeInTheDocument();
    expect(screen.getByText("Links, files and notes you save will land here.")).toBeInTheDocument();
    expect(container.querySelector('[data-aurora][data-variant="subtle"]')).toBeInTheDocument();
  });

  it("links back to the inbox when the page does not exist", () => {
    render(<EmptyState view={{ type: "collection", collectionId: ID }} unknown />);
    expect(screen.getByRole("heading", { name: "This page doesn't exist." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Inbox" })).toHaveAttribute("href", "/app");
  });

  describe("add card", () => {
    beforeEach(() => useUiStore.setState({ quickAddOpen: false, quickAddDefaults: null }));

    const SHOWN: [string, ViewSpec][] = [
      ["inbox", { type: "inbox" }],
      ["all", { type: "all" }],
      ["unread", { type: "unread" }],
      ["collection", { type: "collection", collectionId: ID }],
      ["kind", { type: "kind", kind: "video" }],
      ["tag", { type: "tag", tagId: ID }],
    ];
    const HIDDEN: [string, ViewSpec][] = [
      ["favorites", { type: "favorites" }],
      ["archive", { type: "archive" }],
      ["trash", { type: "trash" }],
      ["smart view", { type: "smart", viewId: ID }],
    ];

    it.each(SHOWN)("shows in the %s view", (_name, view) => {
      render(<EmptyState view={view} name="thesis" />);
      expect(screen.getByRole("button", { name: /Add something/ })).toBeInTheDocument();
      expect(screen.getByText("Paste a link, drop a file or write a note")).toBeInTheDocument();
    });

    it.each(HIDDEN)("is absent in the %s view", (_name, view) => {
      render(<EmptyState view={view} />);
      expect(screen.queryByRole("button", { name: /Add something/ })).not.toBeInTheDocument();
    });

    it("is absent on a page that does not exist", () => {
      render(<EmptyState view={{ type: "collection", collectionId: ID }} unknown />);
      expect(screen.queryByRole("button", { name: /Add something/ })).not.toBeInTheDocument();
    });

    it("opens quick add", () => {
      render(<EmptyState view={{ type: "inbox" }} />);
      fireEvent.click(screen.getByRole("button", { name: /Add something/ }));
      expect(useUiStore.getState().quickAddOpen).toBe(true);
      expect(useUiStore.getState().quickAddDefaults).toBeNull();
    });

    it("hands the tag to quick add in a tag view", () => {
      render(<EmptyState view={{ type: "tag", tagId: ID }} name="thesis" />);
      fireEvent.click(screen.getByRole("button", { name: /Add something/ }));
      expect(useUiStore.getState().quickAddDefaults).toEqual({ tagNames: ["thesis"] });
    });
  });
});
