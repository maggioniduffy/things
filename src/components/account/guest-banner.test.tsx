import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GUEST_BANNER_DISMISSED_KEY, resetGuestBannerDismissedForTests } from "@/lib/auth/guest";
import { render } from "@/test/render";
import { GuestBanner } from "./guest-banner";

const itemsQuery = vi.hoisted(() => ({ result: { count: 0 as number | null, error: null } }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({ is: () => Promise.resolve(itemsQuery.result) }),
    }),
    auth: {},
  }),
}));

beforeEach(() => {
  itemsQuery.result = { count: 0, error: null };
});

afterEach(() => {
  resetGuestBannerDismissedForTests();
});

describe("GuestBanner", () => {
  it("is a labelled region with the calm default copy and a primary action", async () => {
    render(<GuestBanner />);
    const region = await screen.findByRole("region", { name: "Guest account" });
    expect(region).toHaveTextContent(
      "You're using Things as a guest. Add an email to keep your things.",
    );
    expect(screen.getByRole("button", { name: "Keep my things" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismiss for now" })).toBeInTheDocument();
    // The count query settles without changing the copy below the threshold.
    await waitFor(() => expect(region).toHaveTextContent("Add an email to keep your things."));
  });

  it("switches to the stronger copy once the guest has saved 10 things", async () => {
    itemsQuery.result = { count: 10, error: null };
    render(<GuestBanner />);
    expect(
      await screen.findByText(
        "You've saved 10 things as a guest. Add an email so you don't lose them.",
      ),
    ).toBeInTheDocument();
  });

  it("keeps the default copy when the count query fails", async () => {
    itemsQuery.result = { count: null, error: { message: "boom" } as never };
    render(<GuestBanner />);
    expect(await screen.findByText(/You're using Things as a guest/)).toBeInTheDocument();
  });

  it("hides on dismiss and remembers it for the tab session", async () => {
    const user = userEvent.setup();
    render(<GuestBanner />);
    await user.click(await screen.findByRole("button", { name: "Dismiss for now" }));
    expect(screen.queryByRole("region", { name: "Guest account" })).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem(GUEST_BANNER_DISMISSED_KEY)).toBe("1");
  });

  it("stays hidden when this tab already dismissed it", () => {
    window.sessionStorage.setItem(GUEST_BANNER_DISMISSED_KEY, "1");
    render(<GuestBanner />);
    expect(screen.queryByRole("region", { name: "Guest account" })).not.toBeInTheDocument();
  });

  it("opens the upgrade dialog from Keep my things", async () => {
    const user = userEvent.setup();
    render(<GuestBanner />);
    await user.click(await screen.findByRole("button", { name: "Keep my things" }));
    expect(await screen.findByRole("dialog", { name: "Keep your things" })).toBeInTheDocument();
  });
});
