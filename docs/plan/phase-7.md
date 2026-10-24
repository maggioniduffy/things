# Phase 7 — Search and command palette

Shared rules, loop and status: [README.md](README.md). Schema: [data-model.md](data-model.md).

## Build

- `search_items` RPC, debounced search field, filter chips, ⌘K palette (search results + actions + navigation), all shortcuts.
- Onboarding wizard (WP 7.5, added 2026-10-24 by the owner).
- **Done when:** searching "cancion" finds "Canción"; a one-character typo still matches titles; every shortcut in both tables (this file and the canvas table in [phase-6.md](phase-6.md)) works.

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

## Work packages

| WP | Who | Task | Key acceptance |
| --- | --- | --- | --- |
| 7.1 | B | `search_items(q, rules, lim)` migration (FTS ∪ trigram, ranked, rules applied, security invoker) + pgTAP | "cancion" → "Canción"; one-char typo matches |
| 7.2 | B | Debounced search field (`/`), filter chips (kind, tag, domain, status) synced to URL, `CommandPalette` (results, actions, navigation) | Playwright |
| 7.3 | B | `hooks/use-shortcuts.ts` with chord support (`G` then `I/A/F`), all global shortcuts | One test per shortcut |
| 7.4 | S | Sweep: matrix of every shortcut in both tables vs. implementation + tests; report gaps | Zero gaps |
| 7.5 | B | Onboarding wizard: a blocking step modal on the first app visit of a new guest or a first sign-in (welcome, capture, organize, find: search, ⌘K and shortcuts, canvas; guests also get "add your email to keep things"). Next/Back, progress dots, Skip; Skip or Finish sets `user_metadata.tour_done_at`; "Show the tour" in the palette and Settings replays it | Unit + Playwright: shows once for a new guest, Skip/Finish never shows it again after reload, replay works |
| 7.G | R + O | Gate | Green |

## Open findings

| Finding | Fix in |
| --- | --- |
| Menu/command highlighted row is 1.13:1 against the menu surface; strengthen the highlight | WP 7.2 (palette) |
| Styleguide lacks derived `rounded-sm…xl`, `CommandDialog`, bottom drawer, sub-menus, radio items | WP 7.2 / 8.3 |
| Upgrade dialog lives inside `GuestBanner`, so the guest-quota toast can't offer "Add email" | WP 7.2 (palette/actions) |
| Smart-view and tag lists don't update membership optimistically after an item change or tag drop | WP 7.2 (filters) |
