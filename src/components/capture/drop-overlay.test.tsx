import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DropOverlay } from "./drop-overlay";

describe("DropOverlay", () => {
  it("renders nothing visual while hidden", () => {
    const { container } = render(<DropOverlay visible={false} />);
    expect(container.querySelector('[data-slot="drop-overlay"]')).not.toBeInTheDocument();
    expect(container.querySelector("[data-aurora]")).not.toBeInTheDocument();
  });

  it("shows the aurora and the message, aria-hidden and without pointer events", () => {
    const { container } = render(<DropOverlay visible />);
    const overlay = container.querySelector('[data-slot="drop-overlay"]');
    expect(overlay).toHaveAttribute("aria-hidden", "true");
    expect(overlay).toHaveClass("pointer-events-none", "fixed", "inset-0");
    expect(overlay?.querySelector("[data-aurora]")).toBeInTheDocument();
    expect(overlay).toHaveTextContent("Drop to save");
  });

  it("fades with opacity only and stops under reduced motion", () => {
    const { container } = render(<DropOverlay visible />);
    const overlay = container.querySelector('[data-slot="drop-overlay"]');
    expect(overlay).toHaveClass("fade-in-0", "motion-reduce:animate-none");
    expect(overlay?.className).not.toMatch(/translate|slide|zoom/);
  });

  it("announces through a visually hidden live region", () => {
    const { rerender } = render(<DropOverlay visible={false} />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    rerender(<DropOverlay visible />);
    expect(screen.getByRole("status")).toHaveTextContent("Drop to save");
    expect(screen.getByRole("status")).toHaveClass("sr-only");
  });
});
