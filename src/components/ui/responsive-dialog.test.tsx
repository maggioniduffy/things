import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n/client";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "./responsive-dialog";

/** jsdom has no matchMedia; `phone` makes the max-width query match. */
function stubViewport(phone: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: phone,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  }));
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
}

function Demo({ onOpenChange = () => {} }: { onOpenChange?: (open: boolean) => void }) {
  return (
    <I18nProvider locale="en">
      <ResponsiveDialog open onOpenChange={onOpenChange}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Rename</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>Pick a name</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <input aria-label="Name" />
          <ResponsiveDialogFooter>
            <button type="button">Cancel</button>
            <button type="button">Save</button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </I18nProvider>
  );
}

describe("ResponsiveDialog", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is a centered dialog from sm up", () => {
    stubViewport(false);
    render(<Demo />);
    const dialog = screen.getByRole("dialog", { name: "Rename" });
    expect(dialog).toHaveAttribute("data-slot", "dialog-content");
    expect(dialog).not.toHaveAttribute("data-vaul-drawer-direction");
    expect(screen.getByText("Pick a name")).toBeInTheDocument();
  });

  it("is a bottom sheet with a handle, an inner scroll area and a side-by-side footer on phones", () => {
    stubViewport(true);
    render(<Demo />);
    const sheet = screen.getByRole("dialog", { name: "Rename" });
    expect(sheet).toHaveAttribute("data-vaul-drawer-direction", "bottom");
    expect(sheet).toHaveClass("data-[vaul-drawer-direction=bottom]:max-h-[85svh]");
    expect(sheet.querySelector("[data-slot=drawer-handle]")).not.toBeNull();
    const body = sheet.querySelector("[data-slot=responsive-dialog-body]");
    expect(body).toHaveClass("overflow-y-auto");
    expect(body?.className).toContain("env(safe-area-inset-bottom)");
    const footer = sheet.querySelector("[data-slot=responsive-dialog-footer]");
    expect(footer).toHaveClass("flex-row");
    expect(screen.getByRole("textbox", { name: "Name" })).toBeInTheDocument();
  });

  it("renders the plain dialog where matchMedia is missing", () => {
    vi.stubGlobal("matchMedia", undefined);
    render(<Demo />);
    expect(screen.getByRole("dialog", { name: "Rename" })).toHaveAttribute(
      "data-slot",
      "dialog-content",
    );
  });

  it("closes through onOpenChange on Escape in the dialog", async () => {
    stubViewport(false);
    const onOpenChange = vi.fn();
    render(<Demo onOpenChange={onOpenChange} />);
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
