import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/client";
import { OtpForm } from "./otp-form";

const mocks = vi.hoisted(() => ({
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithOtp: mocks.signInWithOtp,
      verifyOtp: mocks.verifyOtp,
      updateUser: mocks.updateUser,
    },
  }),
}));

beforeEach(() => {
  mocks.signInWithOtp.mockResolvedValue({ data: {}, error: null });
  mocks.verifyOtp.mockResolvedValue({
    data: { user: { user_metadata: { locale: "en" } } },
    error: null,
  });
  mocks.updateUser.mockResolvedValue({ data: {}, error: null });
});

afterEach(() => vi.clearAllMocks());

describe("OtpForm", () => {
  it("renders English by default", () => {
    render(<OtpForm onSignedIn={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Send code" })).toBeInTheDocument();
  });

  it("renders Spanish and sends the locale with the sign-in", async () => {
    const user = userEvent.setup();
    render(
      <I18nProvider locale="es">
        <OtpForm onSignedIn={vi.fn()} />
      </I18nProvider>,
    );
    expect(screen.getByRole("heading", { name: "Ingresá a Cosateca" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Email"), "me@example.com");
    await user.click(screen.getByRole("button", { name: "Enviar código" }));
    expect(mocks.signInWithOtp).toHaveBeenCalledWith({
      email: "me@example.com",
      options: expect.objectContaining({ data: { locale: "es" } }),
    });
    expect(await screen.findByText("Revisá tu email")).toBeInTheDocument();
  });

  it("updates the stored locale after verifying when it differs, without blocking", async () => {
    const user = userEvent.setup();
    const onSignedIn = vi.fn();
    render(
      <I18nProvider locale="es">
        <OtpForm onSignedIn={onSignedIn} />
      </I18nProvider>,
    );
    await user.type(screen.getByLabelText("Email"), "me@example.com");
    await user.click(screen.getByRole("button", { name: "Enviar código" }));
    await user.type(await screen.findByLabelText(/Ingresá el código de 6 dígitos/), "123456");
    await waitFor(() => expect(onSignedIn).toHaveBeenCalled());
    expect(mocks.updateUser).toHaveBeenCalledWith({ data: { locale: "es" } });
  });
});
