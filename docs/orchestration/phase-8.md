# Phase 8 — Motion, polish, release

Work packages for one phase. Read [README.md](README.md) first (roles, loop, brief template, status). The product spec for this phase: [../plan/phase-8.md](../plan/phase-8.md).

Legend: **S** = scout (Haiku) · **B** = builder (Sonnet) · **R** = reviewer (Opus) · **O** = orchestrator (Opus) · ∥ = may run in parallel with the previous WP.

| WP | Who | Task | Key acceptance |
| --- | --- | --- | --- |
| 8.1 | B | Motion pass per the motion spec table; `MotionConfig reducedMotion="user"` | Reduced-motion e2e |
| 8.2 | B ∥ | Responsive: drawer → bottom sheet (vaul), canvas pan/zoom + tap to open, sidebar as sheet | Playwright mobile viewport |
| 8.3 | B | a11y: `@axe-core/playwright` on every route; focus rings, DnD announcements, contrast fixes; scout digests axe output between rounds | 0 critical |
| 8.4 | B | PWA manifest + icons, error boundaries (`error.tsx`, `global-error.tsx`), guest cleanup added to `/api/cron/daily` (inactive 30 days, files then `auth.admin.deleteUser`) | Route tests |
| 8.5 | B | 500-item grid drag at 60 fps; virtualize (`@tanstack/react-virtual`) only if the trace says so | Trace digest |
| 8.G | R + O | Gate + production deploy (needs O2–O6); smoke test on the live URL | Live |

## Carried-over findings

Non-blocking review findings that land in this phase's WPs.

| Finding | Fix in |
| --- | --- |
| Motion JS animations need `MotionConfig reducedMotion="user"` (CSS rule doesn't cover them) | WP 8.1 (already planned) |
| "Sign in instead" from the upgrade conflict leaves the guest's rows orphaned until the 30-day cleanup | WP 8.4 (cleanup cron) — acceptable for v1 |
| Unfurl decodes every page as UTF-8; pages in windows-1252 or Shift_JIS get garbled titles (charset from `Content-Type`/`<meta charset>` is ignored) | v2 (or WP 8.x if seen in practice) |
| `createImageBitmap` decodes images at full size before the 480 px thumbnail; a 20k px image risks memory pressure — pass `resizeWidth` when the file is large | WP 8.5 |
| Drop overlay only fades in; the spec's "drifts up from the bottom edge" is missing | WP 8.1 (motion pass) |
| The gate's "≤ 3 s" is asserted in e2e only for links (unfurl mocked); image/PDF cases use longer timeouts on the local stack | Re-check on the deployed app, WP 8.G |
| Undo on a batch drop can run while the original request is still in flight; out-of-order arrival leaves the server disagreeing with the UI. Queue the inverse after the original settles | WP 8.1 polish |
| Overlapping sidebar reorders: a failed first one rolls back over the second's optimistic order (refetch repairs it) | WP 8.1 polish |
| Sidebar is mounted twice (desktop + mobile sheet) under one DndContext, so dnd ids are duplicated; render one sidebar per breakpoint | WP 8.2 (responsive) |
