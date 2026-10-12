"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { cn } from "@/lib/utils";
import { focusRing } from "./focus-ring";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

const iconButtonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center rounded-control text-ink",
    "transition-[color,background-color,border-color] duration-(--duration-fast) ease-out-soft",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
    focusRing,
  ],
  {
    variants: {
      variant: {
        outline: "border border-line bg-surface hover:border-ink/30",
        ghost: "hover:bg-accent",
      },
      size: {
        sm: "size-8",
        md: "size-10",
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "md",
    },
  },
);

type IconButtonProps = Omit<React.ComponentProps<"button">, "aria-label"> &
  VariantProps<typeof iconButtonVariants> & {
    /** Accessible name; also the tooltip text. Required: an icon alone is not a label. */
    label: string;
    /** Show the label as a tooltip on hover/focus. Pass `false` to opt out. */
    tooltip?: boolean;
    asChild?: boolean;
  };

function IconButton({
  label,
  tooltip = true,
  variant,
  size,
  asChild = false,
  className,
  ...props
}: IconButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  const button = (
    <Comp
      data-slot="icon-button"
      data-variant={variant ?? "outline"}
      data-size={size ?? "md"}
      aria-label={label}
      className={cn(iconButtonVariants({ variant, size }), className)}
      {...props}
    />
  );

  if (!tooltip) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

export { IconButton, iconButtonVariants };
export type { IconButtonProps };
