import { screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setActiveLocale } from "@/i18n/active";
import { I18nProvider } from "@/i18n/client";
import { makeCounts, makeTestQueryClient, renderWithQuery } from "@/test/fixtures";
import { Sidebar } from "./sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/app",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({}) }));

describe("Sidebar in Spanish", () => {
  afterEach(() => setActiveLocale("en"));

  it("names the views, sections and account controls in Spanish", () => {
    const client = makeTestQueryClient();
    client.setQueryData(["counts"], makeCounts({ kinds: { image: 2 } }));
    client.setQueryData(["collections"], []);
    client.setQueryData(["tags"], []);
    client.setQueryData(["smart-views"], []);
    renderWithQuery(
      <I18nProvider locale="es">
        <Sidebar email={null} />
      </I18nProvider>,
      client,
    );
    expect(screen.getByRole("navigation", { name: "Barra lateral" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Bandeja de entrada/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Sin abrir/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Papelera/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Imágenes/ })).toBeInTheDocument();
    expect(screen.getByText("Todavía no hay colecciones")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nueva colección" })).toBeInTheDocument();
    const account = screen.getByRole("group", { name: "Cuenta" });
    expect(account).toHaveTextContent("Invitado");
    expect(within(account).getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
  });
});
