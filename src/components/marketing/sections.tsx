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
import type { ItemKind } from "@/types/supabase";
import { HeroActions } from "./app-entry";

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

const FORMATS: { kind: ItemKind; label: string }[] = [
  { kind: "link", label: "Links" },
  { kind: "article", label: "Articles" },
  { kind: "video", label: "Videos" },
  { kind: "image", label: "Images" },
  { kind: "pdf", label: "PDFs" },
  { kind: "document", label: "Documents" },
  { kind: "note", label: "Notes" },
  { kind: "code", label: "Code" },
];

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: UploadIcon,
    title: "Capture from anywhere",
    body: "Paste on the board, drag files and links in from your desktop or another tab, or use quick add. Up to 20 things save in one go.",
  },
  {
    icon: ImageIcon,
    title: "Rich previews",
    body: "Links unfurl into cards with a title, description, image and site name. Images, PDFs and videos get a thumbnail.",
  },
  {
    icon: FolderIcon,
    title: "Collections and tags",
    body: "Give an item one home in a collection with its own emoji and color, and as many tags as you like. Type #tag in a title or note to add one.",
  },
  {
    icon: SparklesIcon,
    title: "Smart views",
    body: "Save a filter, like unread PDFs tagged #thesis, and it stays in the sidebar, always up to date.",
  },
  {
    icon: MousePointerClickIcon,
    title: "Drag to organize",
    body: "Reorder cards by hand, or drag one card or a whole selection onto a collection, a tag, Favorites, Archive or Trash. Works with the keyboard too.",
  },
  {
    icon: LayoutGridIcon,
    title: "Grid, list or canvas",
    body: "Browse as cards or dense rows, or lay a collection out on its own infinite canvas, where things stay where you put them.",
  },
  {
    icon: PanelRightIcon,
    title: "Details in a drawer",
    body: "Open any item for a large preview, an editable title and note, its tags and source. Every drawer has its own link.",
  },
  {
    icon: ArchiveIcon,
    title: "Nothing lost by accident",
    body: "Mark things read, favorite or archive them. Deleted items wait in Trash for 30 days, and every destructive action can be undone.",
  },
];

/** What Thingteca does: automatic formats first, then the feature grid. */
export function Features() {
  return (
    <section id="features" aria-labelledby="features-title" className={sectionClass}>
      <AuroraGlow tone="violet" className="top-10 -right-40 h-[26rem] w-[36rem]" />
      <AuroraGlow tone="pink" className="bottom-0 -left-48 h-[22rem] w-[30rem] opacity-25" />
      <div className={innerClass}>
        <header>
          <p className={eyebrowClass}>Features</p>
          <h2 id="features-title" className={titleClass}>
            Organized before you think about it
          </h2>
          <p className={leadClass}>
            Thingteca looks at every save and files it by format, so your board already makes sense.
            Collections, tags and smart views are there when you want more.
          </p>
        </header>

        <div className="mt-10">
          <h3 className="text-card text-ink font-medium">Sorted by format, automatically</h3>
          <ul aria-label="Formats" className="mt-4 flex flex-wrap gap-2">
            {FORMATS.map(({ kind, label }) => (
              <li
                key={kind}
                className="bg-surface border-line text-body text-ink-muted inline-flex h-9 items-center gap-2 rounded-full border px-3.5"
              >
                <KindIcon kind={kind} className="text-ink size-4" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <ul className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon, title, body }) => (
            <li key={title} className="flex flex-col gap-4">
              <IconTile icon={icon} />
              <div className="flex flex-col gap-1">
                <h3 className="text-card text-ink font-medium">{title}</h3>
                <p className="text-body text-ink-muted text-pretty">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const GUEST_FACTS: { term: string; detail: string }[] = [
  { term: "No sign-up", detail: "Start saving straight away. No email, no password." },
  {
    term: "Same app",
    detail: "Guests get every feature, with files up to 10 MB each and 25 MB in total.",
  },
  {
    term: "Keep it all",
    detail: "Add your email later and everything you saved stays right where it is.",
  },
];

/** Guest mode: what trying without an account means. */
export function GuestMode() {
  return (
    <section id="guest" aria-labelledby="guest-title" className={sectionClass}>
      <AuroraGlow tone="coral" className="top-16 -left-48 h-[22rem] w-[36rem]" />
      <div className={`${innerClass} grid gap-10 md:grid-cols-[1fr_1.2fr] md:gap-16`}>
        <header>
          <p className={eyebrowClass}>Guest mode</p>
          <h2 id="guest-title" className={titleClass}>
            Try it without an account
          </h2>
          <p className={leadClass}>
            One click gives you a private board. Make an account only once Thingteca has earned it.
          </p>
        </header>
        <dl className="divide-line border-line divide-y border-y">
          {GUEST_FACTS.map(({ term, detail }) => (
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

const FAQS: { question: string; answer: string }[] = [
  {
    question: "What can I save?",
    answer:
      "Links, articles, videos, images, PDFs, documents, code and plain-text notes. Anything else is kept as a file.",
  },
  {
    question: "Do I need to organize as I go?",
    answer:
      "No. New saves go to your Inbox and are already grouped by format. Move them into collections or tag them whenever it suits you.",
  },
  {
    question: "Who can see my things?",
    answer:
      "Only you. Each account is for one person, and every item and file is private to the account that saved it.",
  },
  {
    question: "How big can files be?",
    answer:
      "Up to 50 MB per file with an account. Guests can upload files up to 10 MB each and 25 MB in total.",
  },
  {
    question: "What happens to my guest things when I sign up?",
    answer:
      "Nothing moves. Adding your email turns your guest board into a full account, with every item in place.",
  },
  {
    question: "How do I sign in?",
    answer: "With a 6-digit code sent to your email. There is no password to remember.",
  },
];

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className={sectionClass}>
      <AuroraGlow tone="blue" className="top-24 -right-48 h-[24rem] w-[32rem] opacity-25" />
      <div className={`${innerClass} grid gap-10 md:grid-cols-[1fr_1.6fr] md:gap-16`}>
        <header>
          <p className={eyebrowClass}>FAQ</p>
          <h2 id="faq-title" className={titleClass}>
            Questions, answered
          </h2>
        </header>
        <dl className="divide-line border-line divide-y border-y">
          {FAQS.map(({ question, answer }) => (
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
export function ClosingCta() {
  return (
    <section aria-labelledby="cta-title" className={`${sectionClass} overflow-hidden`}>
      <Aurora variant="subtle" className="h-[min(36vh,320px)]" />
      <div className={`${innerClass} flex flex-col items-center pb-28 text-center md:pb-40`}>
        <h2 id="cta-title" className={titleClass}>
          Your next save is one paste away
        </h2>
        <p className={`${leadClass} mx-auto`}>
          Start as a guest, and keep everything when you sign up.
        </p>
        <HeroActions className="justify-center" />
      </div>
    </section>
  );
}
