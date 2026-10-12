import { Aurora, Grain, Logo } from "@/components/brand";
import { Caption, Group, Section } from "./section";

const frame = "rounded-card border-line relative h-72 overflow-hidden border";

export function BrandSection() {
  return (
    <Section id="brand" title="Brand" description="Logo, film grain and the aurora hills.">
      <Group title="Logo" className="items-end gap-8">
        {[16, 24, 36, 48].map((size) => (
          <div key={size} className="flex flex-col gap-2">
            <Logo size={size} />
            <Caption>{size}px</Caption>
          </div>
        ))}
        <div className="flex flex-col gap-2">
          <Logo size={32} showWordmark={false} />
          <Caption>Mark only</Caption>
        </div>
      </Group>
      <Group title="Grain" className="block">
        <div className="bg-surface rounded-card border-line relative h-32 overflow-hidden border">
          <Grain className="absolute z-0" opacity={0.4} />
          <p className="text-meta text-ink-muted relative p-4">
            Grain at 40% on a swatch (the page-wide overlay is 8%).
          </p>
        </div>
      </Group>
      <Group title="Aurora" className="block">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <div className={frame}>
              <Aurora variant="hero" />
            </div>
            <Caption>variant=&quot;hero&quot;</Caption>
          </div>
          <div className="flex flex-col gap-2">
            <div className={frame}>
              <Aurora variant="subtle" />
            </div>
            <Caption>variant=&quot;subtle&quot;</Caption>
          </div>
          <div className="flex flex-col gap-2">
            <div className={frame}>
              <Aurora variant="hero" animated={false} />
            </div>
            <Caption>animated={"{false}"}</Caption>
          </div>
        </div>
      </Group>
    </Section>
  );
}
