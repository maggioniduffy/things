# Phase 5 — Organize and drag-and-drop

Shared rules, loop and status: [README.md](README.md). Spec-review items (#N) are in [archive.md](archive.md).

## Build

- Collections and tags CRUD; dnd-kit sortable grid/list with fractional ordering; drag (and multi-drag) to sidebar targets; sidebar reordering; smart views builder.
- **Done when:** reorder persists after reload with a single-row update; dropping 5 selected cards on a collection moves all 5 with one optimistic update; keyboard DnD works.

## Spec

**Drag-and-drop (dnd-kit)**

- Reorder cards in manual sort (grid and list) — persisted with fractional indexing.
- Drag one card or a multi-selection (⌘/Shift-click) onto a collection, a tag, Favorites, Archive or Trash in the sidebar.
- Reorder collections and smart views in the sidebar.
- External drops (files/URLs) use native HTML5 events, separate from dnd-kit, so the two never fight.
- Keyboard DnD via dnd-kit's keyboard sensor for accessibility.

## Data model

**Smart-view rules (zod schema, also used for toolbar filters)**

```ts
const Rules = z.object({
  kinds: z.array(ItemKind).optional(),
  collectionIds: z.array(z.string().uuid()).optional(),
  tagIds: z.array(z.string().uuid()).optional(),   // match all
  domains: z.array(z.string()).optional(),
  isRead: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
  savedWithinDays: z.number().int().positive().optional(),
  query: z.string().optional(),                    // full-text
});
```

## Key flows

**Ordering**

- New items get a key before the current first item (newest on top in manual sort).
- On drop, compute `generateKeyBetween(prev.position, next.position)` and update only the moved row; multi-select moves use `generateNKeysBetween`.
- Sort modes other than manual are pure queries and don't touch `position`; dragging is disabled outside manual sort.

## Work packages

| WP | Who | Task | Key acceptance |
| --- | --- | --- | --- |
| 5.0 | B | **Spike** (#8): 200 sortable cards with Motion `layout` disabled during drag; measure; Opus decides pattern | Pattern recorded in research-notes |
| 5.1 | B | Collections CRUD (emoji, aurora color) + tags CRUD; inline `#tag` parsing in title/note inputs | Optimistic CRUD tests |
| 5.2 | B | `lib/order.ts` (fractional-indexing wrappers) + sortable grid/list (manual sort only), `DragOverlay`, keyboard sensor | Reorder = one-row update (assert request count); persists after reload |
| 5.3 | B | Multi-select (⌘/Shift-click; later a Select mode with a selection bar, see CHANGELOG) + drag one/many to sidebar targets (collection, tag, Favorites, Archive, Trash); one optimistic batch mutation | 5 cards → collection in one mutation |
| 5.4 | B | Sidebar reorder (collections, smart views); smart-view builder: zod `Rules` → `lib/filters.ts` → query (unit-tested) | Rules round-trip tests |
| 5.G | R + O | Gate incl. keyboard DnD | Green |
