# Phase 8 — Motion, polish, release

Product spec for one phase. Shared context: [README.md](README.md) (always), [data-model.md](data-model.md) (schema work), [design.md](design.md) (UI work). How it is built: [../orchestration/phase-8.md](../orchestration/phase-8.md).

## Build

- Motion pass per the spec; responsive/mobile (drawer becomes bottom sheet, canvas is pan/zoom + tap to open); a11y audit (focus rings, ARIA for DnD, contrast); PWA manifest; error boundaries.
- Guest cleanup cron (`/api/cron/cleanup-guests`, daily Vercel Cron, `CRON_SECRET`); Vercel production deploy.
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
