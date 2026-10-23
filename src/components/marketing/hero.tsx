import Link from "next/link";
import { ClipboardPasteIcon, FolderTreeIcon, SearchIcon } from "lucide-react";
import { Aurora, Logo } from "@/components/brand";
import { focusRing } from "@/components/ui/focus-ring";
import { getT } from "@/i18n/server";
import { cn } from "@/lib/utils";
import { HeaderAppLink, HeroActions } from "./app-entry";

/** Slim top bar over the hero: logo left, page sections and "Sign in" (or "Open app") right. */
export async function SiteHeader() {
  const t = await getT();
  const nav = t.marketing.nav;
  const links = [
    { label: nav.howItWorks, href: "#how-it-works" },
    { label: nav.install, href: "#install" },
    { label: nav.features, href: "#features" },
    { label: nav.faq, href: "#faq" },
  ];
  return (
    <header className="relative z-10 mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
      <Link
        href="/"
        aria-label={t.auth.login.homeLabel}
        className={cn("rounded-control", focusRing)}
      >
        <Logo />
      </Link>
      <div className="flex items-center gap-2 sm:gap-4">
        <nav aria-label={nav.label} className="hidden md:block">
          <ul className="flex items-center gap-1">
            {links.map((link) => (
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

export async function Hero() {
  const { hero } = (await getT()).marketing;
  return (
    <section
      aria-labelledby="hero-title"
      className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center px-4 pt-[clamp(1rem,4vh,3rem)] pb-10 text-center sm:px-6"
    >
      <h1
        id="hero-title"
        className="font-heading tracking-heading text-ink max-w-[16ch] text-[length:clamp(2.5rem,7vw,4.5rem)] leading-[1.04] font-semibold text-balance"
      >
        {hero.title}
      </h1>
      <p className="text-body text-ink-muted mt-5 max-w-[46ch] text-pretty sm:text-[length:var(--text-section)] sm:leading-[var(--text-section--line-height)]">
        {hero.lead}
      </p>
      <HeroActions />
    </section>
  );
}

const STEP_ICONS = [ClipboardPasteIcon, FolderTreeIcon, SearchIcon];

export async function HowItWorks() {
  const { how } = (await getT()).marketing;
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-title"
      className="border-line relative z-10 w-full scroll-mt-4 border-t"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col items-center gap-2 pt-8 text-center">
          <h2
            id="how-title"
            className="font-heading tracking-heading text-ink text-[length:var(--text-section)] leading-[var(--text-section--line-height)] font-semibold"
          >
            {how.title}
          </h2>
          <p className="text-body text-ink-muted max-w-[52ch] text-pretty">{how.lead}</p>
        </div>
        <ol className="grid gap-4 py-6 md:grid-cols-3">
          {how.steps.map(({ title, body, example, chips }, index) => {
            const Icon = STEP_ICONS[index] ?? SearchIcon;
            return (
              <li
                key={title}
                className="border-line bg-surface rounded-card flex flex-col gap-3 border p-5"
              >
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
                  <p className="text-body text-ink-muted">{body}</p>
                </div>
                <div
                  aria-hidden="true"
                  className="border-line bg-paper rounded-control flex flex-wrap items-center gap-1.5 border p-2"
                >
                  {chips.map((chip) => (
                    <span
                      key={chip}
                      className="border-line bg-surface text-ink-muted text-meta rounded-control border px-2 py-0.5"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
                <p className="text-meta text-ink-subtle">{example}</p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
