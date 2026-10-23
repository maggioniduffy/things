import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GUEST_BANNER_DISMISSED_KEY, resetGuestBannerDismissedForTests } from "@/lib/auth/guest";
import { makeCounts, makeTestQueryClient, renderWithQuery } from "@/test/fixtures";
import { GuestBanner } from "./guest-banner";

// What the counts query (item_counts) returns when the banner has to fetch it itself.
const countsQuery = vi.hoisted(() => ({
  result: { data: [] as unknown, error: null as unknown },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    from: () => ({ select: () => Promise.resolve(countsQuery.result) }),
    auth: {},
  }),
}));

beforeEach(() => {
  countsQuery.result = { data: [], error: null };
});

afterEach(() => {
  resetGuestBannerDismissedForTests();
});

describe("GuestBanner", () => {
  it("is a labelled region with the calm default copy and a primary action", async () => {
    renderWithQuery(<GuestBanner />);
    const region = await screen.findByRole("region", { name: "Guest account" });
    expect(region).toHaveTextContent(
      "You're using Thingteca as a guest. Add an email to keep your things.",
    );
    expect(screen.getByRole("button", { name: "Keep my things" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dismiss for now" })).toBeInTheDocument();
    // The count query settles without changing the copy below the threshold.
    await waitFor(() => expect(region).toHaveTextContent("Add an email to keep your things."));
  });

  it("switches to the stronger copy once the guest has saved 10 things", async () => {
    const client = makeTestQueryClient();
    client.setQueryData(["counts"], makeCounts({ all: 8, archive: 2, trash: 5 }));
    renderWithQuery(<GuestBanner />, client);
    expect(
      await screen.findByText(
        "You've saved 10 things as a guest. Add an email so you don't lose them.",
      ),
    ).toBeInTheDocument();
  });

  it("updates the reminder as soon as the counts cache changes", async () => {
    const client = makeTestQueryClient();
    client.setQueryData(["counts"], makeCounts({ all: 9 }));
    renderWithQuery(<GuestBanner />, client);
    expect(await screen.findByText(/You're using Thingteca as a guest/)).toBeInTheDocument();

    act(() => client.setQueryData(["counts"], makeCounts({ all: 10 })));
    expect(
      await screen.findByText(
        "You've saved 10 things as a guest. Add an email so you don't lose them.",
      ),
    ).toBeInTheDocument();
  });

  it("keeps the default copy when the count query fails", async () => {
    countsQuery.result = { data: null, error: { message: "boom" } };
    renderWithQuery(<GuestBanner />);
    expect(await screen.findByText(/You're using Thingteca as a guest/)).toBeInTheDocument();
  });

  it("hides on dismiss and remembers it for the tab session", async () => {
    const user = userEvent.setup();
    renderWithQuery(<GuestBanner />);
    await user.click(await screen.findByRole("button", { name: "Dismiss for now" }));
    expect(screen.queryByRole("region", { name: "Guest account" })).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem(GUEST_BANNER_DISMISSED_KEY)).toBe("1");
  });

  it("stays hidden when this tab already dismissed it", () => {
    window.sessionStorage.setItem(GUEST_BANNER_DISMISSED_KEY, "1");
    renderWithQuery(<GuestBanner />);
    expect(screen.queryByRole("region", { name: "Guest account" })).not.toBeInTheDocument();
  });

  it("opens the upgrade dialog from Keep my things", async () => {
    const user = userEvent.setup();
    renderWithQuery(<GuestBanner />);
    await user.click(await screen.findByRole("button", { name: "Keep my things" }));
    expect(await screen.findByRole("dialog", { name: "Keep your things" })).toBeInTheDocument();
  });
});
