# Phase 4 — Browse

Shared rules, loop and status: [README.md](README.md). UI: [design.md](design.md). Spec-review items (#N) are in [archive.md](archive.md).

## Build

- Card variant per kind, grid and list views, detail drawer with previews (image lightbox, PDF iframe, video embed, link card, note editor).
- Read/favorite/archive/trash with undo; Trash purge after 30 days.
- **Done when:** every kind renders correctly in both views and the drawer; `?item=` links survive a reload.

## Spec

**Item states:** unread → read (on open), favorite toggle, archive, soft delete to Trash (30-day purge), every destructive action with an Undo toast.

## Work packages

| WP | Who | Task | Key acceptance |
| --- | --- | --- | --- |
| 4.1 | B | `cards/` per kind (Link, Video, Image, Pdf, Note, File) + `ItemGrid`, `ItemList` | Styleguide section lists every card state (pending, done, failed) |
| 4.2 | B | `ItemDrawer` via `?item=`: previews (image lightbox, PDF iframe from signed URL, video embed, link card, note editor), editable title/note/collection/tags, metadata, actions | `?item=` survives reload (Playwright) |
| 4.3 | B | State mutations: read on open, favorite, archive, trash with Undo toast (inverse mutation) | Optimistic + rollback tests |
| 4.4 | B | `/api/cron/daily` (#7): purge trash ≥ 30 days (storage first, then rows), `CRON_SECRET` bearer check; `vercel.json` cron | Route test: 401 without secret; purges only old trashed rows |
| 4.G | R + O | Gate: every kind in grid, list and drawer | Green |
