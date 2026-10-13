"use client";

import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { GuestStartButton } from "@/components/account/guest-start-button";
import { Button } from "@/components/ui/button";
import { focusRing } from "@/components/ui/focus-ring";
import { useHasSession } from "@/hooks/use-has-session";
import { cn } from "@/lib/utils";

/**
 * Header link: "Sign in", or "Open app" once a session exists. Signed-in accounts are
 * redirected to /app by the proxy, so in practice the second case is a returning guest.
 */
export function HeaderAppLink() {
  const hasSession = useHasSession();
  return (
    <Link
      href={hasSession ? "/app" : "/login"}
      className={cn(
        "rounded-control text-body text-ink-muted hover:text-ink px-2 py-1 font-medium transition-[color,background-color,border-color] duration-(--duration-fast)",
        focusRing,
      )}
    >
      {hasSession ? "Open app" : "Sign in"}
    </Link>
  );
}

/** Hero buttons. A returning guest gets "Open app" in place of the guest start. */
export function HeroActions() {
  const hasSession = useHasSession();
  return (
    <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
      {hasSession ? (
        <Button asChild size="lg">
          <Link href="/app">
            Open app
            <ArrowRightIcon />
          </Link>
        </Button>
      ) : (
        <GuestStartButton size="lg" />
      )}
      <Button asChild size="lg" variant="secondary">
        <Link href="/login">Sign in</Link>
      </Button>
    </div>
  );
}
