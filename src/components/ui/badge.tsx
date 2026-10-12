import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "pink" | "violet" | "blue" | "red" | "coral" | "olive";

const toneDot: Record<BadgeTone, string> = {
  neutral: "bg-ink-subtle",
  pink: "bg-aurora-pink",
  violet: "bg-aurora-violet",
  blue: "bg-aurora-blue",
  red: "bg-aurora-red",
  coral: "bg-aurora-coral",
  olive: "bg-aurora-olive",
};

const toneBorder: Record<BadgeTone, string> = {
  neutral: "border-line",
  pink: "border-aurora-pink/40",
  violet: "border-aurora-violet/40",
  blue: "border-aurora-blue/40",
  red: "border-aurora-red/40",
  coral: "border-aurora-coral/60",
  olive: "border-aurora-olive/50",
};

type BadgeProps = React.ComponentProps<"span"> & {
  tone?: BadgeTone;
  /** Colored dot before the label. On by default for every tone except neutral. */
  dot?: boolean;
};

function Badge({ className, tone = "neutral", dot, children, ...props }: BadgeProps) {
  const showDot = dot ?? tone !== "neutral";

  return (
    <span
      data-slot="badge"
      data-tone={tone}
      className={cn(
        "bg-surface text-meta text-ink-muted inline-flex h-6 w-fit shrink-0 items-center gap-1.5 rounded-full border px-2.5 font-medium whitespace-nowrap",
        "[&>svg]:pointer-events-none [&>svg]:size-3",
        toneBorder[tone],
        className,
      )}
      {...props}
    >
      {showDot ? (
        <span
          aria-hidden="true"
          data-slot="badge-dot"
          className={cn("size-1.5 shrink-0 rounded-full", toneDot[tone])}
        />
      ) : null}
      {children}
    </span>
  );
}

export { Badge };
export type { BadgeProps, BadgeTone };
