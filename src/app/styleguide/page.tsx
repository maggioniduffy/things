import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Logo } from "@/components/brand";
import { BrandSection } from "./_sections/brand";
import { CardsSection } from "./_sections/cards";
import { ColorsSection } from "./_sections/colors";
import { ComponentsSection } from "./_sections/components";
import { ShapeMotionSection } from "./_sections/shape-motion";
import { TypographySection } from "./_sections/typography";

export const metadata: Metadata = {
  title: "Styleguide",
  robots: { index: false },
};

// Read STYLEGUIDE at request time, not at build time.
export const dynamic = "force-dynamic";

const NAV = [
  { id: "colors", label: "Colors" },
  { id: "typography", label: "Typography" },
  { id: "shape-motion", label: "Radii, shadows, motion" },
  { id: "brand", label: "Brand" },
  { id: "components", label: "Components" },
  { id: "cards", label: "Cards" },
] as const;

export default function StyleguidePage() {
  // Dev-only. `STYLEGUIDE=1` opens it in a production build (e2e runs against `next start`).
  if (process.env.NODE_ENV === "production" && process.env.STYLEGUIDE !== "1") notFound();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
      <header className="flex flex-col gap-3 pt-8">
        <Logo />
        <h1 className="text-page text-ink font-semibold">Styleguide</h1>
        <p className="text-body text-ink-muted max-w-[60ch]">
          Every token and component in one place. Dev only.
        </p>
      </header>
      <nav
        aria-label="Styleguide sections"
        className="border-line bg-paper/95 sticky top-0 z-40 -mx-4 mt-6 overflow-x-auto border-b px-4 backdrop-blur-md sm:-mx-6 sm:px-6"
      >
        <ul className="flex gap-1 py-2">
          {NAV.map((item) => (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className="rounded-control text-body text-ink-muted hover:bg-accent hover:text-ink focus-visible:outline-ring inline-flex h-8 items-center px-3 font-medium whitespace-nowrap transition-[color,background-color,border-color] duration-(--duration-fast) focus-visible:outline-2"
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <main>
        <ColorsSection />
        <TypographySection />
        <ShapeMotionSection />
        <BrandSection />
        <ComponentsSection />
        <CardsSection />
      </main>
    </div>
  );
}
