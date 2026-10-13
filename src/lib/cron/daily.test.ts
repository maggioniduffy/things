// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminClient } from "@/lib/supabase/admin";
import { DailyCronError, runDailyCron } from "./daily";

const purgeTrash = vi.hoisted(() => vi.fn());
const purgeUnfurlLog = vi.hoisted(() => vi.fn());
const sweepOrphans = vi.hoisted(() => vi.fn());
vi.mock("./purge", () => ({ purgeTrash, purgeUnfurlLog }));
vi.mock("./orphans", () => ({ sweepOrphans }));

const admin = {} as AdminClient;

beforeEach(() => {
  purgeTrash.mockReset().mockResolvedValue({ purgedItems: 1, removedObjects: 2 });
  sweepOrphans.mockReset().mockResolvedValue(3);
  purgeUnfurlLog.mockReset().mockResolvedValue(4);
});

describe("runDailyCron", () => {
  it("combines the counts of all steps", async () => {
    expect(await runDailyCron(admin)).toEqual({
      purgedItems: 1,
      removedObjects: 2,
      orphanObjects: 3,
      unfurlLogRows: 4,
    });
  });

  it("runs the remaining steps when one fails, then throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    sweepOrphans.mockRejectedValue(new Error("orphan_list_failed"));

    const error = await runDailyCron(admin).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(DailyCronError);
    expect((error as DailyCronError).failedSteps).toEqual(["sweepOrphans"]);
    expect(purgeUnfurlLog).toHaveBeenCalled();
  });
});
