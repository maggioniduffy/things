import Link from "next/link";
import { ClipboardPasteIcon, FolderTreeIcon, SearchIcon } from "lucide-react";
import { Aurora, Logo } from "@/components/brand";
import { focusRing } from "@/components/ui/focus-ring";
import { cn } from "@/lib/utils";
import { HeaderAppLink, HeroActions } from "./app-entry";

const NAV_LINKS = [
  { label: "How it works", href: "#how-it-works" },
  { label: "Features", href: "#features" },
  { label: "FAQ", href: "#faq" },
] as const;

/** Slim top bar over the hero: logo left, page sections and "Sign in" (or "Open app") right. */
export function SiteHeader() {
  return (
    <header className="relative z-10 mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
      <Link href="/" aria-label="Thingteca, home" className={cn("rounded-control", focusRing)}>
        <Logo />
      </Link>
      <div className="flex items-center gap-2 sm:gap-4">
        <nav aria-label="Page sections" className="hidden md:block">
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className={cn(
                    "rounded-control text-body text-ink-muted hover:text-ink px-2 py-1 transition-[color,background-color,border-color] duration-(--duration-fast)",
                    focusRing,
                  )}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <HeaderAppLink />
      </div>
    </header>
  );
}

/** The aurora fills the first viewport and rises from its bottom edge, behind the content. */
export function HeroBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 h-dvh overflow-hidden [mask-image:linear-gradient(to_bottom,black_70%,transparent)]"
    >
      <Aurora variant="hero" className="h-[min(62vh,620px)]" />
    </div>
  );
}

export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative z-10 mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-4xl flex-col items-center px-4 pt-[clamp(2rem,7vh,5rem)] text-center sm:px-6"
    >
      <h1
        id="hero-title"
        className="font-heading tracking-heading text-ink max-w-[16ch] text-[length:clamp(2.5rem,7vw,4.5rem)] leading-[1.04] font-semibold text-balance"
      >
        Save anything. Find it again.
      </h1>
      <p className="text-body text-ink-muted mt-5 max-w-[46ch] text-pretty sm:text-[length:var(--text-section)] sm:leading-[var(--text-section--line-height)]">
        Drop in links, files and notes. Thingteca sorts them by format and keeps them easy to find.
      </p>
      <HeroActions />
    </section>
  );
}

const STEPS = [
  {
    icon: ClipboardPasteIcon,
    title: "Capture in one gesture",
    body: "Paste a link, drop a file or jot a note. It saves at once, with no form to fill in first.",
  },
  {
    icon: FolderTreeIcon,
    title: "Organize without effort",
    body: "Each save is filed by format and enriched with a title, image and thumbnail a moment later.",
  },
  {
    icon: SearchIcon,
    title: "Find it again",
    body: "Search, filter by format, tag or status, and open any item for a full preview.",
  },
] as const;

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-title"
      className="border-line relative z-10 w-full scroll-mt-4 border-t"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <h2 id="how-title" className="sr-only">
          How it works
        </h2>
        <ol className="divide-line grid divide-y md:grid-cols-3 md:divide-x md:divide-y-0">
          {STEPS.map(({ icon: Icon, title, body }, index) => (
            <li key={title} className="flex flex-col gap-4 py-8 md:px-8 md:first:pl-0 md:last:pr-0">
              <div
                aria-hidden="true"
                className="rounded-control border-line bg-surface text-ink flex size-10 items-center justify-center border"
              >
                <Icon className="size-[18px]" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-card text-ink font-medium">
                  <span className="text-ink-subtle tabular-nums">{index + 1}. </span>
                  {title}
                </h3>
                <p className="text-body text-ink-muted max-w-[34ch]">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
