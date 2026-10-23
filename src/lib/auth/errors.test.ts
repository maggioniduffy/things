import { describe, expect, it } from "vitest";
import { AUTH_MESSAGES, isAccountConflict, mapAuthError } from "./errors";

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

  it("maps an email or identity that already belongs to another account", () => {
    expect(mapAuthError({ code: "email_exists", status: 422 })).toBe(AUTH_MESSAGES.accountExists);
    expect(mapAuthError({ code: "identity_already_exists", status: 422 })).toBe(
      AUTH_MESSAGES.accountExists,
    );
    expect(mapAuthError({ code: "user_already_exists" })).toBe(AUTH_MESSAGES.accountExists);
    expect(
      mapAuthError({
        status: 422,
        message: "A user with this email address has already been registered",
      }),
    ).toBe(AUTH_MESSAGES.accountExists);
  });

  it("maps network failures", () => {
    expect(mapAuthError({ name: "AuthRetryableFetchError", status: 0 })).toBe(
      AUTH_MESSAGES.network,
    );
    expect(mapAuthError(new TypeError("Failed to fetch"))).toBe(AUTH_MESSAGES.network);
  });

  it("maps auth server failures apart from network failures", () => {
    expect(mapAuthError({ name: "AuthRetryableFetchError", status: 504 })).toBe(
      AUTH_MESSAGES.server,
    );
    expect(
      mapAuthError({
        name: "AuthApiError",
        status: 500,
        message: "Error sending magic link email",
      }),
    ).toBe(AUTH_MESSAGES.server);
  });

  it("falls back for unknown shapes", () => {
    expect(mapAuthError({ code: "something_new" })).toBe(AUTH_MESSAGES.unknown);
    expect(mapAuthError(null)).toBe(AUTH_MESSAGES.unknown);
    expect(mapAuthError("nope")).toBe(AUTH_MESSAGES.unknown);
    expect(mapAuthError(undefined)).toBe(AUTH_MESSAGES.unknown);
  });
});

describe("isAccountConflict", () => {
  it("recognizes the conflict codes", () => {
    expect(isAccountConflict({ code: "email_exists" })).toBe(true);
    expect(isAccountConflict({ code: "identity_already_exists" })).toBe(true);
    expect(isAccountConflict({ status: 422, message: "Identity is already linked" })).toBe(true);
  });

  it("does not treat other 422s or unknown shapes as a conflict", () => {
    expect(isAccountConflict({ status: 422, message: "Password is too weak" })).toBe(false);
    expect(isAccountConflict({ code: "otp_expired" })).toBe(false);
    expect(isAccountConflict(null)).toBe(false);
    expect(isAccountConflict("email_exists")).toBe(false);
  });
});
