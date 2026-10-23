import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { detectPlatform, InstallPrompt } from "./install-prompt";

const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/126 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1";
const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15";
const LINUX = "Mozilla/5.0 (X11; Linux x86_64) Chrome/126 Safari/537.36";

function setup(ua: string, standalone = false) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(ua);
  vi.stubGlobal(
    "matchMedia",
    vi
      .fn()
      .mockReturnValue({
        matches: standalone,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("detectPlatform", () => {
  it.each([
    [ANDROID, 0, "android"],
    [IPHONE, 5, "ios"],
    [MAC, 5, "ios"], // iPadOS
    [MAC, 0, "desktop"],
    [LINUX, 0, "desktop"],
  ] as const)("%s (%s touch points) -> %s", (ua, touch, expected) => {
    expect(detectPlatform(ua, touch)).toBe(expected);
  });
});

describe("InstallPrompt", () => {
  it("opens the Android tab first on Android", () => {
    setup(ANDROID);
    render(<InstallPrompt />);
    expect(screen.getByRole("tab", { name: "Android" })).toHaveAttribute("aria-selected", "true");
  });

  it("opens the iPhone tab on iOS and the desktop tab elsewhere", () => {
    setup(IPHONE);
    const { unmount } = render(<InstallPrompt />);
    expect(screen.getByRole("tab", { name: "iPhone and iPad" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    unmount();
    setup(LINUX);
    render(<InstallPrompt />);
    expect(screen.getByRole("tab", { name: "Desktop" })).toHaveAttribute("aria-selected", "true");
  });

  it("lets the visitor switch tabs", () => {
    setup(LINUX);
    render(<InstallPrompt />);
    fireEvent.click(screen.getByRole("tab", { name: "Android" }));
    expect(screen.getByRole("tab", { name: "Android" })).toHaveAttribute("aria-selected", "true");
  });

  it("hides the tabs and button when already standalone", () => {
    setup(ANDROID, true);
    render(<InstallPrompt />);
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("button", { name: "Install" })).toBeNull();
  });

  it("shows an Install button on beforeinstallprompt and calls prompt()", async () => {
    setup(ANDROID);
    render(<InstallPrompt />);
    expect(screen.queryByRole("button", { name: "Install" })).toBeNull();
    const prompt = vi.fn().mockResolvedValue(undefined);
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), { prompt });
    act(() => {
      window.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Install" }));
    });
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Install" })).toBeNull();
  });
});
