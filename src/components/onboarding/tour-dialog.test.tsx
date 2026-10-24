import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/client";
import { TourDialog } from "./tour-dialog";

function setup({ isGuest = false, locale = "en" as "en" | "es" } = {}) {
  const onClose = vi.fn();
  const onAddEmail = vi.fn();
  render(
    <I18nProvider locale={locale}>
      <TourDialog open onClose={onClose} isGuest={isGuest} onAddEmail={onAddEmail} />
    </I18nProvider>,
  );
  return { onClose, onAddEmail, user: userEvent.setup() };
}

const next = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: "Next" }));

afterEach(() => {
  document.querySelectorAll("[data-tour]").forEach((el) => el.remove());
});

describe("TourDialog", () => {
  it("starts at the welcome step with the app name, and Back is absent", () => {
    setup();
    expect(screen.getByRole("dialog", { name: "Welcome to Thingteca" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
  });

  it("moves with Next and Back, and marks the active dot", async () => {
    const { user } = setup();
    const dots = () => within(screen.getByRole("list")).getAllByRole("listitem");
    expect(dots()).toHaveLength(6);
    expect(dots()[0]).toHaveAttribute("aria-current", "step");

    await next(user);
    expect(screen.getByRole("dialog", { name: "Save anything fast" })).toBeInTheDocument();
    expect(dots()[1]).toHaveAttribute("aria-current", "step");
    expect(dots()[0]).not.toHaveAttribute("aria-current");

    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("dialog", { name: "Welcome to Thingteca" })).toBeInTheDocument();
  });

  it("offers Skip on every step but the last, and Finish on the last", async () => {
    const { user, onClose } = setup();
    for (let step = 0; step < 5; step++) {
      expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument();
      await next(user);
    }
    expect(screen.getByRole("dialog", { name: "Your settings" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Skip" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Finish" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Skip closes from the first step", async () => {
    const { user, onClose } = setup();
    await user.click(screen.getByRole("button", { name: "Skip" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("treats Esc as Skip", async () => {
    const { user, onClose } = setup();
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("adds the guest-only step, whose button closes the tour and opens upgrade", async () => {
    const { user, onClose, onAddEmail } = setup({ isGuest: true });
    expect(within(screen.getByRole("list")).getAllByRole("listitem")).toHaveLength(7);
    for (let step = 0; step < 6; step++) await next(user);
    expect(screen.getByRole("dialog", { name: "Keep your things" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add email" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onAddEmail).toHaveBeenCalledTimes(1);
  });

  it("shows no Add email for a signed-in user", async () => {
    const { user } = setup();
    for (let step = 0; step < 5; step++) await next(user);
    expect(screen.queryByRole("button", { name: "Add email" })).not.toBeInTheDocument();
  });

  it("spotlights the first visible target of a step and centers the card without one", async () => {
    const hidden = document.createElement("button");
    hidden.dataset.tour = "add";
    const shown = document.createElement("button");
    shown.dataset.tour = "add";
    document.body.append(hidden, shown);
    shown.getBoundingClientRect = () => new DOMRect(100, 200, 80, 32);
    const { user } = setup();
    expect(document.querySelector("[data-slot=tour-spotlight]")).toBeNull();
    expect(document.querySelector("[data-slot=tour-scrim]")).not.toBeNull();

    await next(user);
    const spotlight = document.querySelector<HTMLElement>("[data-slot=tour-spotlight]");
    expect(spotlight).not.toBeNull();
    expect(spotlight?.style.top).toBe("194px");
    expect(spotlight?.style.left).toBe("94px");
    expect(spotlight?.style.width).toBe("92px");

    // The organize step has no visible target here, so the plain scrim is back.
    await next(user);
    expect(document.querySelector("[data-slot=tour-spotlight]")).toBeNull();
  });

  it("is translated and uses Cosateca in Spanish", () => {
    setup({ locale: "es" });
    expect(screen.getByRole("dialog", { name: "Te damos la bienvenida a Cosateca" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Omitir" })).toBeInTheDocument();
  });
});
