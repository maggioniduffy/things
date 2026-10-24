import { Caption, Group, Section } from "./section";
import { TokenValue } from "./token-value";

const RADII = [
  { token: "control", className: "rounded-control", use: "Buttons, inputs, icon buttons" },
  { token: "card", className: "rounded-card", use: "Item cards, drawer, dialog" },
] as const;

/** Derived from `--radius` (= control); what shadcn components use for their inner corners. */
const DERIVED_RADII = [
  { token: "sm", className: "rounded-sm", use: "Menu rows" },
  { token: "md", className: "rounded-md", use: "Between sm and lg" },
  { token: "lg", className: "rounded-lg", use: "Equals control" },
  { token: "xl", className: "rounded-xl", use: "Control plus 4px" },
] as const;

const SHADOWS = [
  { token: "card", className: "shadow-card" },
  { token: "card-hover", className: "shadow-card-hover" },
] as const;

/** Each demo bar grows on hover of its row; the transition itself uses the token under test. */
const MOTION = [
  { token: "duration-fast", className: "duration-(--duration-fast)" },
  { token: "duration-base", className: "duration-(--duration-base)" },
  { token: "duration-slow", className: "duration-(--duration-slow)" },
] as const;

export function ShapeMotionSection() {
  return (
    <Section
      id="shape-motion"
      title="Radii, shadows and motion"
      description="Hover a motion row to play it. All transitions drop to near zero under prefers-reduced-motion."
    >
      <Group title="Radii" className="items-start gap-6">
        {RADII.map((radius) => (
          <div key={radius.token} className="flex w-40 flex-col gap-2">
            <div className={`${radius.className} border-line bg-surface h-20 border`} />
            <div className="flex flex-col">
              <span className="text-meta text-ink font-medium">--radius-{radius.token}</span>
              <TokenValue name={`--radius-${radius.token}`} />
              <Caption>{radius.use}</Caption>
            </div>
          </div>
        ))}
      </Group>
      <Group title="Derived radii" className="items-start gap-6">
        {DERIVED_RADII.map((radius) => (
          <div key={radius.token} className="flex w-40 flex-col gap-2">
            <div className={`${radius.className} border-line bg-surface h-20 border`} />
            <div className="flex flex-col">
              <span className="text-meta text-ink font-medium">--radius-{radius.token}</span>
              <TokenValue name={`--radius-${radius.token}`} />
              <Caption>{radius.use}</Caption>
            </div>
          </div>
        ))}
      </Group>
      <Group title="Shadows" className="items-start gap-6">
        {SHADOWS.map((shadow) => (
          <div key={shadow.token} className="flex w-40 flex-col gap-2">
            <div className={`${shadow.className} rounded-card bg-surface h-20`} />
            <span className="text-meta text-ink font-medium">--shadow-{shadow.token}</span>
          </div>
        ))}
      </Group>
      <Group title="Motion" className="block">
        <ul className="flex flex-col gap-3">
          {MOTION.map((motion) => (
            <li
              key={motion.token}
              className="group border-line rounded-card bg-surface/50 flex flex-col gap-2 border p-4"
            >
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-meta text-ink font-medium">--{motion.token}</span>
                <TokenValue name={`--${motion.token}`} />
              </div>
              <div className="bg-line rounded-control relative h-8 overflow-hidden">
                <div
                  className={`${motion.className} ease-out-soft rounded-control bg-ink absolute inset-1 origin-left scale-x-[0.08] transition-transform group-hover:scale-x-100`}
                />
              </div>
            </li>
          ))}
          <li>
            <span className="text-meta text-ink font-medium">--ease-out-soft</span>{" "}
            <TokenValue name="--ease-out-soft" />
          </li>
        </ul>
      </Group>
    </Section>
  );
}
