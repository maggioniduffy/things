import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
