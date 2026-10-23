import Link from "next/link";
import { Logo } from "@/components/brand";
import { IconButton } from "@/components/ui/icon-button";
import { focusRing } from "@/components/ui/focus-ring";
import { cn } from "@/lib/utils";

const GITHUB_URL = "https://github.com/maggioniduffy/things";
const CHANGELOG_URL = `${GITHUB_URL}/blob/main/CHANGELOG.md`;

type FooterLink = { label: string; href: string; external?: boolean };

const COLUMNS: { title: string; links: FooterLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "How it works", href: "/#how-it-works" },
      { label: "Features", href: "/#features" },
      { label: "Guest mode", href: "/#guest" },
      { label: "FAQ", href: "/#faq" },
      { label: "Sign in", href: "/login" },
    ],
  },
  {
    title: "Project",
    links: [
      { label: "GitHub", href: GITHUB_URL, external: true },
      { label: "Changelog", href: CHANGELOG_URL, external: true },
    ],
  },
];

const linkClass = cn(
  "link-underline text-body text-ink-muted hover:text-ink rounded-sm transition-[color,background-color,border-color] duration-(--duration-fast)",
  focusRing,
);

/** lucide v1 ships no brand icons, so the GitHub mark is inline. */
function GitHubMark() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.69 1.25 3.35.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.59.23 2.76.11 3.05.74.81 1.18 1.83 1.18 3.09 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="border-line relative z-10 w-full border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12 sm:px-6 md:flex-row md:justify-between">
        <div className="flex max-w-xs flex-col gap-4">
          <Link
            href="/"
            aria-label="Things, home"
            className={cn("rounded-control w-fit", focusRing)}
          >
            <Logo />
          </Link>
          <p className="text-body text-ink-muted">
            A calm place to keep links, files and notes for later.
          </p>
          <div className="flex gap-2">
            <IconButton asChild label="Things on GitHub">
              <a href={GITHUB_URL} target="_blank" rel="noreferrer noopener">
                <GitHubMark />
              </a>
            </IconButton>
          </div>
        </div>
        <nav aria-label="Footer" className="flex gap-16 sm:gap-24">
          {COLUMNS.map((column) => (
            <div key={column.title} className="flex flex-col gap-3">
              <h2 className="text-card text-ink font-medium">{column.title}</h2>
              <ul className="flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    {link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer noopener"
                        className={linkClass}
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link href={link.href} className={linkClass}>
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="border-line border-t">
        <p className="text-meta text-ink-subtle mx-auto w-full max-w-6xl px-4 py-5 sm:px-6">
          © {new Date().getFullYear()} Things
        </p>
        <a href="https://cafecito.app/maggioniduffy" target="_blank">
         Buy me a coffe! 
        </a>
      </div>
    </footer>
  );
}
