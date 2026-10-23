"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useT } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AUTH_MESSAGES,
  EMAIL_OTP_TYPE,
  isValidOtp,
  mapAuthError,
  syncUserLocale,
} from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { AuroraButton } from "./aurora-button";
import { OtpCodeInput } from "./otp-code-input";
import { TurnstileField, useTurnstile } from "./turnstile-field";

const RESEND_COOLDOWN_SECONDS = 30;

type OtpFormProps = {
  /** Called once the session exists. The parent decides where to go. */
  onSignedIn: () => void;
};

function Spinner() {
  return (
    <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
  );
}

/** Inline, announced error. Always rendered so the card does not jump when a message appears. */
function FieldError({ id, message }: { id: string; message: string | null }) {
  return (
    <p id={id} role="alert" className="text-meta text-ink min-h-[18px]">
      {message}
    </p>
  );
}

/** Two-step email sign-in: request a 6-digit code, then verify it. */
export function OtpForm({ onSignedIn }: OtpFormProps) {
  const { login } = useT().auth;
  const locale = useLocale();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<"send" | "verify" | "resend" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const emailId = useId();
  const codeId = useId();
  const errorId = useId();
  const codeInput = useRef<HTMLInputElement>(null);
  const captcha = useTurnstile();

  // Move focus to the code field when step 2 appears.
  useEffect(() => {
    if (step === "code") codeInput.current?.focus();
  }, [step]);

  // Count the resend cooldown down once a second.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  /** Sends a code. Returns true when it was sent. */
  async function sendCode(address: string): Promise<boolean> {
    const captchaToken = await captcha.getToken();
    if (captchaToken === null) {
      setError(AUTH_MESSAGES.captcha);
      return false;
    }
    try {
      const { error: sendError } = await createClient().auth.signInWithOtp({
        email: address,
        options: { shouldCreateUser: true, captchaToken, data: { locale } },
      });
      captcha.reset();
      if (sendError) {
        setError(mapAuthError(sendError));
        return false;
      }
      return true;
    } catch (thrown) {
      captcha.reset();
      setError(mapAuthError(thrown));
      return false;
    }
  }

  async function onSendCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const address = email.trim();
    if (!address) return;
    setError(null);
    setPending("send");
    const sent = await sendCode(address);
    setPending(null);
    if (sent) {
      setEmail(address);
      setCode("");
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setStep("code");
    }
  }

  async function verify(token: string) {
    if (pending) return;
    if (!isValidOtp(token)) {
      setError(AUTH_MESSAGES.invalidCode);
      return;
    }
    setError(null);
    setPending("verify");
    try {
      const supabase = createClient();
      const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token,
        type: EMAIL_OTP_TYPE,
      });
      if (verifyError) {
        setError(mapAuthError(verifyError));
        setCode("");
        setPending(null);
        codeInput.current?.focus();
        return;
      }
      syncUserLocale(supabase, verified?.user, locale);
      onSignedIn();
    } catch (thrown) {
      setError(mapAuthError(thrown));
      setPending(null);
    }
  }

  function onCodeChange(next: string) {
    setCode(next);
    if (error) setError(null);
  }

  function onVerifySubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void verify(code);
  }

  async function onResend() {
    if (pending || cooldown > 0) return;
    setError(null);
    setPending("resend");
    const sent = await sendCode(email);
    setPending(null);
    if (sent) {
      setCode("");
      setCooldown(RESEND_COOLDOWN_SECONDS);
      codeInput.current?.focus();
    }
  }

  function useDifferentEmail() {
    setStep("email");
    setCode("");
    setError(null);
    setCooldown(0);
  }

  return (
    <div className="flex flex-col gap-6">
      {step === "email" ? (
        <div className="flex flex-col gap-1.5">
          <h1 className="font-heading text-page tracking-heading text-ink">{login.title}</h1>
          <p className="text-body text-ink-muted">{login.subtitle}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <h1 className="font-heading text-page tracking-heading text-ink">
            {login.checkEmailTitle}
          </h1>
          <p className="text-body text-ink-muted">{login.checkEmailBody}</p>
        </div>
      )}
      {step === "email" ? (
        <form onSubmit={onSendCode} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={emailId} className="text-meta text-ink font-medium">
              {login.emailLabel}
            </label>
            <Input
              id={emailId}
              name="email"
              type="email"
              autoComplete="email"
              placeholder={login.emailPlaceholder}
              required
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (error) setError(null);
              }}
              readOnly={pending === "send"}
              aria-invalid={error ? true : undefined}
              aria-describedby={errorId}
            />
            <FieldError id={errorId} message={error} />
          </div>
          <AuroraButton type="submit" pending={pending === "send"} pendingLabel={login.sending}>
            {login.sendCode}
          </AuroraButton>
        </form>
      ) : (
        <form onSubmit={onVerifySubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={codeId} className="text-body text-ink-muted">
              {login.codeLabel} <span className="text-ink font-medium break-all">{email}</span>
            </label>
            <OtpCodeInput
              ref={codeInput}
              id={codeId}
              value={code}
              onValueChange={onCodeChange}
              onComplete={(complete) => void verify(complete)}
              readOnly={pending === "verify"}
              invalid={Boolean(error)}
              describedBy={errorId}
            />
            <FieldError id={errorId} message={error} />
          </div>
          <Button type="submit" disabled={pending === "verify"} aria-busy={pending === "verify"}>
            {pending === "verify" ? <Spinner /> : null}
            {login.verify}
          </Button>
          <div className="flex flex-wrap items-center justify-between gap-x-2">
            <Button type="button" variant="ghost" size="sm" onClick={useDifferentEmail}>
              {login.useDifferentEmail}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onResend}
              disabled={cooldown > 0 || pending !== null}
            >
              {pending === "resend" ? <Spinner /> : null}
              {cooldown > 0 ? login.resendIn(cooldown) : login.resend}
            </Button>
          </div>
        </form>
      )}
      <TurnstileField {...captcha.field} />
    </div>
  );
}
