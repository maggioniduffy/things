/** Saves after which the guest banner switches to its stronger reminder. */
export const GUEST_REMINDER_THRESHOLD = 10;

/** sessionStorage key: dismissal lasts for this tab only, so the banner returns next visit. */
export const GUEST_BANNER_DISMISSED_KEY = "things:guest-banner-dismissed";

export type GuestBannerVariant = "hidden" | "default" | "reminder";

/**
 * Which banner a guest sees. A dismissed banner stays hidden for the tab session, even past
 * the threshold. An unknown count (still loading, or the query failed) shows the default copy.
 */
export function guestBannerVariant(count: number | null, dismissed: boolean): GuestBannerVariant {
  if (dismissed) return "hidden";
  if (count !== null && count >= GUEST_REMINDER_THRESHOLD) return "reminder";
  return "default";
}

const listeners = new Set<() => void>();

/** Reads the dismissal flag. Storage can throw (private windows, blocked site data): treat as not dismissed. */
export function readGuestBannerDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(GUEST_BANNER_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

let dismissedInMemory = false;

/** Whether the banner was dismissed in this tab, falling back to memory when storage is blocked. */
export function getGuestBannerDismissed(): boolean {
  return dismissedInMemory || readGuestBannerDismissed();
}

/** Remembers the dismissal for this tab session and tells subscribers. */
export function dismissGuestBanner(): void {
  dismissedInMemory = true;
  try {
    window.sessionStorage.setItem(GUEST_BANNER_DISMISSED_KEY, "1");
  } catch {
    // Storage is unavailable; the in-memory flag still hides the banner until a reload.
  }
  listeners.forEach((listener) => listener());
}

/** `useSyncExternalStore` subscription for the dismissal flag. */
export function subscribeGuestBannerDismissed(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test-only reset of the module state. */
export function resetGuestBannerDismissedForTests(): void {
  dismissedInMemory = false;
  try {
    window.sessionStorage.removeItem(GUEST_BANNER_DISMISSED_KEY);
  } catch {
    // ignore
  }
}
