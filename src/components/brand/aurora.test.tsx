import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Aurora } from "./aurora";

function blobs(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>("[data-aurora-blob]"));
}

describe("Aurora", () => {
  it("is decorative, non-interactive and positioned by its parent", () => {
    const { container } = render(<Aurora />);
    const el = container.firstElementChild;
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el).toHaveClass("pointer-events-none", "absolute");
    expect(blobs(container)).toHaveLength(5);
  });

  it("drifts by default", () => {
    const { container } = render(<Aurora />);
    expect(blobs(container).every((b) => /animate-aurora/.test(b.className))).toBe(true);
  });

  it("has no animation class when animated={false}", () => {
    const { container } = render(<Aurora animated={false} />);
    expect(container.innerHTML).not.toMatch(/animate-/);
  });

  it("subtle variant is shorter and fainter", () => {
    const { container } = render(<Aurora variant="subtle" />);
    expect(container.firstElementChild).toHaveAttribute("data-variant", "subtle");
    expect(container.firstElementChild).toHaveClass("opacity-60");
  });
});
