"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { AUTH_MESSAGES, mapAuthError } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import { TurnstileField, useTurnstile } from "./turnstile-field";

type GuestStartButtonProps = Pick<ButtonProps, "variant" | "size" | "className"> & {
  children?: React.ReactNode;
  /** Classes for the captcha widget rendered after the button (a sibling in the parent layout). */
  captchaClassName?: string;
};

/**
 * Starts an anonymous (guest) session and opens the app. If a session already exists,
 * guest or real, it only navigates. Used on the landing page and on /login.
 */
export function GuestStartButton({
  variant,
  size,
  className,
  children = "Try without an account",
  captchaClassName,
}: GuestStartButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const captcha = useTurnstile();

  async function start() {
    setPending(true);
    try {
      const supabase = createClient();
      const { data: existing } = await supabase.auth.getSession();

      if (!existing.session) {
        const captchaToken = await captcha.getToken();
        if (captchaToken === null) {
          toast.error(AUTH_MESSAGES.captcha);
          setPending(false);
          return;
        }
        const { error } = await supabase.auth.signInAnonymously({ options: { captchaToken } });
        captcha.reset();
        if (error) {
          toast.error(mapAuthError(error));
          setPending(false);
          return;
        }
      }

      router.push("/app");
      router.refresh();
    } catch (error) {
      toast.error(mapAuthError(error));
      setPending(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={start}
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? <LoaderCircleIcon className="animate-spin motion-reduce:animate-none" /> : null}
        {children}
      </Button>
      <TurnstileField {...captcha.field} className={captchaClassName} />
    </>
  );
}
