import { formatBytes } from "@/components/cards/format-bytes";
import { kindSingularLabel } from "@/lib/kinds";
import type { BoardItem } from "@/lib/items/queries";
import { safeHttpUrl } from "./urls";

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

/** One line for where the item stands: trash, archive, capture state, then read state. */
export function itemStatusLabel(item: BoardItem): string {
  if (item.deleted_at) return "In trash";
  if (item.archived_at) return "Archived";
  // Only links and files are enriched; a note is never "fetching".
  if (item.url || item.file_path) {
    if (item.enrich_status === "failed") {
      return item.file_path ? "Upload didn't finish" : "Couldn't fetch details";
    }
    if (item.enrich_status === "pending") return item.file_path ? "Uploading" : "Fetching details";
  }
  return item.is_read ? "Read" : "Unread";
}

export function formatSavedDate(iso: string): string {
  const time = Date.parse(iso);
  return Number.isFinite(time) ? DATE_FORMAT.format(time) : "Unknown";
}

type Row = { label: string; value: React.ReactNode };

export function ItemMetadata({ item }: { item: BoardItem }) {
  const href = safeHttpUrl(item.url);
  const size = formatBytes(item.file_size);

  const rows: Row[] = [
    { label: "Kind", value: kindSingularLabel(item.kind) },
    { label: "Saved", value: formatSavedDate(item.created_at) },
  ];
  if (item.url) {
    rows.push({
      label: "Source",
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
  if (item.file_name) rows.push({ label: "File", value: item.file_name });
  if (size) rows.push({ label: "Size", value: size });
  rows.push({ label: "Status", value: itemStatusLabel(item) });

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
