import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "@/i18n/client";
import { Logo } from "./logo";

describe("Logo", () => {
  it("is named 'Thingteca' with the wordmark", () => {
    const { container } = render(
      <h1>
        <Logo />
      </h1>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Thingteca" })).toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("is named 'Thingteca' when mark-only", () => {
    render(<Logo showWordmark={false} />);
    expect(screen.getByRole("img", { name: "Thingteca" })).toBeInTheDocument();
    expect(screen.queryByText("Thingteca")).not.toBeInTheDocument();
  });

  it("scales the mark with size", () => {
    render(<Logo size={40} showWordmark={false} />);
    expect(screen.getByRole("img", { name: "Thingteca" })).toHaveAttribute("width", "40");
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

  it("sets the suffix apart: gradient in color, light weight in mono", () => {
    const { rerender } = render(<Logo />);
    expect(screen.getByText("teca")).toHaveClass("bg-clip-text", "text-transparent");
    rerender(<Logo variant="mono" />);
    expect(screen.getByText("teca")).toHaveClass("font-light");
  });

  it("is named 'Cosateca' inside the Spanish provider", () => {
    render(
      <I18nProvider locale="es">
        <h1>
          <Logo />
        </h1>
      </I18nProvider>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Cosateca" })).toBeInTheDocument();
  });
});
