import { common } from "./common";

const brand = common.brand.name;

/** English copy: auth. Source of truth for the shape; es/auth.ts must match it. */
export const auth = {
  errors: {
    invalidCode: "That code didn't work. Check it or send a new one.",
    rateLimit: "Too many attempts. Wait a minute, then try again.",
    captcha: "We couldn't verify that you're a person. Refresh the page and try again.",
    network: `Can't reach ${brand}. Check your connection and try again.`,
    invalidEmail: "That email address doesn't look right. Check it and try again.",
    accountExists: `That email already has a ${brand} account. Sign in to it instead — items saved as a guest won't move over yet.`,
    server: `${brand} couldn't do that right now. Try again in a few minutes.`,
    unknown: "Something went wrong. Try again.",
    callbackFailed: "We couldn't finish signing you in. Try again.",
  },
  login: {
    title: `Sign in to ${brand}`,
    subtitle: "We'll email you a 6-digit code. New here? That creates your account.",
    emailLabel: "Email",
    emailPlaceholder: "you@example.com",
    sendCode: "Send code",
    sending: "Sending…",
    checkEmailTitle: "Check your email",
    checkEmailBody:
      "Codes expire after 10 minutes. Nothing arrived? Check spam, or send a new one.",
    codeLabel: "Enter the 6-digit code we sent to",
    verify: "Verify",
    useDifferentEmail: "Use a different email",
    resendIn: (seconds: number) => `Resend in ${seconds}s`,
    resend: "Resend code",
    or: "or",
    continueWithGoogle: "Continue with Google",
    connecting: "Connecting…",
    homeLabel: `${brand}, home`,
  },
  guest: {
    start: "Try without an account",
    regionLabel: "Guest account",
    defaultCopy: `You're using ${brand} as a guest. Add an email to keep your things.`,
    reminderCopy: (count: number) =>
      `You've saved ${count} things as a guest. Add an email so you don't lose them.`,
    keep: "Keep my things",
    dismiss: "Dismiss for now",
  },
  upgrade: {
    title: "Keep your things",
    description:
      "Add an email and we'll send a 6-digit code. Everything you've saved stays right where it is.",
    saved: (email: string) => `Your things are saved to ${email}.`,
    signInInstead: "Sign in instead",
    linkGoogle: "Link Google",
  },
};
