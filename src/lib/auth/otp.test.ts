import { describe, expect, it } from "vitest";
import { EMAIL_OTP_TYPE, isValidOtp, OTP_LENGTH, sanitizeOtp } from "./otp";

describe("isValidOtp", () => {
  it("accepts exactly six digits", () => {
    expect(isValidOtp("123456")).toBe(true);
    expect(isValidOtp("000000")).toBe(true);
  });

  it("rejects wrong lengths, letters and whitespace", () => {
    for (const value of ["", "12345", "1234567", "12345a", "12 456", " 123456", "123456\n"]) {
      expect(isValidOtp(value)).toBe(false);
    }
  });
});

describe("sanitizeOtp", () => {
  it("strips non-digits and caps the length", () => {
    expect(sanitizeOtp("123 456")).toBe("123456");
    expect(sanitizeOtp("12-34-56-78")).toBe("123456");
    expect(sanitizeOtp("abc")).toBe("");
  });
});

describe("constants", () => {
  it("uses the six-digit email code", () => {
    expect(OTP_LENGTH).toBe(6);
    expect(EMAIL_OTP_TYPE).toBe("email");
  });
});
