/** Length of the email sign-in code. Must match `[auth.email] otp_length` in supabase/config.toml. */
export const OTP_LENGTH = 6;

/**
 * `verifyOtp` accepts any string for `type`, so typos are not caught by the compiler.
 * Use these constants instead of string literals.
 */
export const EMAIL_OTP_TYPE = "email" as const;
export const EMAIL_CHANGE_OTP_TYPE = "email_change" as const;

/** Keeps digits only and caps the length, so pasted codes like "123 456" work. */
export function sanitizeOtp(value: string): string {
  return value.replace(/\D/g, "").slice(0, OTP_LENGTH);
}

/** True for exactly six digits. */
export function isValidOtp(value: string): boolean {
  return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(value);
}
