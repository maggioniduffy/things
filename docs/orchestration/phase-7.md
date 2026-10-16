# Phase 7 — Search and command palette

Work packages for one phase. Read [README.md](README.md) first (roles, loop, brief template, status). The product spec for this phase: [../plan/phase-7.md](../plan/phase-7.md).

Legend: **S** = scout (Haiku) · **B** = builder (Sonnet) · **R** = reviewer (Opus) · **O** = orchestrator (Opus) · ∥ = may run in parallel with the previous WP.

| WP | Who | Task | Key acceptance |
| --- | --- | --- | --- |
| 7.1 | B | `search_items(q, rules, lim)` migration (FTS ∪ trigram, ranked, rules applied, security invoker) + pgTAP | "cancion" → "Canción"; one-char typo matches |
| 7.2 | B | Debounced search field (`/`), filter chips (kind, tag, domain, status) synced to URL, `CommandPalette` (results, actions, navigation) | Playwright |
| 7.3 | B | `hooks/use-shortcuts.ts` with chord support (`G` then `I/A/F`), all global shortcuts | One test per shortcut |
| 7.4 | S | Sweep: build a matrix of every shortcut in both spec tables vs. implementation + tests; report gaps | Zero gaps |
| 7.G | R + O | Gate | Green |

## Carried-over findings

Non-blocking review findings that land in this phase's WPs.

| Finding | Fix in |
| --- | --- |
| Menu/command highlighted row is 1.13:1 against the menu surface; strengthen the highlight | WP 7.2 (palette) |
| Styleguide lacks derived `rounded-sm…xl`, `CommandDialog`, bottom drawer, sub-menus, radio items | WP 7.2 / 8.3 |
| Upgrade dialog lives inside `GuestBanner`, so the guest-quota toast can't offer "Add email" | WP 7.2 (palette/actions) |
| Smart-view and tag lists don't update membership optimistically after an item change or tag drop | WP 7.2 (filters) |
