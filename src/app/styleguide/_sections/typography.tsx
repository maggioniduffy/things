import { Caption, Group, Section } from "./section";
import { TokenValue } from "./token-value";

/** Static class strings so Tailwind can see every utility. */
const SIZES = [
  { token: "meta", className: "text-meta", use: "Meta: domain, dates, counts" },
  { token: "body", className: "text-body", use: "Body and controls" },
  { token: "card", className: "text-card", use: "Card titles, column headers" },
  { token: "section", className: "text-section", use: "Section titles" },
  { token: "page", className: "text-page", use: "Page titles" },
] as const;

export function TypographySection() {
  return (
    <Section
      id="typography"
      title="Typography"
      description="Inter for UI, Inter Tight for headings and the wordmark with -0.02em tracking."
    >
      <Group title="Type scale" className="block">
        <ul className="border-line divide-line divide-y border-y">
          {SIZES.map((size) => (
            <li
              key={size.token}
              className="grid items-baseline gap-1 py-4 sm:grid-cols-[14rem_1fr] sm:gap-6"
            >
              <div className="flex flex-col">
                <span className="text-meta text-ink font-medium">--text-{size.token}</span>
                <TokenValue name={`--text-${size.token}`} />
              </div>
              <div className="flex flex-col gap-1">
                <span className={`${size.className} font-heading tracking-heading text-ink`}>
                  Save anything. Find it again.
                </span>
                <Caption>{size.use}</Caption>
              </div>
            </li>
          ))}
        </ul>
      </Group>
      <Group title="Heading font and sans" className="block">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <p className="font-heading tracking-heading text-ink text-[length:clamp(1.75rem,4vw,2.5rem)] leading-tight font-semibold">
              Heading font
            </p>
            <Caption>font-heading · Inter Tight · tracking-heading</Caption>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-ink font-sans text-[length:clamp(1.75rem,4vw,2.5rem)] leading-tight">
              Sans font
            </p>
            <Caption>font-sans · Inter · ss01, cv11</Caption>
          </div>
        </div>
      </Group>
      <Group title="Text colors and links" className="block">
        <div className="flex flex-col gap-2">
          <p className="text-body text-ink">Ink: headings and primary text.</p>
          <p className="text-body text-ink-muted">Ink muted: body copy and link lists.</p>
          <p className="text-meta text-ink-subtle">
            Ink subtle: meta text such as dates and counts.
          </p>
          <p className="text-body text-ink-muted">
            <a href="#typography" className="link-underline hover:text-ink">
              Footer-style link (1px underline, 3px offset)
            </a>
          </p>
        </div>
      </Group>
    </Section>
  );
}
