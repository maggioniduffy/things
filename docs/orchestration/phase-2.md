# Phase 2 — App shell and data layer

Work packages for one phase. Read [README.md](README.md) first (roles, loop, brief template, status). The product spec for this phase: [../plan/phase-2.md](../plan/phase-2.md).

Legend: **S** = scout (Haiku) · **B** = builder (Sonnet) · **R** = reviewer (Opus) · **O** = orchestrator (Opus) · ∥ = may run in parallel with the previous WP.

| WP | Who | Task | Key acceptance |
| --- | --- | --- | --- |
| 2.1 | B | `QueryProvider` (+ hydration), `stores/ui-store.ts` (selection, view mode, filters, palette, drag), `lib/views.ts`: `[[...view]]` params → `ViewSpec` (pure, unit-tested) | Unit tests for every route in the routes table |
| 2.2 | B | `lib/items/queries.ts`: list by `ViewSpec` (keyset pagination, 50/page, sort modes), counts from `item_counts`; server prefetch of page 1 + `HydrationBoundary` | Unit tests on query builder; no client waterfall on first load |
| 2.3 | B | `app/app/layout.tsx` shell; Sidebar (system views, formats with counts only when > 0, collections, tags, smart views), Toolbar (search placeholder, sort, grid/list/canvas toggle with canvas disabled), empty states with aurora | Playwright: switching views keeps the same document (no full reload); counts match seeded DB |
| 2.G | R + O | Gate | Green |
