import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ViewSpec } from "@/lib/views";
import { EmptyState, emptyCopy } from "./empty-state";

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
    const copy = emptyCopy(view);
    expect(copy.heading).toBe(heading);
    if (body !== null) expect(copy.body).toBe(body);
  });

  it("names the tag", () => {
    expect(emptyCopy({ type: "tag", tagId: ID }, "thesis").heading).toBe(
      "Nothing tagged #thesis yet.",
    );
  });

  it("reads naturally for the Other format", () => {
    expect(emptyCopy({ type: "kind", kind: "other" }).heading).toBe("No other things yet.");
  });

  it("says the page does not exist for an unknown collection, tag or smart view", () => {
    expect(emptyCopy({ type: "collection", collectionId: ID }, null, true)).toEqual({
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
});
