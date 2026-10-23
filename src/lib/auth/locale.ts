import type { Locale } from "@/i18n/config";

type LocaleSyncClient = {
  auth: { updateUser: (attributes: { data: { locale: Locale } }) => PromiseLike<unknown> };
};

/**
 * `signInWithOtp` metadata only lands on new users, so returning users would keep an old (or
 * missing) locale for auth emails. After a sign-in, store the current locale when it differs.
 * Fire-and-forget: errors are ignored and navigation is never awaited on it.
 */
export function syncUserLocale(
  client: LocaleSyncClient,
  user: { user_metadata?: Record<string, unknown> } | null | undefined,
  locale: Locale,
): void {
  if (!user || user.user_metadata?.locale === locale) return;
  try {
    void Promise.resolve(client.auth.updateUser({ data: { locale } })).catch(() => {});
  } catch {
    // ignored on purpose
  }
}
