import { cn } from "@/lib/utils";

type GrainProps = {
  className?: string;
  /** 0 to 1. Default 0.08. */
  opacity?: number;
};

/**
 * Fixed full-screen film grain. The noise is an inline SVG feTurbulence data-URI
 * (`--grain-image` in globals.css): no JS, cheap to paint. Mount once in the root layout.
 */
export function Grain({ className, opacity = 0.08 }: GrainProps) {
  return (
    <div
      aria-hidden="true"
      data-grain
      className={cn(
        "pointer-events-none fixed inset-0 z-[100] bg-[image:var(--grain-image)] bg-[length:240px_240px] mix-blend-multiply",
        className,
      )}
      style={{ opacity }}
    />
  );
}
