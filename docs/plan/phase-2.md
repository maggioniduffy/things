# Phase 2 — App shell and data layer

Shared rules, loop and status: [README.md](README.md). UI: [design.md](design.md).

## Build

- Sidebar (system views, formats with counts, collections, tags), toolbar with grid/list/canvas toggle (canvas disabled until Phase 6), `[[...view]]` routing, Zustand UI store, TanStack Query provider with hydration.
- Empty states with the aurora.
- **Done when:** navigating between views changes the query without a full reload; sidebar counts match the DB.

## Spec

The app is one screen: a sidebar of categories, a toolbar, and a grid of cards that accepts drops anywhere. Every save lands instantly as an optimistic card and enriches in place (title, image, thumbnail) a moment later.

**Layout**

- **Sidebar (260px, collapsible):** wordmark · Inbox (no collection) · All · Unread · Favorites · *Formats* (only kinds that have items, with counts: Links, Articles, Videos, Images, PDFs, Documents, Notes, Code) · *Collections* (user topics, emoji + color, drop targets) · *Tags* · *Smart views* · Archive · Trash.
- **Toolbar:** search field (/), filter chips (kind, tag, domain, status), sort (manual, newest, oldest, title), view toggle (grid / list / canvas), "+ Add" primary button.
- **Main:** responsive card grid (auto-fill, min 240px). List view = dense rows with hairline dividers. Canvas view = an infinite board per collection (Phase 6).
- **Detail drawer** (right side, `?item=<id>` in the URL so it is linkable): large preview, editable title and note, collection, tags, source link, metadata, actions.

**Dynamic categories**

| Category | How it's built | Editable by user |
| --- | --- | --- |
| Format | Derived from MIME type and URL on save (`kind` column) | Override per item |
| Collection | One home per item (folder-like), `collection_id`; null = Inbox | Yes, CRUD + reorder |
| Tags | Many-to-many, created inline by typing `#tag` | Yes |
| Domain | Derived from URL host (`youtube.com`, `github.com`) | No — a filter chip |
| Smart view | Saved filter rules in JSON (e.g. unread PDFs tagged #thesis) | Yes |

## Key flows

**Optimistic mutations (TanStack Query)** — every mutation runs `onMutate` (snapshot + patch cache) → `onError` (rollback + toast) → `onSettled` (invalidate the affected list and counts). Undo toasts call the inverse mutation.

## Work packages

| WP | Who | Task | Key acceptance |
| --- | --- | --- | --- |
| 2.1 | B | `QueryProvider` (+ hydration), `stores/ui-store.ts` (selection, view mode, filters, palette, drag), `lib/views.ts`: `[[...view]]` params → `ViewSpec` (pure, unit-tested) | Unit tests for every route in the routes table |
| 2.2 | B | `lib/items/queries.ts`: list by `ViewSpec` (keyset pagination, 50/page, sort modes), counts from `item_counts`; server prefetch of page 1 + `HydrationBoundary` | Unit tests on query builder; no client waterfall on first load |
| 2.3 | B | `app/app/layout.tsx` shell; Sidebar (system views, formats with counts only when > 0, collections, tags, smart views), Toolbar (search placeholder, sort, grid/list/canvas toggle with canvas disabled), empty states with aurora | Playwright: switching views keeps the same document (no full reload); counts match seeded DB |
| 2.G | R + O | Gate | Green |
