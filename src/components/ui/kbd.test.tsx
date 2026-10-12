import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Kbd } from "./kbd";

describe("Kbd", () => {
  it("renders children as a single key", () => {
    render(<Kbd>/</Kbd>);
    expect(screen.getByText("/").tagName).toBe("KBD");
  });

  it("renders multiple keys as a group", () => {
    const { container } = render(<Kbd keys={["⌘", "Shift", "K"]} />);
    const group = container.querySelector("[data-slot=kbd-group]");
    expect(group).not.toBeNull();
    const keys = group?.querySelectorAll("[data-slot=kbd]");
    expect(Array.from(keys ?? []).map((key) => key.textContent)).toEqual(["⌘", "Shift", "K"]);
  });

  it("has a 20px minimum width and tabular numerals", () => {
    render(<Kbd>1</Kbd>);
    expect(screen.getByText("1")).toHaveClass("min-w-5", "tabular-nums");
  });
});
