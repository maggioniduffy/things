# Phase 7 — Search and command palette

Product spec for one phase. Shared context: [README.md](README.md) (always), [data-model.md](data-model.md) (schema work), [design.md](design.md) (UI work). How it is built: [../orchestration/phase-7.md](../orchestration/phase-7.md).

## Build

- `search_items` RPC, debounced search field, filter chips, ⌘K palette (search results + actions + navigation), all shortcuts.
- **Done when:** searching "cancion" finds "Canción"; a one-character typo still matches titles; every shortcut in both tables works.

## Spec

**Keyboard shortcuts**

| Key | Action |
| --- | --- |
| ⌘K | Command palette (search, add, jump to collection, actions) |
| ⌘V | Save clipboard |
| / | Focus search |
| J / K or arrows | Move selection |
| Enter / Space | Open detail / quick look |
| F | Toggle favorite |
| E | Archive |
| ⌫ | Move to Trash |
| M | Move to collection (opens picker) |
| T | Add tag |
| G then I / A / F | Go to Inbox / All / Favorites |

## Data model

**Search** — one RPC `search_items(q text, rules jsonb, lim int)` (security invoker, so RLS applies) that ORs `search @@ websearch_to_tsquery('simple', f_unaccent(q))` with `title % q` (trigram), ranks by `ts_rank` + `similarity`, and applies the same rules. The `simple` config + unaccent handles mixed Spanish/English content without stemming surprises.
