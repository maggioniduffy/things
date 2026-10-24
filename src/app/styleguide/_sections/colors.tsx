import { Group, Section } from "./section";
import { TokenValue } from "./token-value";

type ColorGroup = { title: string; tokens: readonly string[] };

/** Every `--color-<name>` token in globals.css. Keep in sync when a token is added. */
export const COLOR_GROUPS: readonly ColorGroup[] = [
  {
    title: "Surfaces and ink",
    tokens: ["paper", "surface", "ink", "ink-muted", "ink-subtle", "line", "highlight"],
  },
  {
    title: "Aurora stops",
    tokens: [
      "aurora-pink",
      "aurora-violet",
      "aurora-blue",
      "aurora-red",
      "aurora-coral",
      "aurora-olive",
    ],
  },
  { title: "Focus", tokens: ["focus"] },
  {
    title: "Semantic aliases (shadcn)",
    tokens: [
      "background",
      "foreground",
      "card",
      "card-foreground",
      "popover",
      "popover-foreground",
      "primary",
      "primary-foreground",
      "secondary",
      "secondary-foreground",
      "muted",
      "muted-foreground",
      "accent",
      "accent-foreground",
      "destructive",
      "border",
      "input",
      "ring",
    ],
  },
];

function Swatch({ token }: { token: string }) {
  const name = `--color-${token}`;
  return (
    <li className="flex flex-col gap-2">
      <div
        className="rounded-control border-line h-16 w-full border"
        style={{ background: `var(${name})` }}
      />
      <div className="flex flex-col">
        <span className="text-meta text-ink font-medium">{name}</span>
        <TokenValue name={name} />
      </div>
    </li>
  );
}

export function ColorsSection() {
  return (
    <Section
      id="colors"
      title="Colors"
      description="Every color token from globals.css. Components use the generated utilities (bg-paper, text-ink-muted), never raw values."
    >
      {COLOR_GROUPS.map((group) => (
        <Group key={group.title} title={group.title} className="block">
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {group.tokens.map((token) => (
              <Swatch key={token} token={token} />
            ))}
          </ul>
        </Group>
      ))}
    </Section>
  );
}
