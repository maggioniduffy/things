// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isAuthorizedCronRequest } from "./auth";

describe("isAuthorizedCronRequest", () => {
  it("accepts exactly Bearer <secret>", () => {
    expect(isAuthorizedCronRequest("Bearer s3cret", "s3cret")).toBe(true);
  });

  it.each([
    [null],
    [""],
    ["s3cret"],
    ["Bearer wrong"],
    ["Bearer s3cret "],
    ["bearer s3cret"],
    ["Bearer s3cre"],
    ["Bearer s3cretX"],
  ])("rejects %j", (header) => {
    expect(isAuthorizedCronRequest(header, "s3cret")).toBe(false);
  });

  it("never matches an empty secret", () => {
    expect(isAuthorizedCronRequest("Bearer ", "")).toBe(false);
    expect(isAuthorizedCronRequest("", "")).toBe(false);
  });
});
