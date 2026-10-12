import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Grain } from "./grain";

describe("Grain", () => {
  it("is decorative and ignores pointer events", () => {
    const { container } = render(<Grain />);
    const el = container.firstElementChild;
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el).toHaveClass("pointer-events-none", "fixed", "mix-blend-multiply");
    expect(el).toHaveStyle({ opacity: "0.08" });
  });

  it("accepts opacity and className", () => {
    const { container } = render(<Grain opacity={0.2} className="extra" />);
    expect(container.firstElementChild).toHaveStyle({ opacity: "0.2" });
    expect(container.firstElementChild).toHaveClass("extra");
  });
});
