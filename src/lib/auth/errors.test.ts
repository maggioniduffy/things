import { describe, expect, it } from "vitest";
import { AUTH_MESSAGES, mapAuthError } from "./errors";

describe("mapAuthError", () => {
  it("maps an expired or wrong code", () => {
    expect(mapAuthError({ code: "otp_expired", status: 403 })).toBe(AUTH_MESSAGES.invalidCode);
    expect(mapAuthError({ message: "Token has expired or is invalid" })).toBe(
      AUTH_MESSAGES.invalidCode,
    );
  });

  it("maps rate limits", () => {
    expect(mapAuthError({ code: "over_email_send_rate_limit", status: 429 })).toBe(
      AUTH_MESSAGES.rateLimit,
    );
    expect(mapAuthError({ code: "over_request_rate_limit" })).toBe(AUTH_MESSAGES.rateLimit);
    expect(mapAuthError({ status: 429 })).toBe(AUTH_MESSAGES.rateLimit);
  });

  it("maps a failed captcha", () => {
    expect(mapAuthError({ code: "captcha_failed" })).toBe(AUTH_MESSAGES.captcha);
    expect(mapAuthError({ message: "captcha verification process failed" })).toBe(
      AUTH_MESSAGES.captcha,
    );
  });

  it("maps an invalid email", () => {
    expect(mapAuthError({ code: "email_address_invalid" })).toBe(AUTH_MESSAGES.invalidEmail);
  });

  it("maps network failures", () => {
    expect(mapAuthError({ name: "AuthRetryableFetchError", status: 0 })).toBe(
      AUTH_MESSAGES.network,
    );
    expect(mapAuthError(new TypeError("Failed to fetch"))).toBe(AUTH_MESSAGES.network);
  });

  it("falls back for unknown shapes", () => {
    expect(mapAuthError({ code: "something_new" })).toBe(AUTH_MESSAGES.unknown);
    expect(mapAuthError(null)).toBe(AUTH_MESSAGES.unknown);
    expect(mapAuthError("nope")).toBe(AUTH_MESSAGES.unknown);
    expect(mapAuthError(undefined)).toBe(AUTH_MESSAGES.unknown);
  });
});
