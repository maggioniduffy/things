import * as React from "react";
import { cn } from "@/lib/utils";
import { focusRing } from "./focus-ring";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "rounded-control border-line bg-surface text-ink sm:text-body h-9 w-full min-w-0 border px-3 text-base",
        "ease-out-soft placeholder:text-ink-subtle hover:border-ink/30 transition-[color,background-color,border-color] duration-(--duration-fast)",
        "file:text-meta file:text-ink file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive",
        focusRing,
        className,
      )}
      {...props}
    />
  );
}

export { Input };
