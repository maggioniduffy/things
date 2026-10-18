"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type GoogleButtonProps = {
  onClick: () => void;
  /** True while the browser is heading to Google: the button washes through the aurora colors. */
  pending: boolean;
  disabled?: boolean;
  children: ReactNode;
};

/**
 * Secondary button with the Google "G". While pending it stays at full opacity (not `disabled`,
 * which dims it) so the color wash reads; clicks are ignored instead. Reduced motion: a still tint.
 */
export function GoogleButton({ onClick, pending, disabled = false, children }: GoogleButtonProps) {
  return (
    <Button
      type="button"
      variant="secondary"
      className="relative isolate overflow-hidden"
      onClick={pending ? undefined : onClick}
      disabled={disabled && !pending}
      aria-busy={pending}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-0 -z-10 bg-aurora-violet",
          "transition-opacity duration-(--duration-base) ease-out-soft",
          pending ? "animate-aurora-fade opacity-45" : "opacity-0",
        )}
      />
      <Image src="/brand/google-g.svg" alt="" width={16} height={16} unoptimized />
      {children}
    </Button>
  );
}
