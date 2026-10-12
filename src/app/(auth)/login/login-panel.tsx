"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GuestStartButton } from "@/components/account/guest-start-button";
import { OtpForm } from "@/components/account/otp-form";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { mapAuthError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

type LoginPanelProps = {
  /** Already sanitized with `safeNextPath` on the server. */
  next: string | null;
  callbackFailed: boolean;
};

const CALLBACK_FAILED_MESSAGE = "We couldn't finish signing you in. Try again.";

export function LoginPanel({ next, callbackFailed }: LoginPanelProps) {
  const router = useRouter();
  const [googlePending, setGooglePending] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(
    callbackFailed ? CALLBACK_FAILED_MESSAGE : null,
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
          <Button
            type="button"
            variant="secondary"
            onClick={continueWithGoogle}
            disabled={googlePending}
            aria-busy={googlePending}
          >
            {googlePending ? (
              <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" />
            ) : null}
            Continue with Google
          </Button>
        ) : null}
        <GuestStartButton variant="ghost" className="w-full" />
      </div>
    </div>
  );
}
