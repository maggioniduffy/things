/** `user_metadata` key set once the account has finished or skipped the first-visit tour. */
export const TOUR_DONE_KEY = "tour_done_at";

type TourClient = {
  auth: {
    updateUser: (attributes: { data: Record<string, string> }) => PromiseLike<unknown>;
    refreshSession: () => PromiseLike<unknown>;
  };
};

/** True until the account has marked the tour done (the key is missing or not a string). */
export function needsTour(userMetadata: unknown): boolean {
  if (typeof userMetadata !== "object" || userMetadata === null) return true;
  return typeof (userMetadata as Record<string, unknown>)[TOUR_DONE_KEY] !== "string";
}

/**
 * Stores `tour_done_at` on the account, then refreshes the session. The /app layout reads JWT
 * claims, whose `user_metadata` stays stale until the token is reissued, so without the refresh
 * the tour would come back on the next reload. Errors are swallowed: the dialog is already closed.
 */
export async function markTourDone(client: TourClient): Promise<void> {
  try {
    await client.auth.updateUser({ data: { [TOUR_DONE_KEY]: new Date().toISOString() } });
    await client.auth.refreshSession();
  } catch {
    // ignored on purpose
  }
}
