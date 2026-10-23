import {
  ArchiveIcon,
  FolderIcon,
  ImageIcon,
  LayoutGridIcon,
  MousePointerClickIcon,
  PanelRightIcon,
  SparklesIcon,
  UploadIcon,
  type LucideIcon,
} from "lucide-react";
import { Aurora, AuroraGlow } from "@/components/brand";
import { KindIcon } from "@/components/kind-icon";
import { getT } from "@/i18n/server";
import type { Messages } from "@/i18n";
import type { ItemKind } from "@/types/supabase";
import { HeroActions } from "./app-entry";
import { InstallPrompt } from "./install-prompt";
import { SwRegister } from "./sw-register";

const sectionClass = "border-line relative z-10 w-full scroll-mt-4 border-t";
const innerClass = "relative mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 md:py-24";
const eyebrowClass = "text-meta text-ink-subtle font-medium tracking-wide uppercase";
const titleClass =
  "font-heading tracking-heading text-ink text-page mt-2 font-semibold text-balance sm:text-[length:2.25rem] sm:leading-[1.15]";
const leadClass = "text-body text-ink-muted mt-4 max-w-[56ch] text-pretty";

function IconTile({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div
      aria-hidden="true"
      className="rounded-control border-line bg-surface text-ink flex size-10 shrink-0 items-center justify-center border"
    >
      <Icon className="size-[18px]" />
    </div>
  );
}

const FORMAT_KINDS = [
  "link",
  "article",
  "video",
  "image",
  "pdf",
  "document",
  "note",
  "code",
] as const satisfies readonly ItemKind[];

const FEATURE_ICONS: { key: FeatureKey; icon: LucideIcon }[] = [
  { key: "capture", icon: UploadIcon },
  { key: "previews", icon: ImageIcon },
  { key: "collections", icon: FolderIcon },
  { key: "smartViews", icon: SparklesIcon },
  { key: "drag", icon: MousePointerClickIcon },
  { key: "layouts", icon: LayoutGridIcon },
  { key: "drawer", icon: PanelRightIcon },
  { key: "safety", icon: ArchiveIcon },
];

type FeatureKey = keyof Messages["marketing"]["features"]["items"];

/** "Install the app": steps per platform plus the install button where the browser offers one. */
export async function InstallApp() {
  const { install } = (await getT()).marketing;
  return (
    <section id="install" aria-labelledby="install-title" className={sectionClass}>
      <div className={innerClass}>
        <header>
          <p className={eyebrowClass}>{install.eyebrow}</p>
          <h2 id="install-title" className={titleClass}>
            {install.title}
          </h2>
          <p className={leadClass}>{install.lead}</p>
        </header>
        <InstallPrompt />
        <SwRegister />
      </div>
    </section>
  );
}

/** What the app does: automatic formats first, then the feature grid. */
export async function Features() {
  const { features } = (await getT()).marketing;
  return (
    <section id="features" aria-labelledby="features-title" className={sectionClass}>
      <AuroraGlow tone="violet" className="top-10 -right-40 h-[26rem] w-[36rem]" />
      <AuroraGlow tone="pink" className="bottom-0 -left-48 h-[22rem] w-[30rem] opacity-25" />
      <div className={innerClass}>
        <header>
          <p className={eyebrowClass}>{features.eyebrow}</p>
          <h2 id="features-title" className={titleClass}>
            {features.title}
          </h2>
          <p className={leadClass}>{features.lead}</p>
        </header>

        <div className="mt-10">
          <h3 className="text-card text-ink font-medium">{features.formatsTitle}</h3>
          <ul aria-label={features.formatsLabel} className="mt-4 flex flex-wrap gap-2">
            {FORMAT_KINDS.map((kind) => (
              <li
                key={kind}
                className="bg-surface border-line text-body text-ink-muted inline-flex h-9 items-center gap-2 rounded-full border px-3.5"
              >
                <KindIcon kind={kind} className="text-ink size-4" />
                {features.formats[kind]}
              </li>
            ))}
          </ul>
        </div>

        <ul className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURE_ICONS.map(({ key, icon }) => {
            const { title, body } = features.items[key];
            return (
              <li key={key} className="flex flex-col gap-4">
                <IconTile icon={icon} />
                <div className="flex flex-col gap-1">
                  <h3 className="text-card text-ink font-medium">{title}</h3>
                  <p className="text-body text-ink-muted text-pretty">{body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/** Guest mode: what trying without an account means. */
export async function GuestMode() {
  const { guest } = (await getT()).marketing;
  return (
    <section id="guest" aria-labelledby="guest-title" className={sectionClass}>
      <AuroraGlow tone="coral" className="top-16 -left-48 h-[22rem] w-[36rem]" />
      <div className={`${innerClass} grid gap-10 md:grid-cols-[1fr_1.2fr] md:gap-16`}>
        <header>
          <p className={eyebrowClass}>{guest.eyebrow}</p>
          <h2 id="guest-title" className={titleClass}>
            {guest.title}
          </h2>
          <p className={leadClass}>{guest.lead}</p>
        </header>
        <dl className="divide-line border-line divide-y border-y">
          {guest.facts.map(({ term, detail }) => (
            <div key={term} className="grid gap-1 py-5 sm:grid-cols-[10rem_1fr] sm:gap-6">
              <dt className="text-card text-ink font-medium">{term}</dt>
              <dd className="text-body text-ink-muted text-pretty">{detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

export async function Faq() {
  const { faq } = (await getT()).marketing;
  return (
    <section id="faq" aria-labelledby="faq-title" className={sectionClass}>
      <AuroraGlow tone="blue" className="top-24 -right-48 h-[24rem] w-[32rem] opacity-25" />
      <div className={`${innerClass} grid gap-10 md:grid-cols-[1fr_1.6fr] md:gap-16`}>
        <header>
          <p className={eyebrowClass}>{faq.eyebrow}</p>
          <h2 id="faq-title" className={titleClass}>
            {faq.title}
          </h2>
        </header>
        <dl className="divide-line border-line divide-y border-y">
          {faq.items.map(({ question, answer }) => (
            <div key={question} className="flex flex-col gap-2 py-6">
              <dt className="text-card text-ink font-medium">{question}</dt>
              <dd className="text-body text-ink-muted max-w-[60ch] text-pretty">{answer}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/** Last call to action before the footer. */
export async function ClosingCta() {
  const { cta } = (await getT()).marketing;
  return (
    <section aria-labelledby="cta-title" className={`${sectionClass} overflow-hidden`}>
      <Aurora variant="subtle" className="h-[min(36vh,320px)]" />
      <div className={`${innerClass} flex flex-col items-center pb-28 text-center md:pb-40`}>
        <h2 id="cta-title" className={titleClass}>
          {cta.title}
        </h2>
        <p className={`${leadClass} mx-auto`}>{cta.lead}</p>
        <HeroActions className="justify-center" />
      </div>
    </section>
  );
}
