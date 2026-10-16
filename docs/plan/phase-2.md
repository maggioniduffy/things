# Phase 2 — App shell and data layer

Product spec for one phase. Shared context: [README.md](README.md) (always), [data-model.md](data-model.md) (schema work), [design.md](design.md) (UI work). How it is built: [../orchestration/phase-2.md](../orchestration/phase-2.md).

## Build

- Sidebar (system views, formats with counts, collections, tags), toolbar with grid/list/canvas toggle (canvas disabled until Phase 6), `[[...view]]` routing, Zustand UI store, TanStack Query provider with hydration.
- Empty states with the aurora.
- **Done when:** navigating between views changes the query without a full reload; sidebar counts match the DB.

## Spec

The app is one screen: a sidebar of categories, a toolbar, and a grid of cards that accepts drops anywhere. Every save lands instantly as an optimistic card and enriches in place (title, image, thumbnail) a moment later.

**Layout**

- **Sidebar (260px, collapsible):** wordmark · Inbox (no collection) · All · Unread · Favorites · *Formats* (only kinds that have items, with counts: Links, Articles, Videos, Images, PDFs, Documents, Notes, Code) · *Collections* (user topics, emoji + color, drop targets) · *Tags* · *Smart views* · Archive · Trash.
- **Toolbar:** search field (/), filter chips (kind, tag, domain, status), sort (manual, newest, oldest, title), view toggle (grid / list / canvas), "+ Add" primary button.
- **Main:** responsive card grid (auto-fill, min 240px). List view = dense rows with hairline dividers. Canvas view = an infinite board per collection (see Canvas).
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
