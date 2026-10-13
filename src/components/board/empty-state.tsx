import Link from "next/link";
import { Aurora } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { kindPluralLowercase } from "@/lib/kinds";
import type { ViewSpec } from "@/lib/views";

export type EmptyCopy = { heading: string; body: string | null };

const SAVED_LINE = "Links, files and notes you save will land here.";

/**
 * Copy for an empty view. `name` is the tag, collection or smart view name when known.
 * `unknown` means the collection, tag or smart view does not exist.
 */
export function emptyCopy(view: ViewSpec, name?: string | null, unknown = false): EmptyCopy {
  if (unknown) return { heading: "This page doesn't exist.", body: null };

  switch (view.type) {
    case "inbox":
      return { heading: "Drop anything here.", body: SAVED_LINE };
    case "all":
      return { heading: "Nothing saved yet.", body: SAVED_LINE };
    case "unread":
      return {
        heading: "You're all caught up.",
        body: "Things you haven't opened yet show up here.",
      };
    case "favorites":
      return { heading: "No favorites yet.", body: "Star the things you want to keep close." };
    case "archive":
      return {
        heading: "Nothing archived.",
        body: "Archive things you're done with to keep your inbox calm.",
      };
    case "trash":
      return { heading: "Trash is empty.", body: "Things in Trash are deleted after 30 days." };
    case "kind":
      return {
        // "Other" would read as "No other yet."
        heading:
          view.kind === "other"
            ? "No other things yet."
            : `No ${kindPluralLowercase(view.kind)} yet.`,
        body: "They'll show up here once you save some.",
      };
    case "collection":
      return {
        heading: "This collection is empty.",
        body: "Things you file here will show up here.",
      };
    case "tag":
      return {
        heading: `Nothing tagged #${name ?? "this tag"} yet.`,
        body: "Add the tag to a thing and it will show up here.",
      };
    case "smart":
      return {
        heading: "Nothing matches yet.",
        body: "Things that match this smart view's rules will show up here.",
      };
  }
}

export function EmptyState({
  view,
  name,
  unknown = false,
}: {
  view: ViewSpec;
  name?: string | null;
  unknown?: boolean;
}) {
  const { heading, body } = emptyCopy(view, name, unknown);

  return (
    <div
      data-slot="empty-state"
      className="relative flex flex-1 flex-col items-center justify-center gap-2 overflow-hidden px-4 py-16 text-center"
    >
      <Aurora variant="subtle" />
      <h2 className="font-heading text-page tracking-heading relative">{heading}</h2>
      {body ? <p className="text-body text-ink-muted relative">{body}</p> : null}
      {unknown ? (
        <Button asChild variant="secondary" className="relative mt-2">
          <Link href="/app">Go to Inbox</Link>
        </Button>
      ) : null}
    </div>
  );
}
