import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ViewerProvider } from "@/components/providers/viewer-provider";
import { I18nProvider } from "@/i18n/client";
import { useUiStore } from "@/stores/ui-store";
import { TourHost } from "./tour-host";

const mocks = vi.hoisted(() => ({ markTourDone: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ marker: "client" }) }));
vi.mock("@/lib/onboarding", () => ({ markTourDone: mocks.markTourDone }));

function setup({ needed, isGuest = false }: { needed: boolean; isGuest?: boolean }) {
  render(
    <I18nProvider locale="en">
      <ViewerProvider userId="u1" isGuest={isGuest}>
        <TourHost needed={needed} />
      </ViewerProvider>
    </I18nProvider>,
  );
  return userEvent.setup();
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.markTourDone.mockResolvedValue(undefined);
  useUiStore.setState({ tourOpen: false, upgradeOpen: false });
});

describe("TourHost", () => {
  it("opens on mount when the tour is needed", async () => {
    setup({ needed: true });
    expect(await screen.findByRole("dialog", { name: "Welcome to Thingteca" })).toBeVisible();
  });

  it("stays closed when the tour is done", () => {
    setup({ needed: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(useUiStore.getState().tourOpen).toBe(false);
  });

  it("Skip closes at once and writes once", async () => {
    const user = setup({ needed: true });
    await user.click(await screen.findByRole("button", { name: "Skip" }));
    expect(useUiStore.getState().tourOpen).toBe(false);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.markTourDone).toHaveBeenCalledTimes(1);
    expect(mocks.markTourDone).toHaveBeenCalledWith({ marker: "client" });

    // A replay in the same visit closes without writing again.
    act(() => useUiStore.getState().setTourOpen(true));
    await user.keyboard("{Escape}");
    expect(mocks.markTourDone).toHaveBeenCalledTimes(1);
  });

  it("Finish writes once", async () => {
    const user = setup({ needed: true });
    for (let step = 0; step < 4; step++) {
      await user.click(await screen.findByRole("button", { name: "Next" }));
    }
    await user.click(screen.getByRole("button", { name: "Finish" }));
    expect(mocks.markTourDone).toHaveBeenCalledTimes(1);
  });

  it("a replay opens without writing anything", async () => {
    const user = setup({ needed: false });
    act(() => useUiStore.getState().setTourOpen(true));
    expect(await screen.findByRole("dialog", { name: "Welcome to Thingteca" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Skip" }));
    expect(mocks.markTourDone).not.toHaveBeenCalled();
  });

  it("Add email marks the tour done and opens the upgrade dialog", async () => {
    const user = setup({ needed: true, isGuest: true });
    for (let step = 0; step < 5; step++) {
      await user.click(await screen.findByRole("button", { name: "Next" }));
    }
    await user.click(screen.getByRole("button", { name: "Add email" }));
    expect(mocks.markTourDone).toHaveBeenCalledTimes(1);
    expect(useUiStore.getState()).toMatchObject({ tourOpen: false, upgradeOpen: true });
  });
});
