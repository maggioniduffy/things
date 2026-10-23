import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { setActiveLocale } from "@/i18n/active";
import { I18nProvider } from "@/i18n/client";
import { EmptyState } from "./empty-state";

describe("EmptyState in Spanish", () => {
  afterEach(() => setActiveLocale("en"));

  it("speaks rioplatense Spanish", () => {
    render(
      <I18nProvider locale="es">
        <EmptyState view={{ type: "trash" }} />
      </I18nProvider>,
    );
    expect(screen.getByRole("heading", { name: "La papelera está vacía." })).toBeInTheDocument();
    expect(
      screen.getByText("Las cosas de la papelera se eliminan a los 30 días."),
    ).toBeInTheDocument();
  });

  it("translates the not-found page and its button", () => {
    render(
      <I18nProvider locale="es">
        <EmptyState view={{ type: "tag", tagId: "x" }} unknown />
      </I18nProvider>,
    );
    expect(screen.getByText("Esta página no existe.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir a la bandeja de entrada" })).toHaveAttribute(
      "href",
      "/app",
    );
  });

  it("uses the lower-case Spanish kind name", () => {
    render(
      <I18nProvider locale="es">
        <EmptyState view={{ type: "kind", kind: "image" }} />
      </I18nProvider>,
    );
    expect(screen.getByText("Todavía no hay imágenes.")).toBeInTheDocument();
  });
});
