import { KindIcon } from "@/components/kind-icon";
import { Badge } from "@/components/ui/badge";
import { kindSingularLabel } from "@/lib/kinds";
import type { BoardItem } from "@/lib/items/queries";

export type ItemTileVariant = "grid" | "list";

export function itemDisplayTitle(item: BoardItem): string {
  return item.title || item.url || item.file_name || "Untitled";
}

/**
 * Placeholder for the Phase 4 cards: title, kind and domain only, no links or drawer yet.
 * Renders an `<li>`, so it must sit inside a `<ul>`.
 */
export function ItemTile({ item, variant }: { item: BoardItem; variant: ItemTileVariant }) {
  const title = itemDisplayTitle(item);

  if (variant === "list") {
    return (
      <li
        data-slot="item-row"
        data-item-id={item.id}
        className="border-line flex min-h-12 items-center gap-3 border-b py-2.5"
      >
        <KindIcon kind={item.kind} className="text-ink-subtle size-4 shrink-0" />
        <span className="text-body text-ink min-w-0 flex-1 truncate">{title}</span>
        {item.domain ? (
          <span className="text-meta text-ink-subtle hidden max-w-48 truncate sm:inline">
            {item.domain}
          </span>
        ) : null}
        <Badge>{kindSingularLabel(item.kind)}</Badge>
      </li>
    );
  }

  return (
    <li
      data-slot="item-tile"
      data-item-id={item.id}
      className="rounded-card border-line bg-surface shadow-card flex min-h-32 flex-col gap-2 border p-4 backdrop-blur-md"
    >
      <Badge>{kindSingularLabel(item.kind)}</Badge>
      <p className="text-card text-ink line-clamp-3 font-medium [overflow-wrap:anywhere]">
        {title}
      </p>
      {item.domain ? (
        <p className="text-meta text-ink-subtle mt-auto truncate">{item.domain}</p>
      ) : null}
    </li>
  );
}
