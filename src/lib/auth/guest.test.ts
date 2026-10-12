import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dismissGuestBanner,
  getGuestBannerDismissed,
  GUEST_BANNER_DISMISSED_KEY,
  GUEST_REMINDER_THRESHOLD,
  guestBannerVariant,
  resetGuestBannerDismissedForTests,
  subscribeGuestBannerDismissed,
} from "./guest";

afterEach(() => {
  vi.restoreAllMocks();
  resetGuestBannerDismissedForTests();
});

describe("guestBannerVariant", () => {
  it("shows the default copy below the threshold", () => {
    expect(guestBannerVariant(0, false)).toBe("default");
    expect(guestBannerVariant(GUEST_REMINDER_THRESHOLD - 1, false)).toBe("default");
  });

  it("shows the reminder at and above the threshold", () => {
    expect(guestBannerVariant(GUEST_REMINDER_THRESHOLD, false)).toBe("reminder");
    expect(guestBannerVariant(42, false)).toBe("reminder");
  });

  it("falls back to the default copy while the count is unknown", () => {
    expect(guestBannerVariant(null, false)).toBe("default");
  });

  it("hides the banner once dismissed, whatever the count", () => {
    expect(guestBannerVariant(0, true)).toBe("hidden");
    expect(guestBannerVariant(25, true)).toBe("hidden");
    expect(guestBannerVariant(null, true)).toBe("hidden");
  });
});

describe("dismissal storage", () => {
  it("starts not dismissed", () => {
    expect(getGuestBannerDismissed()).toBe(false);
  });

  it("remembers a dismissal in sessionStorage and notifies subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeGuestBannerDismissed(listener);
    dismissGuestBanner();
    expect(window.sessionStorage.getItem(GUEST_BANNER_DISMISSED_KEY)).toBe("1");
    expect(getGuestBannerDismissed()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    dismissGuestBanner();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("still hides the banner when storage throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(getGuestBannerDismissed()).toBe(false);
    expect(() => dismissGuestBanner()).not.toThrow();
    expect(getGuestBannerDismissed()).toBe(true);
  });
});
