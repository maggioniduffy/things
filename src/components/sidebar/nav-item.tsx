"use client";

import { useDroppable } from "@dnd-kit/core";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";
import { dropData, type DropTarget } from "@/components/dnd/targets";
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
  /**
   * The row has a `RowMenu` over its right edge (inside a `group/row`). While the menu shows,
   * the link leaves room for it and the count steps aside so they never overlap.
   */
  hasMenu?: boolean;
  /** Makes the row a drop target for dragged cards. Formats and smart views have none. */
  drop?: DropTarget;
};

/** When a row's menu is showing: hover, focus within, or the menu open. Always on small screens. */
const MENU_ROOM =
  "max-md:pr-10 group-hover/row:pr-10 group-focus-within/row:pr-10 group-has-[[data-state=open]]/row:pr-10";
const COUNT_HIDDEN_WITH_MENU =
  "md:group-hover/row:hidden md:group-focus-within/row:hidden md:group-has-[[data-state=open]]/row:hidden";

/** Aurora ring shown around a row while a card is over it: a gradient, cut down to a 2px border. */
const DROP_RING_STYLE: CSSProperties = {
  background:
    "linear-gradient(90deg, var(--color-aurora-pink), var(--color-aurora-violet), var(--color-aurora-blue))",
  WebkitMask: "linear-gradient(black 0 0) content-box, linear-gradient(black 0 0)",
  WebkitMaskComposite: "xor",
  mask: "linear-gradient(black 0 0) content-box exclude, linear-gradient(black 0 0)",
};

/**
 * One sidebar link. Marked `aria-current="page"` when its href is the current pathname. With a
 * `drop` target it accepts dragged cards: while one is over it the row scales to 1.03 and the
 * aurora ring fades in (150 ms; opacity only under reduced motion).
 */
export function NavItem({ href, icon, label, count, onNavigate, hasMenu, drop }: NavItemProps) {
  const pathname = usePathname();
  const active = pathname === href;
  const { setNodeRef, isOver } = useDroppable({
    id: drop?.id ?? `nav:${href}`,
    disabled: !drop,
    data: drop ? dropData(drop) : undefined,
  });
  const dropping = Boolean(drop) && isOver;

  return (
    <Link
      ref={setNodeRef}
      href={href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "rounded-control text-body relative flex h-9 items-center gap-2.5 px-2.5",
        "ease-out-soft transition-[color,background-color,border-color,transform] duration-(--duration-fast)",
        active ? "bg-accent text-ink font-medium" : "text-ink-muted hover:bg-accent hover:text-ink",
        dropping && "bg-accent text-ink motion-safe:scale-[1.03]",
        hasMenu && MENU_ROOM,
        focusRing,
      )}
    >
      {drop ? (
        <span
          aria-hidden="true"
          data-slot="drop-ring"
          data-over={dropping ? "true" : undefined}
          style={DROP_RING_STYLE}
          className="rounded-control ease-out-soft pointer-events-none absolute inset-0 p-0.5 opacity-0 transition-opacity duration-(--duration-fast) data-[over=true]:opacity-100"
        />
      ) : null}
      <span
        aria-hidden="true"
        className="flex size-4 shrink-0 items-center justify-center [&_svg]:size-4"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 ? (
        <span
          data-slot="nav-count"
          className={cn(
            "text-meta text-ink-subtle shrink-0 tabular-nums",
            hasMenu && COUNT_HIDDEN_WITH_MENU,
          )}
        >
          {count}
        </span>
      ) : null}
    </Link>
  );
}
