import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setActiveLocale } from "@/i18n/active";
import { I18nProvider } from "@/i18n/client";
import { renderWithQuery } from "@/test/fixtures";
import { Toolbar } from "./toolbar";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/app/trash",
  useSearchParams: () => new URLSearchParams(""),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

describe("Toolbar in Spanish", () => {
  afterEach(() => setActiveLocale("en"));

  it("titles the view and labels the controls in Spanish", () => {
    renderWithQuery(
      <I18nProvider locale="es">
        <Toolbar view={{ type: "trash" }} sort="newest" />
      </I18nProvider>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Papelera" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Orden: Más nuevas" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Vista de lista" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Agregar" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Buscar" })).toBeInTheDocument();
  });
});
