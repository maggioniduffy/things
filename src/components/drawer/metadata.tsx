import { formatBytes } from "@/components/cards/format-bytes";
import { useLocale, useT } from "@/i18n/client";
import { INTL_LOCALE, type Locale } from "@/i18n/config";
import type { Messages } from "@/i18n/messages";
import { kindSingularLabel } from "@/lib/kinds";
import type { BoardItem } from "@/lib/items/queries";
import { safeHttpUrl } from "./urls";


/** One line for where the item stands: trash, archive, capture state, then read state. */
export function itemStatusLabel(item: BoardItem, t: Messages["items"]["drawer"]): string {
  if (item.deleted_at) return t.statusInTrash;
  if (item.archived_at) return t.statusArchived;
  // Only links and files are enriched; a note is never "fetching".
  if (item.url || item.file_path) {
    if (item.enrich_status === "failed") {
      return item.file_path ? t.statusUploadFailed : t.statusFetchFailed;
    }
    if (item.enrich_status === "pending") return item.file_path ? t.statusUploading : t.statusFetching;
  }
  return item.is_read ? t.statusRead : t.statusUnread;
}

export function formatSavedDate(iso: string, locale: Locale, unknown: string): string {
  const time = Date.parse(iso);
  if (!Number.isFinite(time)) return unknown;
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(time);
}

type Row = { label: string; value: React.ReactNode };

export function ItemMetadata({ item }: { item: BoardItem }) {
  const t = useT().items.drawer;
  const locale = useLocale();
  const href = safeHttpUrl(item.url);
  const size = formatBytes(item.file_size);

  const rows: Row[] = [
    { label: t.kind, value: kindSingularLabel(item.kind) },
    { label: t.saved, value: formatSavedDate(item.created_at, locale, t.unknownDate) },
  ];
  if (item.url) {
    rows.push({
      label: t.source,
      value: href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink underline-offset-2 hover:underline"
        >
          {item.domain ?? item.url}
        </a>
      ) : (
        (item.domain ?? item.url)
      ),
    });
  }
  if (item.file_name) rows.push({ label: t.file, value: item.file_name });
  if (size) rows.push({ label: t.size, value: size });
  rows.push({ label: t.status, value: itemStatusLabel(item, t) });

  return (
    <dl className="text-meta grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-ink-subtle">{row.label}</dt>
          <dd className="text-ink-muted min-w-0 [overflow-wrap:anywhere]">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
