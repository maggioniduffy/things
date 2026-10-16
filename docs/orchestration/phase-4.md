# Phase 4 — Browse

Work packages for one phase. Read [README.md](README.md) first (roles, loop, brief template, status). The product spec for this phase: [../plan/phase-4.md](../plan/phase-4.md).

Legend: **S** = scout (Haiku) · **B** = builder (Sonnet) · **R** = reviewer (Opus) · **O** = orchestrator (Opus) · ∥ = may run in parallel with the previous WP.

| WP | Who | Task | Key acceptance |
| --- | --- | --- | --- |
| 4.1 | B | `cards/` per kind (Link, Video, Image, Pdf, Note, File) + `ItemGrid`, `ItemList` | Storybook-free: styleguide section lists every card state (pending, done, failed) |
| 4.2 | B | `ItemDrawer` via `?item=`: previews (image lightbox, PDF iframe from signed URL, video embed, link card, note editor), editable title/note/collection/tags, metadata, actions | `?item=` survives reload (Playwright) |
| 4.3 | B | State mutations: read on open, favorite, archive, trash with Undo toast (inverse mutation) | Optimistic + rollback tests |
| 4.4 | B | `/api/cron/daily` (§5.7): purge trash ≥ 30 days (storage first, then rows), `CRON_SECRET` bearer check; `vercel.json` cron | Route test: 401 without secret; purges only old trashed rows |
| 4.G | R + O | Gate: every kind in grid, list and drawer | Green |
