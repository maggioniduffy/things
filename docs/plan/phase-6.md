# Phase 6 — Canvas

Shared rules, loop and status: [README.md](README.md). Schema: [data-model.md](data-model.md). Spec-review items (#N) are in [archive.md](archive.md).

## Build

- React Flow view for Inbox and each collection; `ItemNode` reusing card components; pan, zoom, marquee, multi-drag, resize, z-order, snap, minimap.
- Drops and pastes at position, double-click to add a note, copy/paste and duplicate cards, auto-place for unplaced items, `save_canvas_layout` RPC with debounce, viewport persistence, canvas shortcuts.
- **Done when:** positions, sizes and viewport persist after reload and on another device; a file dropped at a point appears there; copied cards paste at the cursor with their layout, including into another collection; 300 cards pan and zoom at 60 fps; moving cards on the canvas never changes grid order.

## Spec

Every collection and the Inbox has its own infinite canvas built with React Flow; formats, tags and smart views stay grid/list because they are filters, not places.

- Cards are React Flow custom nodes that reuse the grid's card components; notes render as sticky-style text cards.
- Pan with space-drag, trackpad or middle mouse; zoom 10–200% with pinch or ⌘-scroll; dot-grid background in `--color-line` under the grain.
- Marquee and Shift-click multi-select, multi-drag, resize (min 160×120), bring to front, optional 8px snap.
- Items land where they happen: drops at the cursor (`screenToFlowPosition`), pastes at the viewport center, double-click on empty space creates a note there.
- Items without a position (saved from grid or another device) are auto-placed in a free column right of the existing content.
- Moving to another collection from the canvas: context menu or `M`. Dropping a node on a sidebar collection (detected on drag stop with `elementFromPoint`) is a stretch goal.
- Grid manual order and canvas positions are independent; switching views never moves items.
- Minimap toggle; `onlyRenderVisibleElements` above \~300 nodes.
- Copy and paste cards: ⌘C copies the selected cards, ⌘V pastes copies at the cursor (viewport center if the cursor is off the canvas), keeping their relative layout; ⌘D duplicates in place, offset by 16px. Also in the node and pane context menus (Copy, Duplicate, Paste). Pasting works across canvases (copy in the Inbox, paste into a collection). A paste is one batch insert with an Undo toast, and the copies become the new selection.
  - The copy goes to an in-app clipboard (item ids + offsets, Zustand) and, as plain text, to the system clipboard (URLs for links, text for notes, one per line), so it also pastes into other apps. On ⌘V the canvas checks whether the system clipboard still holds that exact text: if yes it duplicates the items, otherwise it falls back to the normal paste (URL → link, text → note, image → image item).
  - Copies keep title, note, metadata and tags, get fresh ids, `position` and canvas coordinates, and start unread and not favorited. File items copy their Storage object (`storage.copy()` to the new item's path), so the copy counts toward the guest quota and deleting one never breaks the other.

| Key | Canvas action |
| --- | --- |
| Space + drag | Pan |
| ⌘ + / ⌘ − | Zoom in / out |
| Shift + 1 | Fit all items |
| Shift + 0 | Zoom to 100% |
| N | New note at viewport center |
| \] / \[ | Bring forward / send backward |
| ⌘C / ⌘V | Copy selected cards / paste copies at the cursor |
| ⌘D | Duplicate selected cards |

## Data model

**Canvas layout RPC** — one call saves every moved or resized node; `security invoker` keeps RLS in force (actual migration also fixes `search_path`, #5):

```sql
create or replace function save_canvas_layout(layout jsonb)
returns void language sql security invoker as $$
  update items i set
    canvas_x = (l->>'x')::real, canvas_y = (l->>'y')::real,
    canvas_w = (l->>'w')::real, canvas_h = (l->>'h')::real,
    canvas_z = (l->>'z')::int, updated_at = now()
  from jsonb_array_elements(layout) l
  where i.id = (l->>'id')::uuid;
$$;
```

## Key flows

**Canvas save**

1. React Flow updates node state locally on every pointer move; nothing hits the network during a drag.
2. On drag stop or resize end, changed nodes go into a pending map; a 400 ms debounce flushes them in one `save_canvas_layout` call. Optimistic; on error, roll back to the last saved layout and toast.
3. Viewport (x, y, zoom) is saved on move end, debounced 1 s, to `collections.canvas_viewport` (Inbox: localStorage).
4. Auto-place: on load, items with null `canvas_x` are stacked in a column right of the content's bounding box (24px gaps), then saved in one batch.
5. Default node size by kind: link/article 280×240, image by aspect ratio (max 320 wide), note 240×160, file 240×200.

## Work packages

| WP | Who | Task | Key acceptance |
| --- | --- | --- | --- |
| 6.1 | B | `CanvasView` (React Flow) for Inbox + collections, `ItemNode` reusing cards, default sizes by kind, `autoPlace()` pure function (tested), dot grid, minimap toggle, `onlyRenderVisibleElements` > 300; seed script with 300 items (#9) | Renders seeded 300 |
| 6.2 | B | Layout persistence: pending map + 400 ms debounce → `save_canvas_layout`; rollback + toast; viewport save (1 s debounce; collections → DB, Inbox → localStorage) | Positions/sizes/viewport persist after reload (Playwright) |
| 6.3 | B | Drops/pastes at position (`screenToFlowPosition`), double-click note, resize (min 160×120), z-order `]`/`[`, snap 8 px, shortcuts table, `M` move via context menu | Shortcut tests |
| 6.4 | B | Copy/paste (spec above): ⌘C/⌘V/⌘D + context menu; in-app clipboard (Zustand) + plain-text system clipboard with fallback to normal paste; batch insert (tags copied, file items via `storage.copy()`, guest quota respected); Undo toast; works across canvases | Playwright: copy 3 cards, paste in another collection at the cursor with the same relative layout, Undo removes them; a copied file still opens after the original is purged from Trash |
| 6.G | R + O | Gate: 300 cards at 60 fps (Playwright trace; scout digests), canvas moves never touch `position`; fix the open findings below marked 6.G | Green |

## Open findings

| Finding | Fix in |
| --- | --- |
| An auto-placed node whose first save fails is never retried (`hasSeen` filter); reload auto-places it again | 6.G |
| `onMoveEnd` also fires for the initial `fitView`, so the first open writes a viewport the user never chose | 6.G |
| `onNodesChange` applies to `nodesRef.current`, which a rollback/reconcile updater doesn't refresh until commit; a change in that window can overwrite a rollback | 6.G |
