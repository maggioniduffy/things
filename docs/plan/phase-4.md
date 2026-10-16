# Phase 4 — Browse

Product spec for one phase. Shared context: [README.md](README.md) (always), [data-model.md](data-model.md) (schema work), [design.md](design.md) (UI work). How it is built: [../orchestration/phase-4.md](../orchestration/phase-4.md).

## Build

- Card variant per kind, grid and list views, detail drawer with previews (image lightbox, PDF iframe, video embed, link card, note editor).
- Read/favorite/archive/trash with undo; Trash purge after 30 days.
- **Done when:** every kind renders correctly in both views and the drawer; `?item=` links survive a reload.

## Spec

**Item states:** unread → read (on open), favorite toggle, archive, soft delete to Trash (30-day purge), every destructive action with an Undo toast.
