"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { GoogleButton } from "@/components/account/google-button";
import { GuestStartButton } from "@/components/account/guest-start-button";
import { OtpForm } from "@/components/account/otp-form";
import { Separator } from "@/components/ui/separator";
import { AUTH_MESSAGES, mapAuthError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

type LoginPanelProps = {
  /** Already sanitized with `safeNextPath` on the server. */
  next: string | null;
  callbackError: "generic" | "account_exists" | null;
};

const CALLBACK_FAILED_MESSAGE = "We couldn't finish signing you in. Try again.";

export function LoginPanel({ next, callbackError }: LoginPanelProps) {
  const router = useRouter();
  const [googlePending, setGooglePending] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(
    callbackError === "account_exists"
      ? AUTH_MESSAGES.accountExists
      : callbackError
        ? CALLBACK_FAILED_MESSAGE
        : null,
  );
  // Referenced literally so Next inlines it; unset locally so no broken button shows.
  const googleEnabled = process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true";

  function onSignedIn() {
    router.replace(next ?? "/app");
    router.refresh();
  }

  async function continueWithGoogle() {
    setGooglePending(true);
    setGoogleError(null);
    try {
      const callback = new URL("/auth/callback", window.location.origin);
      if (next) callback.searchParams.set("next", next);
      const { error } = await createClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: callback.toString() },
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
      {googleError ? (
        <p role="alert" className="text-meta text-ink">
          {googleError}
        </p>
      ) : null}

      <OtpForm onSignedIn={onSignedIn} />

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3" aria-hidden="true">
          <Separator className="flex-1" />
          <span className="text-meta text-ink-subtle">or</span>
          <Separator className="flex-1" />
        </div>
        {googleEnabled ? (
          <GoogleButton onClick={continueWithGoogle} pending={googlePending}>
            Continue with Google
          </GoogleButton>
        ) : null}
        <GuestStartButton variant="ghost" className="w-full" />
      </div>
    </div>
  );
}
