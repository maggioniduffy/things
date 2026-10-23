"use client";

import { useId } from "react";
import { useT } from "@/i18n/client";
import { cn } from "@/lib/utils";

type MarkVariant = "color" | "duo" | "mono";

type LogoProps = {
  /** Mark size in px. The wordmark scales with it. Default 24. */
  size?: number;
  showWordmark?: boolean;
  /**
   * "color": blue-violet and blush-red gradients (default). "duo": ink card plus aurora card.
   * "mono": single color from `currentColor`, for aurora and photography grounds.
   */
  variant?: MarkVariant;
  className?: string;
};

const stop = (token: string) => ({ stopColor: `var(--color-aurora-${token})` });

function Mark({
  size,
  variant,
  ...props
}: { size: number; variant: MarkVariant } & React.SVGProps<SVGSVGElement>) {
  const id = useId();
  const a = `${id}-a`;
  const b = `${id}-b`;
  const c = `${id}-c`;
  const left =
    variant === "mono" ? "currentColor" : variant === "duo" ? "var(--color-ink)" : `url(#${a})`;
  const right =
    variant === "mono" ? "currentColor" : variant === "duo" ? `url(#${c})` : `url(#${b})`;

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      strokeWidth={2}
      strokeLinejoin="round"
      style={{ display: "block", overflow: "visible" }}
      {...props}
    >
      {variant !== "mono" && (
        <defs>
          <linearGradient id={a} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={stop("blue")} />
            <stop offset="0.55" style={stop("violet")} />
            <stop offset="1" style={stop("pink")} />
          </linearGradient>
          <linearGradient id={b} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={stop("coral")} />
            <stop offset="0.5" style={stop("pink")} />
            <stop offset="1" style={stop("red")} />
          </linearGradient>
          <linearGradient id={c} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={stop("blue")} />
            <stop offset="0.5" style={stop("pink")} />
            <stop offset="1" style={stop("red")} />
          </linearGradient>
        </defs>
      )}
      {/* Two sheared cards, offset: things filed side by side. */}
      <path d="M1.85 4.2 10.5 9.2V22.8L1.85 17.8z" fill={left} stroke={left} />
      <path d="M13.5 1.2 22.15 6.2V19.8L13.5 14.8z" fill={right} stroke={right} />
    </svg>
  );
}

/**
 * Two-card mark + wordmark. The "teca" suffix takes the mark's gradient ("color", "duo") or a
 * light weight ("mono"). Accessible name is always the full product name
 * (Thingteca / Cosateca).
 */
export function Logo({ size = 24, showWordmark = true, variant = "color", className }: LogoProps) {
  const { brand } = useT().common;
  if (!showWordmark) {
    return (
      <span className={cn("text-ink inline-flex shrink-0", className)}>
        <Mark size={size} variant={variant} role="img" aria-label={brand.name} />
      </span>
    );
  }

  return (
    <span
      className={cn("text-ink inline-flex items-center", className)}
      style={{ gap: Math.round(size * 0.25) }}
    >
      <Mark size={size} variant={variant} aria-hidden="true" focusable="false" />
      <span
        className="font-heading tracking-heading leading-none font-semibold"
        style={{ fontSize: Math.round(size * 0.9) }}
      >
        {brand.stem}
        <span
          className={
            variant === "mono"
              ? "font-light opacity-75"
              : "from-aurora-blue via-aurora-violet to-aurora-pink bg-linear-to-r bg-clip-text text-transparent"
          }
        >
          teca
        </span>
      </span>
    </span>
  );
}
