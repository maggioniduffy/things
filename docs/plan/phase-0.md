# Phase 0 — Scaffold and design system

Product spec for one phase. Shared context: [README.md](README.md) (always), [data-model.md](data-model.md) (schema work), [design.md](design.md) (UI work). How it is built: [../orchestration/phase-0.md](../orchestration/phase-0.md).

## Build

- Next.js 16 + TS strict + Tailwind v4 + shadcn init; ESLint, Prettier, Vitest, Playwright.
- Tokens in `@theme`, fonts, `<Grain />`, `<Aurora />`, Logo, restyled primitives, `/styleguide`.
- Landing page `/` with aurora hero, "Try without an account" and "Sign in" CTAs, footer in the reference layout.
- **Done when:** `/styleguide` shows every token and component; Lighthouse performance ≥ 90 on `/`; reduced-motion disables drift.

## Spec

Design tokens, typography and components: see [design.md](design.md).
