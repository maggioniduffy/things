import type { AdminClient } from "@/lib/supabase/admin";
import { sweepOrphans } from "./orphans";
import { purgeTrash, purgeUnfurlLog } from "./purge";

export type DailyCronResult = {
  purgedItems: number;
  removedObjects: number;
  orphanObjects: number;
  unfurlLogRows: number;
};

/** Thrown when any step failed; the counts of the steps that did run are in `partial`. */
export class DailyCronError extends Error {
  constructor(
    readonly failedSteps: string[],
    readonly partial: Partial<DailyCronResult>,
  ) {
    super("daily cron step(s) failed");
  }
}

/** Runs every step even if an earlier one fails, so one broken step does not block the others. */
export async function runDailyCron(
  admin: AdminClient,
  now: Date = new Date(),
): Promise<DailyCronResult> {
  const partial: Partial<DailyCronResult> = {};
  const failed: string[] = [];

  const step = async (name: string, run: () => Promise<void>) => {
    try {
      await run();
    } catch (error) {
      failed.push(name);
      // Step name and our own error code only: Supabase error objects can carry request details.
      console.error(`cron: ${name} failed`, error instanceof Error ? error.message : "unknown");
    }
  };

  await step("purgeTrash", async () => {
    Object.assign(partial, await purgeTrash(admin, now));
  });
  await step("sweepOrphans", async () => {
    partial.orphanObjects = await sweepOrphans(admin, now);
  });
  await step("purgeUnfurlLog", async () => {
    partial.unfurlLogRows = await purgeUnfurlLog(admin, now);
  });

  if (failed.length > 0) throw new DailyCronError(failed, partial);
  return partial as DailyCronResult;
}
