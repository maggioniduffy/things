import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Line-tinted placeholder with a light sweep. The sweep is a pseudo-element animated on
 * `transform` only (tw-animate-css `enter` keyframes, looped) and is hidden under reduced motion.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "rounded-control bg-line relative overflow-hidden",
        "before:animate-in before:via-surface before:absolute before:inset-0 before:bg-linear-to-r before:from-transparent before:to-transparent",
        "before:slide-in-from-left-full before:repeat-infinite before:duration-[1600ms] before:ease-linear before:content-['']",
        "motion-reduce:before:hidden",
        className,
      )}
      {...props}
    />
  );
}

export { Skeleton };
