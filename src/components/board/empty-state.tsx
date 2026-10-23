import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { Aurora } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/client";
import type { Messages } from "@/i18n/messages";
import { kindPluralLowercase } from "@/lib/kinds";
import type { ViewSpec } from "@/lib/views";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";

export type EmptyCopy = { heading: string; body: string | null };

/**
 * Copy for an empty view. `name` is the tag, collection or smart view name when known.
 * `unknown` means the collection, tag or smart view does not exist.
 */
export function emptyCopy(
  view: ViewSpec,
  shell: Messages["shell"],
  name?: string | null,
  unknown = false,
): EmptyCopy {
  const t = shell.empty;
  if (unknown) return { heading: t.unknown, body: null };

  switch (view.type) {
    case "inbox":
      return { heading: t.inboxHeading, body: t.saved };
    case "all":
      return { heading: t.allHeading, body: t.saved };
    case "unread":
      return { heading: t.unreadHeading, body: t.unreadBody };
    case "favorites":
      return { heading: t.favoritesHeading, body: t.favoritesBody };
    case "archive":
      return { heading: t.archiveHeading, body: t.archiveBody };
    case "trash":
      return { heading: t.trashHeading, body: t.trashBody };
    case "kind":
      return {
        // "Other" would read as "No other yet."
        heading:
          view.kind === "other"
            ? t.kindOtherHeading
            : t.kindHeading(kindPluralLowercase(shell.kinds, view.kind)),
        body: t.kindBody,
      };
    case "collection":
      return { heading: t.collectionHeading, body: t.collectionBody };
    case "tag":
      return { heading: t.tagHeading(name ?? t.thisTag), body: t.tagBody };
    case "smart":
      return { heading: t.smartHeading, body: t.smartBody };
  }
}

/** Views where adding a thing makes sense and the new thing would show up. */
function canAddHere(view: ViewSpec): boolean {
  switch (view.type) {
    case "inbox":
    case "all":
    case "collection":
    case "unread":
    case "kind":
    case "tag":
      return true;
    default:
      return false;
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
  const t = useT().shell;
  const { heading, body } = emptyCopy(view, t, name, unknown);
  const setQuickAddOpen = useUiStore((state) => state.setQuickAddOpen);
  const showAdd = !unknown && canAddHere(view);
  // The collection comes from the view itself; a tag view hands its tag over.
  const defaults = view.type === "tag" && name ? { tagNames: [name] } : undefined;

  return (
    <div
      data-slot="empty-state"
      className="relative flex flex-1 flex-col items-center justify-center gap-2 overflow-hidden px-4 py-16 text-center"
    >
      <Aurora variant="subtle" />
      <h2 className="font-heading text-page tracking-heading relative">{heading}</h2>
      {body ? <p className="text-body text-ink-muted relative">{body}</p> : null}
      {showAdd ? (
        // Dropping files on it needs no handler: the window-level external drop zone takes them.
        <button
          type="button"
          data-slot="empty-add"
          onClick={() => setQuickAddOpen(true, defaults)}
          className={cn(
            "rounded-card border-line text-ink-muted relative mt-4 flex w-full max-w-xs flex-col items-center gap-2 border-2 border-dashed px-6 py-8",
            "ease-out-soft hover:border-ink/40 hover:text-ink transition-[color,border-color,transform] duration-(--duration-fast)",
            "motion-safe:hover:-translate-y-0.5",
            "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-2",
          )}
        >
          <PlusIcon className="size-6" aria-hidden="true" />
          <span className="text-ink text-body font-medium">{t.empty.addSomething}</span>
          <span className="text-meta">{t.empty.addHint}</span>
        </button>
      ) : null}
      {unknown ? (
        <Button asChild variant="secondary" className="relative mt-2">
          <Link href="/app">{t.empty.goToInbox}</Link>
        </Button>
      ) : null}
    </div>
  );
}
