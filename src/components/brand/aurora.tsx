import { cn } from "@/lib/utils";

type AuroraProps = {
  className?: string;
  /** "hero" for landing/auth, "subtle" (shorter, fainter) for empty states. */
  variant?: "hero" | "subtle";
  /** Slow transform-only drift. Always static under prefers-reduced-motion. Default true. */
  animated?: boolean;
};

/*
 * Five blurred blobs. The three big hills (blue, violet, pink) sit at the bottom;
 * a red/coral haze and a thin olive band hug the wavy horizon at the top edge.
 * Positions/sizes are fractions of the container; only `transform` is animated.
 */
const BLOBS = [
  {
    name: "blue",
    position: "-right-[12%] -bottom-[38%] h-[105%] w-[72%]",
    paint: "bg-[radial-gradient(closest-side,var(--color-aurora-blue),transparent)]",
    drift: "animate-aurora-c",
  },
  {
    name: "violet",
    position: "bottom-[-45%] left-[22%] h-[115%] w-[62%]",
    paint: "bg-[radial-gradient(closest-side,var(--color-aurora-violet),transparent)]",
    drift: "animate-aurora-b",
  },
  {
    name: "pink",
    position: "-bottom-[40%] -left-[14%] h-[105%] w-[70%]",
    paint: "bg-[radial-gradient(closest-side,var(--color-aurora-pink),transparent)]",
    drift: "animate-aurora-a",
  },
  {
    name: "haze",
    position: "top-[-6%] left-[8%] h-[46%] w-[84%]",
    paint:
      "bg-[radial-gradient(closest-side,var(--color-aurora-red),var(--color-aurora-coral)_55%,transparent)] opacity-85",
    drift: "animate-aurora-d",
  },
  {
    name: "olive",
    position: "top-[16%] left-[28%] h-[9%] w-[52%]",
    paint: "bg-[radial-gradient(closest-side,var(--color-aurora-olive),transparent)] opacity-100",
    drift: "animate-aurora-e",
  },
] as const;

/**
 * Iridescent "hills" rising from the bottom. CSS only (no WebGL, no JS animation).
 * Positioned absolutely at the bottom of its parent; the parent decides stacking and size context.
 */
export function Aurora({ className, variant = "hero", animated = true }: AuroraProps) {
  return (
    <div
      aria-hidden="true"
      data-aurora
      data-variant={variant}
      className={cn(
        "aurora-horizon pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden select-none",
        variant === "hero" ? "h-[min(78vh,760px)]" : "h-[min(42vh,380px)] opacity-60",
        className,
      )}
    >
      {BLOBS.map((blob) => (
        <div
          key={blob.name}
          data-aurora-blob={blob.name}
          className={cn(
            "absolute rounded-full blur-[48px] will-change-transform",
            blob.position,
            blob.paint,
            animated && blob.drift,
          )}
        />
      ))}
      {/* Own grain on top, stronger than the global one so the noise reads on color. */}
      <div
        data-aurora-grain
        className="absolute inset-0 bg-[image:var(--grain-image)] bg-[length:240px_240px] opacity-30 mix-blend-multiply"
      />
    </div>
  );
}

const GLOW_PAINT = {
  pink: "bg-[radial-gradient(closest-side,var(--color-aurora-pink),transparent)]",
  violet: "bg-[radial-gradient(closest-side,var(--color-aurora-violet),transparent)]",
  blue: "bg-[radial-gradient(closest-side,var(--color-aurora-blue),transparent)]",
  coral:
    "bg-[radial-gradient(closest-side,var(--color-aurora-coral),color-mix(in_srgb,var(--color-aurora-red)_40%,transparent)_45%,transparent)]",
} as const;

const GLOW_DRIFT = {
  pink: "animate-aurora-a",
  violet: "animate-aurora-b",
  blue: "animate-aurora-c",
  coral: "animate-aurora-d",
} as const;

type AuroraGlowProps = {
  tone: keyof typeof GLOW_PAINT;
  /**
   * Position and size within the (relative) parent, e.g. "-top-24 -right-32 size-[28rem]".
   * Don't use translate utilities: the drift animation owns `transform`.
   */
  className?: string;
  /** Same drift as the hills, static under prefers-reduced-motion. Default true. */
  animated?: boolean;
};

/**
 * One soft aurora blob (the global grain sits on top), for carrying the hero's color down a page without the full
 * hills. Faint by default; the parent must be `relative` and should clip horizontal overflow.
 */
export function AuroraGlow({ tone, className, animated = true }: AuroraGlowProps) {
  return (
    <div
      aria-hidden="true"
      data-aurora
      data-aurora-glow={tone}
      className={cn(
        "pointer-events-none absolute rounded-full opacity-35 blur-[64px] will-change-transform select-none",
        GLOW_PAINT[tone],
        animated && GLOW_DRIFT[tone],
        className,
      )}
    />
  );
}
