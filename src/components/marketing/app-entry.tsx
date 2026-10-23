"use client";

import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { GuestStartButton } from "@/components/account/guest-start-button";
import { Button } from "@/components/ui/button";
import { focusRing } from "@/components/ui/focus-ring";
import { useT } from "@/i18n/client";
import { useHasSession } from "@/hooks/use-has-session";
import { cn } from "@/lib/utils";

/**
 * Header link: "Sign in", or "Open app" once a session exists. Signed-in accounts are
 * redirected to /app by the proxy, so in practice the second case is a returning guest.
 */
export function HeaderAppLink() {
  const hasSession = useHasSession();
  const { entry } = useT().marketing;
  return (
    <Link
      href={hasSession ? "/app" : "/login"}
      className={cn(
        "rounded-control text-body text-ink-muted hover:text-ink px-2 py-1 font-medium transition-[color,background-color,border-color] duration-(--duration-fast)",
        focusRing,
      )}
    >
      {hasSession ? entry.openApp : entry.signIn}
    </Link>
  );
}

/**
 * Hero buttons. A returning guest gets "Open app" in place of the guest start.
 * The guest button's captcha widget is full width (flexible size), so it wraps onto its own
 * last row instead of sitting between the two buttons and pushing them apart.
 */
export function HeroActions({ className }: { className?: string }) {
  const hasSession = useHasSession();
  const { entry } = useT().marketing;
  return (
    <div
      className={cn(
        "mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center",
        className,
      )}
    >
      {hasSession ? (
        <Button asChild size="lg">
          <Link href="/app">
            {entry.openApp}
            <ArrowRightIcon />
          </Link>
        </Button>
      ) : (
        <GuestStartButton size="lg" captchaClassName="order-last w-full sm:basis-full" />
      )}
      <Button asChild size="lg" variant="secondary">
        <Link href="/login">{entry.signIn}</Link>
      </Button>
    </div>
  );
}
