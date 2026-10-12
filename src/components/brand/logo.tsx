import { cn } from "@/lib/utils";

type LogoProps = {
  /** Mark size in px. The wordmark scales with it. Default 24. */
  size?: number;
  showWordmark?: boolean;
  className?: string;
};

function Mark({ size, ...props }: { size: number } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Three stacked chevrons: things piling up, the newest on top. */}
      <path d="M4.5 9 12 3.5 19.5 9" />
      <path d="M4.5 14.25 12 8.75 19.5 14.25" opacity={0.6} />
      <path d="M4.5 19.5 12 14 19.5 19.5" opacity={0.3} />
    </svg>
  );
}

/** Things logo: geometric chevron mark + "Things" wordmark. Accessible name is always "Things". */
export function Logo({ size = 24, showWordmark = true, className }: LogoProps) {
  if (!showWordmark) {
    return (
      <Mark
        size={size}
        role="img"
        aria-label="Things"
        className={cn("text-ink shrink-0", className)}
      />
    );
  }

  return (
    <span className={cn("text-ink inline-flex items-center gap-[0.4em]", className)}>
      <Mark size={size} aria-hidden="true" focusable="false" className="shrink-0" />
      <span
        className="font-heading tracking-heading leading-none font-semibold"
        style={{ fontSize: Math.round(size * 0.9) }}
      >
        Things
      </span>
    </span>
  );
}
