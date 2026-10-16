# Phase 8 — Motion, polish, release

Shared rules, loop, owner actions and status: [README.md](README.md). UI: [design.md](design.md).

## Build

- Motion pass per the spec; responsive/mobile (drawer becomes bottom sheet, canvas is pan/zoom + tap to open); a11y audit (focus rings, ARIA for DnD, contrast); PWA manifest; error boundaries.
- Guest cleanup in `/api/cron/daily` (daily Vercel Cron, `CRON_SECRET`); Vercel production deploy.
- **Done when:** axe shows no critical issues; 60 fps while dragging in a 500-item grid (virtualize if not); production deploy is live.

## Spec

**Motion spec (Motion for React — `motion/react`)**

| Moment | Animation | Timing |
| --- | --- | --- |
| New item lands | Scale 0.96→1, opacity 0→1, blur 6px→0; enters from drop point when known | Spring, stiffness 380, damping 30 |
| Grid reflow (filter, delete, reorder) | `layout` animation on cards; exits collapse + fade | 250ms ease-out |
| Card hover | Lift y −2px, shadow grows, thumbnail scales 1.02 | 150ms |
| Card → detail drawer | Shared `layoutId` on the thumbnail; drawer slides from right | Spring |
| Drag over a sidebar target | Target scales 1.03, aurora gradient border fades in | 150ms |
| Drop overlay | Aurora fades and drifts up from the bottom edge | 300ms |
| Enrichment arrives | Skeleton shimmer cross-fades to the real image/title | 200ms |
| Empty states | Slow aurora drift + one line of copy ("Drop anything here.") | 30s loop |

Rule: during an active dnd-kit drag, cards use dnd-kit transforms only; Motion `layout` resumes after drop. All motion respects `prefers-reduced-motion` (opacity-only fallbacks).

On the canvas, React Flow owns node position and drag; Motion animates only each card's inner content (enter, hover, enrichment). dnd-kit is never used on the canvas.

## Work packages

| WP | Who | Task | Key acceptance |
| --- | --- | --- | --- |
| 8.1 | B | Motion pass per the motion table; `MotionConfig reducedMotion="user"` | Reduced-motion e2e |
| 8.2 | B ∥ | Responsive: drawer → bottom sheet (vaul), canvas pan/zoom + tap to open, sidebar as sheet | Playwright mobile viewport |
| 8.3 | B | a11y: `@axe-core/playwright` on every route; focus rings, DnD announcements, contrast fixes; scout digests axe output between rounds | 0 critical |
| 8.4 | B | PWA manifest + icons, error boundaries (`error.tsx`, `global-error.tsx`), guest cleanup added to `/api/cron/daily` (inactive 30 days, files then `auth.admin.deleteUser`) | Route tests |
| 8.5 | B | 500-item grid drag at 60 fps; virtualize (`@tanstack/react-virtual`) only if the trace says so | Trace digest |
| 8.G | R + O | Gate + production deploy (needs owner actions O2–O6); smoke test on the live URL | Live |

## Open findings

| Finding | Fix in |
| --- | --- |
| Motion JS animations need `MotionConfig reducedMotion="user"` (CSS rule doesn't cover them) | WP 8.1 (already planned) |
| Drop overlay only fades in; the spec's "drifts up from the bottom edge" is missing | WP 8.1 |
| Undo on a batch drop can run while the original request is still in flight; out-of-order arrival leaves the server disagreeing with the UI. Queue the inverse after the original settles | WP 8.1 |
| Overlapping sidebar reorders: a failed first one rolls back over the second's optimistic order (refetch repairs it) | WP 8.1 |
| Sidebar is mounted twice (desktop + mobile sheet) under one DndContext, so dnd ids are duplicated; render one sidebar per breakpoint | WP 8.2 |
| Offline, a collection canvas renders nothing while its viewport query is paused | WP 8.2 / 8.4 |
| "Sign in instead" from the upgrade conflict leaves the guest's rows orphaned until the 30-day cleanup | WP 8.4 — acceptable for v1 |
| `createImageBitmap` decodes images at full size before the 480 px thumbnail; a 20k px image risks memory pressure — pass `resizeWidth` when the file is large | WP 8.5 |
| The gate's "≤ 3 s" is asserted in e2e only for links (unfurl mocked); image/PDF cases use longer timeouts on the local stack | Re-check on the deployed app, 8.G |
| Unfurl decodes every page as UTF-8; windows-1252 or Shift_JIS pages get garbled titles | v2 (or 8.x if seen in practice) |
