"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GoogleButton } from "@/components/account/google-button";
import { GuestStartButton } from "@/components/account/guest-start-button";
import { OtpForm } from "@/components/account/otp-form";
import { useLocale, useT } from "@/i18n/client";
import { Separator } from "@/components/ui/separator";
import { mapAuthError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

type LoginPanelProps = {
  /** Already sanitized with `safeNextPath` on the server. */
  next: string | null;
  callbackError: "generic" | "account_exists" | null;
};

export function LoginPanel({ next, callbackError }: LoginPanelProps) {
  const router = useRouter();
  const { login, errors } = useT().auth;
  const locale = useLocale();
  const [googlePending, setGooglePending] = useState(false);
  // The callback error is kept as a kind and turned into text at render, so it follows the locale.
  const [callbackKind, setCallbackKind] = useState(callbackError);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const shownError =
    googleError ??
    (callbackKind === "account_exists"
      ? errors.accountExists
      : callbackKind
        ? errors.callbackFailed
        : null);
  // Referenced literally so Next inlines it; unset locally so no broken button shows.
  const googleEnabled = process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true";

  function onSignedIn() {
    router.replace(next ?? "/app");
    router.refresh();
  }

  async function continueWithGoogle() {
    setGooglePending(true);
    setGoogleError(null);
    setCallbackKind(null);
    try {
      const callback = new URL("/auth/callback", window.location.origin);
      if (next) callback.searchParams.set("next", next);
      const { error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callback.toString(), queryParams: { hl: locale } },
      });
      if (error) {
        setGoogleError(mapAuthError(error));
        setGooglePending(false);
      }
      // On success the browser is already navigating to Google.
    } catch (thrown) {
      setGoogleError(mapAuthError(thrown));
      setGooglePending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {shownError ? (
        <p role="alert" className="text-meta text-ink">
          {shownError}
        </p>
      ) : null}

      <OtpForm onSignedIn={onSignedIn} />

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3" aria-hidden="true">
          <Separator className="flex-1" />
          <span className="text-meta text-ink-subtle">{login.or}</span>
          <Separator className="flex-1" />
        </div>
        {googleEnabled ? (
          <GoogleButton onClick={continueWithGoogle} pending={googlePending}>
            {login.continueWithGoogle}
          </GoogleButton>
        ) : null}
        <GuestStartButton variant="ghost" className="w-full" />
      </div>
    </div>
  );
}
