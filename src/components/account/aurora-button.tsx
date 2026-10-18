"use client";

import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AuroraButtonProps = Omit<ComponentProps<typeof Button>, "disabled"> & {
  /** True while the request runs: the aurora fill sweeps in and keeps flowing, the label swaps. */
  pending: boolean;
  /** Label shown while pending ("Sending…"). */
  pendingLabel: string;
  /** Leading icon, kept while pending. */
  icon?: ReactNode;
  disabled?: boolean;
};

/**
 * Sign-in button with the aurora loading fill. While pending it stays at full opacity (not
 * `disabled`, which dims it) so the fill reads; clicks are ignored instead. Reduced motion: a
 * still fill.
 */
export function AuroraButton({
  pending,
  pendingLabel,
  icon,
  disabled = false,
  className,
  onClick,
  type = "button",
  children,
  ...props
}: AuroraButtonProps) {
  return (
    <Button
      {...props}
      type={type}
      className={cn(
        "relative isolate overflow-hidden",
        pending &&
          "text-ink-inverse [text-shadow:0_1px_2px_color-mix(in_srgb,var(--color-ink)_55%,transparent)]",
        className,
      )}
      onClick={(event) => {
        if (pending) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      disabled={disabled && !pending}
      aria-busy={pending}
    >
      {pending ? (
        <span
          aria-hidden="true"
          data-slot="aurora-fill"
          className="aurora-fill pointer-events-none absolute inset-0 -z-10"
        />
      ) : null}
      {icon}
      {pending ? pendingLabel : children}
    </Button>
  );
}
