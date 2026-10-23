import Link from "next/link";
import { Aurora } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { getActiveMessages } from "@/i18n/active";
import { useT } from "@/i18n/client";
import { kindPluralLowercase } from "@/lib/kinds";
import type { ViewSpec } from "@/lib/views";

export type EmptyCopy = { heading: string; body: string | null };

/**
 * Copy for an empty view. `name` is the tag, collection or smart view name when known.
 * `unknown` means the collection, tag or smart view does not exist. Reads the active language.
 */
export function emptyCopy(view: ViewSpec, name?: string | null, unknown = false): EmptyCopy {
  const t = getActiveMessages().shell.empty;
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
            : t.kindHeading(kindPluralLowercase(view.kind)),
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
          <Link href="/app">{t.empty.goToInbox}</Link>
        </Button>
      ) : null}
    </div>
  );
}
