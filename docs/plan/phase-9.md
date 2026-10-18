# Phase 9 — Notes & board feedback

Shared rules, loop, owner actions and status: [README.md](README.md). UI: [design.md](design.md).

Owner feedback after Phase 6. Runs before Phases 7–8; 8.2 later reuses the sheet from 9.2.

Decisions taken with the owner:
- Grouping by collection **only in All** (Inbox has no collection items).
- "Add note form" = the toolbar **Add** dialog (quick add).
- Folder = closed stack by default, tap expands inline with a stretch; open/closed remembered per collection.
- Mobile scroll effect = **sticky stack** (deck).

## WP 9.1 — Note background color (reviewer: yes, migration)
- Migration `supabase/migrations/2026101800xxxx_item_color.sql`: `alter table items add column color text check (color is null or color in ('pink','violet','blue','red','coral','olive','white','graphite'))`. RLS unchanged (row-level already). Regenerate `src/types/database.types.ts`; add `color` to `ITEM_COLUMN_LIST` in `src/lib/items/queries.ts`.
- Tokens in `src/app/globals.css`: `--color-note-white`, `--color-note-graphite`, `--color-ink-inverse` (+ muted inverse). Aurora notes use a tint (color-mix ~30%, like today's `bg-aurora-coral/20`) so dark ink keeps AA contrast; `graphite` = solid dark surface with inverse ink (title, excerpt, badge, markers). `null` = current coral look (no data change for existing notes).
- `src/lib/items/note-colors.ts`: one map color → surface/text classes + label; used by `note-card.tsx` (`surfaceClassName` + text classes via `CardShell`) and the canvas node.
- Picker: `NoteColorPicker` (radiogroup of swatches, keyboard arrows, aria labels "Pink"…, "Default") in the note section of `src/components/drawer/fields.tsx`; "Color" submenu in `src/components/canvas/canvas-menu.tsx` for note nodes (applies to selected notes). Save through the existing optimistic `edit` action (rollback already there).
- Tests: unit for picker + note-card classes; pgTAP check-constraint test; e2e: set color in drawer → card surface changes and survives reload.

## WP 9.2 — Add dialog as compact bottom sheet on mobile ∥
- `src/hooks/use-media-query.ts` (SSR-safe, `matchMedia`).
- `src/components/capture/quick-add.tsx`: below `sm` render `Drawer` (vaul, `src/components/ui/drawer.tsx`, direction bottom, height = content, `repositionInputs` so it sits above the keyboard); `sm+` keeps the current `Dialog`. `QuickAddForm` is shared unchanged; keep the focus-restore logic for both. Footer buttons side by side on mobile, textarea 3 rows.
- Tests: unit for both branches; Playwright mobile viewport (iPhone 13): sheet height < 60% of viewport, save works.

## WP 9.5 — Canvas hand tool ∥
- `src/stores/ui-store.ts`: `canvasTool: "select" | "hand"` (persisted, default select).
- `src/components/canvas/canvas-controls.tsx`: two-button segmented toggle (MousePointer2 / Hand icons, `aria-pressed`), shortcuts **V** / **H** in `src/lib/canvas/shortcuts.ts`.
- `src/components/canvas/canvas-view.tsx`: hand → `panOnDrag` true (left button), `selectionOnDrag` false, `nodesDraggable` false; tap/click on a card still opens it. Cursor `grab`/`grabbing` via a class on the wrapper (`.react-flow__pane` override in globals.css). Space-to-pan keeps working in select mode.
- Tests: unit (toggle + shortcut), e2e: in hand mode a left-drag on a card pans the viewport and does not move the card.

## WP 9.4 — Collection folders in All (reviewer: yes, ordering/DnD)
- Pure `src/lib/items/group.ts`: `groupByCollection(items, expanded: Set<string>)` → entries `{type:"item"}` | `{type:"folder", collectionId, items}`; a folder sits where its first item falls in the current sort; inbox items stay loose. Groups span all loaded pages. Unit-tested.
- `src/components/board/item-grid.tsx` + new `collection-folder.tsx`: used only when `view.type === "all"` and grid mode (list view unchanged).
  - Closed: stack tile (2 offset layers behind, collection name/icon/color, count from `countsQueryOptions`), click/Enter expands; secondary "Open collection" link → `/app/c/[id]`.
  - Open: a header chip "‹name› · Collapse" then the cards inline in the grid.
  - Stretch animation (motion): cards spread out from the folder's rect with a spring scaleX/scaleY overshoot ("stretch") and a short stagger; collapse runs it in reverse into the stack. Reduced motion → opacity only. No layout animation while `ui.dragging`.
- State: `expandedCollections: string[]` in `ui-store` (persisted).
- DnD/selection: collapsed items are excluded from the `SortableContext` ids and marquee selection; expanded cards keep current sortable/draggable behavior. Collapsed folder is not draggable (v1).
- Thumbnails: sign per folder/page so expanding doesn't re-sign other pages (keep the `useSignedUrls` per-chunk pattern).
- Tests: group.ts unit; component tests (expand/collapse, persisted state, sortable ids); e2e: All with two collections → folders → expand → open card → collapse.

## WP 9.3 — Sticky stack on mobile (after 9.4, same files)
- Grid below `sm` (already one column): each card wrapper `position: sticky; top: calc(<toolbar h> + var(--i) * 6px)` so cards pile like a deck; the covered card scales to ~0.94 and dims slightly via CSS scroll-driven animation (`animation-timeline: view()`), on the inner element (not the `motion.li`, so it doesn't fight Motion layout). Unsupported browsers just get the sticky pile.
- Off when: `prefers-reduced-motion`, list view, during a dnd-kit drag (`data-dragging` on the grid), `sm+`. Expanded folder cards participate; closed folders are one stacked card.
- Tests: unit for the class switch; e2e mobile viewport: after scrolling, the first card is still in view with `position: sticky`; check canvas/drag specs unaffected.

## Order
9.1 → (9.2 ∥ 9.5, disjoint files, worktrees) → 9.4 → 9.3 → gate.

## Verification (gate)
`pnpm typecheck && pnpm lint && pnpm test && pnpm supabase test db && pnpm e2e` green, including the new specs (desktop + mobile viewport project). Manual on `pnpm dev` with a phone-sized viewport: note colors incl. graphite contrast, Add sheet with on-screen keyboard, deck scroll, folder stretch open/close, canvas hand tool. Styleguide renders (add note-color swatches to the cards section). CHANGELOG entry; README progress table gets a Phase 9 row.

## Open findings

| Finding | Fix in |
| --- | --- |

## Status (2026-10-18, paused)

- **WP 9.1** built (builder report: typecheck, lint, unit tests and `pnpm supabase test db` green; `e2e/note-color.spec.ts` written, not run). Committed as WIP **without the reviewer pass** — next session starts with the reviewer on the 9.1 diff (`git show` of the `phase9(wp9.1)` commit): migration/RLS, optimistic + rollback of the batch `color` action and drawer edit, WCAG contrast of the tints and graphite, radiogroup a11y.
- Next: 9.2 ∥ 9.5 (worktrees) → 9.4 → 9.3 → gate.
- Branch `phase-9-board-feedback` is off `main` and does not include `auth/google-sign-in` (O3); rebase once that merges.
