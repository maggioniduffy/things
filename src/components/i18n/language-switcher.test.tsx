import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/client";
import { LanguageSwitcher } from "./language-switcher";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const updateUser = vi.fn().mockResolvedValue({});
const getSession = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getSession, updateUser } }),
}));

describe("LanguageSwitcher", () => {
  beforeEach(() => {
    refresh.mockClear();
    updateUser.mockClear();
    getSession.mockReset().mockResolvedValue({ data: { session: null } });
    document.cookie = "locale=; path=/; max-age=0";
  });

  it("sets the locale cookie and refreshes", () => {
    render(<LanguageSwitcher />);
    expect(screen.getByRole("group", { name: "Language" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Español" }));
    expect(document.cookie).toContain("locale=es");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("marks the current language and ignores a click on it", () => {
    render(
      <I18nProvider locale="es">
        <LanguageSwitcher />
      </I18nProvider>,
    );
    expect(screen.getByRole("group", { name: "Idioma" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Español" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Español" }));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("saves the choice on the account when there is a session", async () => {
    getSession.mockResolvedValue({ data: { session: { user: {} } } });
    render(<LanguageSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: "Español" }));
    await vi.waitFor(() => expect(updateUser).toHaveBeenCalledWith({ data: { locale: "es" } }));
  });
});
