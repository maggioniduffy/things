import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UpgradeDialog } from "./upgrade-dialog";

const mocks = vi.hoisted(() => ({
  updateUser: vi.fn(),
  verifyOtp: vi.fn(),
  resend: vi.fn(),
  linkIdentity: vi.fn(),
  signOut: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh, replace: mocks.replace }),
}));

vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess, error: vi.fn() } }));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      updateUser: mocks.updateUser,
      verifyOtp: mocks.verifyOtp,
      resend: mocks.resend,
      linkIdentity: mocks.linkIdentity,
      signOut: mocks.signOut,
    },
  }),
}));

beforeEach(() => {
  mocks.updateUser.mockResolvedValue({ data: {}, error: null });
  mocks.verifyOtp.mockResolvedValue({ data: {}, error: null });
  mocks.resend.mockResolvedValue({ data: {}, error: null });
  mocks.linkIdentity.mockResolvedValue({ data: {}, error: null });
  mocks.signOut.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

function renderOpen(onOpenChange = vi.fn()) {
  render(<UpgradeDialog open onOpenChange={onOpenChange} />);
  return onOpenChange;
}

async function requestCode(user: ReturnType<typeof userEvent.setup>, email = "me@example.com") {
  await user.type(screen.getByLabelText("Email"), email);
  await user.click(screen.getByRole("button", { name: "Send code" }));
}

describe("UpgradeDialog", () => {
  it("asks for an email and requests an email_change code with the app callback", async () => {
    const user = userEvent.setup();
    renderOpen();
    await requestCode(user);

    expect(mocks.updateUser).toHaveBeenCalledWith(
      { email: "me@example.com" },
      { emailRedirectTo: `${window.location.origin}/auth/callback?next=/app` },
    );
    expect(await screen.findByLabelText(/Enter the 6-digit code we sent to/)).toBeInTheDocument();
  });

  it("verifies the code as email_change, confirms with a toast, closes and refreshes", async () => {
    const user = userEvent.setup();
    const onOpenChange = renderOpen();
    await requestCode(user);

    await user.type(await screen.findByLabelText(/Enter the 6-digit code/), "123456");

    await waitFor(() =>
      expect(mocks.verifyOtp).toHaveBeenCalledWith({
        email: "me@example.com",
        token: "123456",
        type: "email_change",
      }),
    );
    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Your things are saved to me@example.com."),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("shows an inline error for a wrong code and stays on the code step", async () => {
    mocks.verifyOtp.mockResolvedValue({
      data: {},
      error: { code: "otp_expired", status: 403, message: "Token has expired or is invalid" },
    });
    const user = userEvent.setup();
    renderOpen();
    await requestCode(user);
    await user.type(await screen.findByLabelText(/Enter the 6-digit code/), "000000");

    expect(
      await screen.findByText("That code didn't work. Check it or send a new one."),
    ).toBeInTheDocument();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("explains a conflict and offers to sign in instead", async () => {
    mocks.updateUser.mockResolvedValue({
      data: {},
      error: { code: "email_exists", status: 422, message: "already registered" },
    });
    const user = userEvent.setup();
    const onOpenChange = renderOpen();
    await requestCode(user, "taken@example.com");

    expect(
      await screen.findByText(
        "That email already has a Things account. Sign in to it instead — items saved as a guest won't move over yet.",
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sign in instead" }));
    await waitFor(() => expect(mocks.signOut).toHaveBeenCalled());
    expect(mocks.replace).toHaveBeenCalledWith("/login?next=/app");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("hides Link Google unless Google is enabled", () => {
    renderOpen();
    expect(screen.queryByRole("button", { name: "Link Google" })).not.toBeInTheDocument();
  });

  it("links Google with the app callback when enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_GOOGLE_ENABLED", "true");
    const user = userEvent.setup();
    renderOpen();
    await user.click(screen.getByRole("button", { name: "Link Google" }));
    expect(mocks.linkIdentity).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/app` },
    });
  });

  it("shows the conflict message when Google is already linked elsewhere", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_GOOGLE_ENABLED", "true");
    mocks.linkIdentity.mockResolvedValue({
      data: {},
      error: { code: "identity_already_exists", status: 422, message: "x" },
    });
    const user = userEvent.setup();
    renderOpen();
    await user.click(screen.getByRole("button", { name: "Link Google" }));
    expect(await screen.findByRole("button", { name: "Sign in instead" })).toBeInTheDocument();
  });
});
