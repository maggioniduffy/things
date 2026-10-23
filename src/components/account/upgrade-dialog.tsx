"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocale, useT } from "@/i18n/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  AUTH_MESSAGES,
  EMAIL_CHANGE_OTP_TYPE,
  isAccountConflict,
  isValidOtp,
  mapAuthError,
} from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { AuroraButton } from "./aurora-button";
import { GoogleButton } from "./google-button";
import { OtpCodeInput } from "./otp-code-input";

const RESEND_COOLDOWN_SECONDS = 30;

type UpgradeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function Spinner() {
  return (
    <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
  );
}

/** Inline, announced error. Always rendered so the dialog does not jump when a message appears. */
function FieldError({ id, message }: { id: string; message: string | null }) {
  return (
    <p id={id} role="alert" className="text-meta text-ink min-h-[18px]">
      {message}
    </p>
  );
}

/**
 * Turns a guest into a regular user without changing the user id, so every saved item stays.
 * Email: `updateUser({ email })` sends a 6-digit `email_change` code. Google: `linkIdentity`.
 */
export function UpgradeDialog({ open, onOpenChange }: UpgradeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Mounted only while open, so closing the dialog resets the form. */}
        <UpgradeFlow onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function UpgradeFlow({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { login, upgrade, errors } = useT().auth;
  const locale = useLocale();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState<"send" | "verify" | "resend" | "google" | "leave" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const emailId = useId();
  const codeId = useId();
  const errorId = useId();
  const codeInput = useRef<HTMLInputElement>(null);
  // Referenced literally so Next inlines it; unset locally so no broken button shows.
  const googleEnabled = process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true";

  useEffect(() => {
    if (step === "code") codeInput.current?.focus();
  }, [step]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  function fail(thrown: unknown) {
    if (isAccountConflict(thrown)) {
      setConflict(true);
      setError(null);
    } else {
      setError(mapAuthError(thrown));
    }
  }

  function callbackUrl() {
    return `${window.location.origin}/auth/callback?next=/app`;
  }

  async function onSendCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const address = email.trim();
    if (!address) return;
    setError(null);
    setConflict(false);
    setPending("send");
    try {
      const { error: updateError } = await createClient().auth.updateUser(
        { email: address, data: { locale } },
        { emailRedirectTo: callbackUrl() },
      );
      if (updateError) {
        fail(updateError);
        setPending(null);
        return;
      }
      setEmail(address);
      setCode("");
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setStep("code");
      setPending(null);
    } catch (thrown) {
      fail(thrown);
      setPending(null);
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
      const { error: verifyError } = await createClient().auth.verifyOtp({
        email,
        token,
        type: EMAIL_CHANGE_OTP_TYPE,
      });
      if (verifyError) {
        fail(verifyError);
        setCode("");
        setPending(null);
        codeInput.current?.focus();
        return;
      }
      toast.success(upgrade.saved(email));
      onClose();
      router.refresh();
    } catch (thrown) {
      fail(thrown);
      setPending(null);
    }
  }

  async function onResend() {
    if (pending || cooldown > 0) return;
    setError(null);
    setPending("resend");
    try {
      const { error: resendError } = await createClient().auth.resend({
        type: EMAIL_CHANGE_OTP_TYPE,
        email,
      });
      if (resendError) {
        fail(resendError);
      } else {
        setCode("");
        setCooldown(RESEND_COOLDOWN_SECONDS);
        codeInput.current?.focus();
      }
    } catch (thrown) {
      fail(thrown);
    }
    setPending(null);
  }

  function useDifferentEmail() {
    setStep("email");
    setCode("");
    setError(null);
    setConflict(false);
    setCooldown(0);
  }

  async function linkGoogle() {
    if (pending) return;
    setError(null);
    setConflict(false);
    setPending("google");
    try {
      const { error: linkError } = await createClient().auth.linkIdentity({
        provider: "google",
        options: { redirectTo: callbackUrl() },
      });
      if (linkError) {
        fail(linkError);
        setPending(null);
      }
      // On success the browser is already navigating to Google.
    } catch (thrown) {
      fail(thrown);
      setPending(null);
    }
  }

  /** v1: guest items do not move into an existing account, so leave the guest session behind. */
  async function signInInstead() {
    if (pending) return;
    setPending("leave");
    try {
      await createClient().auth.signOut();
    } catch {
      // The login page still works if the local session could not be cleared cleanly.
    }
    onClose();
    router.replace("/login?next=/app");
    router.refresh();
  }

  const conflictNotice = conflict ? (
    <div
      role="alert"
      className="border-line bg-paper rounded-control text-meta text-ink flex flex-col items-start gap-2 border p-3"
    >
      <p>{errors.accountExists}</p>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={signInInstead}
        disabled={pending === "leave"}
        aria-busy={pending === "leave"}
      >
        {pending === "leave" ? <Spinner /> : null}
        {upgrade.signInInstead}
      </Button>
    </div>
  ) : null;

  if (step === "code") {
    return (
      <>
        <DialogHeader>
          <DialogTitle>{login.checkEmailTitle}</DialogTitle>
          <DialogDescription>{login.checkEmailBody}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void verify(code);
          }}
          className="flex flex-col gap-3"
        >
          <div className="flex flex-col gap-1.5">
            <label htmlFor={codeId} className="text-body text-ink-muted">
              {login.codeLabel} <span className="text-ink font-medium break-all">{email}</span>
            </label>
            <OtpCodeInput
              ref={codeInput}
              id={codeId}
              value={code}
              onValueChange={(next) => {
                setCode(next);
                if (error) setError(null);
              }}
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
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{upgrade.title}</DialogTitle>
        <DialogDescription>{upgrade.description}</DialogDescription>
      </DialogHeader>
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
              if (conflict) setConflict(false);
            }}
            readOnly={pending === "send"}
            aria-invalid={error ? true : undefined}
            aria-describedby={errorId}
          />
          <FieldError id={errorId} message={error} />
        </div>
        {conflictNotice}
        <AuroraButton type="submit" pending={pending === "send"} pendingLabel={login.sending}>
          {login.sendCode}
        </AuroraButton>
      </form>
      {googleEnabled ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3" aria-hidden="true">
            <Separator className="flex-1" />
            <span className="text-meta text-ink-subtle">{login.or}</span>
            <Separator className="flex-1" />
          </div>
          <GoogleButton
            onClick={linkGoogle}
            pending={pending === "google"}
            disabled={pending !== null}
          >
            {upgrade.linkGoogle}
          </GoogleButton>
        </div>
      ) : null}
    </>
  );
}
