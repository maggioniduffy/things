import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CardsSection } from "./cards";

describe("styleguide cards section", () => {
  it("lists every card type in each state, as grid cards and list rows", () => {
    const { container } = render(<CardsSection />);
    for (const state of ["pending", "done", "failed"]) {
      for (const [variant, slot] of [
        ["Grid", "item-tile"],
        ["List", "item-row"],
      ]) {
        const list = screen.getByRole("list", { name: `${variant} cards, ${state}` });
        const cards = list.querySelectorAll(`[data-slot="${slot}"]`);
        expect(cards).toHaveLength(8);
        expect(new Set([...cards].map((el) => el.getAttribute("data-card")))).toEqual(
          new Set(["link", "video", "image", "pdf", "note", "file"]),
        );
        for (const card of cards) expect(card).toHaveAttribute("data-enrich-status", state);
      }
    }
    // 48 state cards plus the "Note colors" group (Default and the eight note colors).
    expect(
      container.querySelectorAll('[data-slot="item-tile"], [data-slot="item-row"]'),
    ).toHaveLength(57);
  });
});
