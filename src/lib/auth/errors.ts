export const AUTH_MESSAGES = {
  invalidCode: "That code didn't work. Check it or send a new one.",
  rateLimit: "Too many attempts. Wait a minute, then try again.",
  captcha: "We couldn't verify that you're a person. Refresh the page and try again.",
  network: "Can't reach Things. Check your connection and try again.",
  invalidEmail: "That email address doesn't look right. Check it and try again.",
  accountExists:
    "That email already has a Things account. Sign in to it instead — items saved as a guest won't move over yet.",
  unknown: "Something went wrong. Try again.",
} as const;

type ErrorLike = {
  code?: unknown;
  status?: unknown;
  name?: unknown;
  message?: unknown;
};

function asErrorLike(error: unknown): ErrorLike {
  return typeof error === "object" && error !== null ? (error as ErrorLike) : {};
}

/**
 * True when a guest upgrade failed because the email or Google account already belongs to
 * another user. GoTrue answers `updateUser({ email })` with 422 `email_exists` (verified locally)
 * and `linkIdentity` with `identity_already_exists`; older servers only send the message.
 */
export function isAccountConflict(error: unknown): boolean {
  const { code, status, message } = asErrorLike(error);
  if (
    code === "email_exists" ||
    code === "identity_already_exists" ||
    code === "user_already_exists"
  ) {
    return true;
  }
  const text = typeof message === "string" ? message.toLowerCase() : "";
  return (
    status === 422 &&
    (text.includes("already been registered") ||
      text.includes("already registered") ||
      text.includes("already linked"))
  );
}

/**
 * Maps a Supabase auth error (or anything thrown) to short, human copy.
 * GoTrue reports a wrong code and an expired code the same way (`otp_expired`),
 * so both get the same message.
 */
export function mapAuthError(error: unknown): string {
  const { code, status, name, message } = asErrorLike(error);
  const text = typeof message === "string" ? message.toLowerCase() : "";

  if (isAccountConflict(error)) return AUTH_MESSAGES.accountExists;
  if (code === "otp_expired" || text.includes("token has expired or is invalid")) {
    return AUTH_MESSAGES.invalidCode;
  }
  if (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit" ||
    status === 429
  ) {
    return AUTH_MESSAGES.rateLimit;
  }
  if (code === "captcha_failed" || text.includes("captcha")) {
    return AUTH_MESSAGES.captcha;
  }
  if (
    code === "email_address_invalid" ||
    (code === "validation_failed" && text.includes("email"))
  ) {
    return AUTH_MESSAGES.invalidEmail;
  }
  if (
    name === "AuthRetryableFetchError" ||
    status === 0 ||
    text.includes("failed to fetch") ||
    text.includes("networkerror") ||
    text.includes("network request failed")
  ) {
    return AUTH_MESSAGES.network;
  }
  return AUTH_MESSAGES.unknown;
}
