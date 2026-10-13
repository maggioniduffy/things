import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Spike, type SpikeMode } from "./_spike";

export const metadata: Metadata = {
  title: "DnD spike",
  robots: { index: false },
};

// Read STYLEGUIDE at request time, not at build time.
export const dynamic = "force-dynamic";

const MODES: SpikeMode[] = ["off-during-drag", "always", "none"];

export default async function DndSpikePage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  // Dev-only. `STYLEGUIDE=1` opens it in a production build.
  if (process.env.NODE_ENV === "production" && process.env.STYLEGUIDE !== "1") notFound();

  const { mode } = await searchParams;
  const resolved = MODES.find((m) => m === mode) ?? "off-during-drag";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
      <h1 className="text-page text-ink pt-8 font-semibold">DnD spike: {resolved}</h1>
      <p className="text-body text-ink-muted pb-4">200 sortable cards. WP 5.0 measurement page.</p>
      <Spike mode={resolved} />
    </div>
  );
}
