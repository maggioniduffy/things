import { describe, expect, it } from "vitest";
import { clearBrowserQueryClient, getQueryClient } from "./query-client";

describe("getQueryClient (browser)", () => {
  it("keeps one client per user and starts empty for a different user", () => {
    clearBrowserQueryClient();
    const first = getQueryClient("user-a");
    first.setQueryData(["items"], ["secret"]);
    expect(getQueryClient("user-a")).toBe(first);
    expect(getQueryClient()).toBe(first);

    const second = getQueryClient("user-b");
    expect(second).not.toBe(first);
    expect(second.getQueryData(["items"])).toBeUndefined();
    expect(first.getQueryData(["items"])).toBeUndefined();
  });

  it("clearBrowserQueryClient drops the cache", () => {
    const client = getQueryClient("user-a");
    client.setQueryData(["counts"], { all: 1 });
    clearBrowserQueryClient();
    expect(getQueryClient("user-a").getQueryData(["counts"])).toBeUndefined();
  });
});
