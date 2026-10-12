import { cn } from "@/lib/utils";

/** Titled block of the styleguide. `id` is the in-page anchor used by the sticky nav. */
export function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-20 py-10">
      <div className="mb-6 flex flex-col gap-1">
        <h2 id={`${id}-title`} className="text-page text-ink font-semibold">
          {title}
        </h2>
        {description ? (
          <p className="text-body text-ink-muted max-w-[60ch]">{description}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-8">{children}</div>
    </section>
  );
}

/** Small labelled group inside a section. */
export function Group({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-card text-ink font-medium">{title}</h3>
      <div className={cn("flex flex-wrap items-center gap-3", className)}>{children}</div>
    </div>
  );
}

/** Monospace-free caption for token names. */
export function Caption({ children }: { children: React.ReactNode }) {
  return <span className="text-meta text-ink-subtle">{children}</span>;
}
