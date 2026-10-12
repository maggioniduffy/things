"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { focusRing } from "@/components/ui/focus-ring";
import { cn } from "@/lib/utils";

type NavItemProps = {
  /** Destination, as produced by `viewHref`. */
  href: string;
  icon: ReactNode;
  label: string;
  /** Shown (right-aligned, subtle) only when greater than zero. */
  count?: number;
  /** Called when the link is clicked, e.g. to close the mobile drawer. */
  onNavigate?: () => void;
};

/** One sidebar link. Marked `aria-current="page"` when its href is the current pathname. */
export function NavItem({ href, icon, label, count, onNavigate }: NavItemProps) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "rounded-control text-body flex h-9 items-center gap-2.5 px-2.5",
        "ease-out-soft transition-[color,background-color,border-color] duration-(--duration-fast)",
        active ? "bg-accent text-ink font-medium" : "text-ink-muted hover:bg-accent hover:text-ink",
        focusRing,
      )}
    >
      <span
        aria-hidden="true"
        className="flex size-4 shrink-0 items-center justify-center [&_svg]:size-4"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 ? (
        <span data-slot="nav-count" className="text-meta text-ink-subtle shrink-0 tabular-nums">
          {count}
        </span>
      ) : null}
    </Link>
  );
}
