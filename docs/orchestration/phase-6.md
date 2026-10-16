# Phase 6 — Canvas

Work packages for one phase. Read [README.md](README.md) first (roles, loop, brief template, status). The product spec for this phase: [../plan/phase-6.md](../plan/phase-6.md).

Legend: **S** = scout (Haiku) · **B** = builder (Sonnet) · **R** = reviewer (Opus) · **O** = orchestrator (Opus) · ∥ = may run in parallel with the previous WP.

| WP | Who | Task | Key acceptance |
| --- | --- | --- | --- |
| 6.1 | B | `CanvasView` (React Flow) for Inbox + collections, `ItemNode` reusing cards, default sizes by kind, `autoPlace()` pure function (tested), dot grid, minimap toggle, `onlyRenderVisibleElements` > 300; seed script with 300 items | Renders seeded 300 |
| 6.2 | B | Layout persistence: pending map + 400 ms debounce → `save_canvas_layout`; rollback + toast; viewport save (1 s debounce; collections → DB, Inbox → localStorage) | Positions/sizes/viewport persist after reload (Playwright) |
| 6.3 | B | Drops/pastes at position (`screenToFlowPosition`), double-click note, resize (min 160×120), z-order `]`/`[`, snap 8 px, shortcuts table, `M` move via context menu | Shortcut tests |
| 6.4 | B | Copy/paste (plan/phase-6.md §Canvas): ⌘C/⌘V/⌘D + context menu; in-app clipboard (Zustand) + plain-text system clipboard with fallback to normal paste; batch insert (tags copied, file items via `storage.copy()`, guest quota respected); Undo toast; works across canvases | Playwright: copy 3 cards, paste in another collection at the cursor with the same relative layout, Undo removes them; a copied file still opens after the original is purged from Trash |
| 6.G | R + O | Gate: 300 cards at 60 fps (Playwright trace; scout digests), canvas moves never touch `position` | Green |
