import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Logo } from "./logo";

describe("Logo", () => {
  it("is named 'Things' with the wordmark", () => {
    const { container } = render(
      <h1>
        <Logo />
      </h1>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Things" })).toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("is named 'Things' when mark-only", () => {
    render(<Logo showWordmark={false} />);
    expect(screen.getByRole("img", { name: "Things" })).toBeInTheDocument();
    expect(screen.queryByText("Things")).not.toBeInTheDocument();
  });

  it("scales the mark with size", () => {
    render(<Logo size={40} showWordmark={false} />);
    expect(screen.getByRole("img", { name: "Things" })).toHaveAttribute("width", "40");
  });

  it("uses currentColor and no gradients in the mono variant", () => {
    const { container } = render(<Logo variant="mono" showWordmark={false} />);
    expect(container.querySelector("linearGradient")).toBeNull();
    expect(container.querySelector("path")).toHaveAttribute("fill", "currentColor");
  });

  it("paints the color variant with gradients", () => {
    const { container } = render(<Logo showWordmark={false} />);
    expect(container.querySelectorAll("linearGradient")).toHaveLength(3);
    expect(container.querySelector("path")?.getAttribute("fill")).toMatch(/^url\(#/);
  });
});
