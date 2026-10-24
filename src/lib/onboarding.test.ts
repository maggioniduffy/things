import { describe, expect, it, vi } from "vitest";
import { markTourDone, needsTour, TOUR_DONE_KEY } from "./onboarding";

describe("needsTour", () => {
  it("is true when the metadata or the key is missing, or the value is not a string", () => {
    expect(needsTour(undefined)).toBe(true);
    expect(needsTour(null)).toBe(true);
    expect(needsTour({})).toBe(true);
    expect(needsTour({ locale: "en" })).toBe(true);
    expect(needsTour({ [TOUR_DONE_KEY]: true })).toBe(true);
    expect(needsTour("tour_done_at")).toBe(true);
  });

  it("is false once the key holds a timestamp", () => {
    expect(needsTour({ [TOUR_DONE_KEY]: "2026-10-24T10:00:00.000Z" })).toBe(false);
  });
});

describe("markTourDone", () => {
  it("updates the user, then refreshes the session", async () => {
    const order: string[] = [];
    const client = {
      auth: {
        updateUser: vi.fn(async () => void order.push("update")),
        refreshSession: vi.fn(async () => void order.push("refresh")),
      },
    };
    await markTourDone(client);
    expect(order).toEqual(["update", "refresh"]);
    const call = client.auth.updateUser.mock.calls[0] as unknown as [
      { data: Record<string, string> },
    ];
    expect(Number.isNaN(Date.parse(call[0].data[TOUR_DONE_KEY] ?? ""))).toBe(false);
  });

  it("swallows errors", async () => {
    const failing = {
      auth: {
        updateUser: vi.fn().mockRejectedValue(new Error("down")),
        refreshSession: vi.fn(),
      },
    };
    await expect(markTourDone(failing)).resolves.toBeUndefined();
    expect(failing.auth.refreshSession).not.toHaveBeenCalled();
    const throwing = {
      auth: {
        updateUser: vi.fn().mockResolvedValue({}),
        refreshSession: vi.fn(() => {
          throw new Error("sync");
        }),
      },
    };
    await expect(markTourDone(throwing)).resolves.toBeUndefined();
  });
});
