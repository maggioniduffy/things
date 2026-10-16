# Phase 5 — Organize and drag-and-drop

Work packages for one phase. Read [README.md](README.md) first (roles, loop, brief template, status). The product spec for this phase: [../plan/phase-5.md](../plan/phase-5.md).

Legend: **S** = scout (Haiku) · **B** = builder (Sonnet) · **R** = reviewer (Opus) · **O** = orchestrator (Opus) · ∥ = may run in parallel with the previous WP.

| WP | Who | Task | Key acceptance |
| --- | --- | --- | --- |
| 5.0 | B | **Spike** (§5.8): 200 sortable cards with Motion `layout` disabled during drag; measure; Opus decides pattern | Pattern recorded in research-notes |
| 5.1 | B | Collections CRUD (emoji, aurora color) + tags CRUD; inline `#tag` parsing in title/note inputs | Optimistic CRUD tests |
| 5.2 | B | `lib/order.ts` (fractional-indexing wrappers) + sortable grid/list (manual sort only), `DragOverlay`, keyboard sensor | Reorder = one-row update (assert request count); persists after reload |
| 5.3 | B | Multi-select (⌘/Shift-click) + drag one/many to sidebar targets (collection, tag, Favorites, Archive, Trash); one optimistic batch mutation | 5 cards → collection in one mutation |
| 5.4 | B | Sidebar reorder (collections, smart views); smart-view builder: zod `Rules` → `lib/filters.ts` → query (unit-tested) | Rules round-trip tests |
| 5.G | R + O | Gate incl. keyboard DnD | Green |
