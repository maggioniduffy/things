import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CanvasDemo } from "./_demo";

export const metadata: Metadata = {
  title: "Canvas demo",
  robots: { index: false },
};

// Read STYLEGUIDE at request time, not at build time.
export const dynamic = "force-dynamic";

const DEFAULT_COUNT = 300;
const MAX_COUNT = 2000;

export default async function CanvasDemoPage({
  searchParams,
}: {
  searchParams: Promise<{ count?: string }>;
}) {
  // Dev-only. `STYLEGUIDE=1` opens it in a production build.
  if (process.env.NODE_ENV === "production" && process.env.STYLEGUIDE !== "1") notFound();

  const { count } = await searchParams;
  const parsed = Number.parseInt(count ?? "", 10);
  const total = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), MAX_COUNT) : DEFAULT_COUNT;

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="text-section text-ink px-4 py-4 font-semibold sm:px-6">
        Canvas demo: {total} items
      </h1>
      <CanvasDemo count={total} />
    </div>
  );
}
