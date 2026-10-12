import * as React from "react";
import { cn } from "@/lib/utils";

const keyClasses = cn(
  "inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-line bg-surface px-1",
  "font-sans text-meta leading-none font-medium text-ink-muted tabular-nums select-none",
  "[&_svg:not([class*='size-'])]:size-3",
  "[[data-slot=tooltip-content]_&]:border-primary-foreground/30 [[data-slot=tooltip-content]_&]:bg-transparent [[data-slot=tooltip-content]_&]:text-primary-foreground",
);

type KbdProps = React.ComponentProps<"kbd"> & {
  /** One key per entry, rendered as a group (e.g. ["⌘", "K"]). Overrides children. */
  keys?: string[];
};

function Kbd({ className, keys, children, ...props }: KbdProps) {
  if (keys && keys.length > 0) {
    return (
      <KbdGroup className={className} {...props}>
        {keys.map((key, index) => (
          <kbd key={`${key}-${index}`} data-slot="kbd" className={keyClasses}>
            {key}
          </kbd>
        ))}
      </KbdGroup>
    );
  }

  return (
    <kbd data-slot="kbd" className={cn(keyClasses, className)} {...props}>
      {children}
    </kbd>
  );
}

function KbdGroup({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd-group"
      className={cn("inline-flex items-center gap-1", className)}
      {...props}
    />
  );
}

export { Kbd, KbdGroup };
export type { KbdProps };
