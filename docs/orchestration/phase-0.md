# Phase 0 — Scaffold and design system

Work packages for one phase. Read [README.md](README.md) first (roles, loop, brief template, status). The product spec for this phase: [../plan/phase-0.md](../plan/phase-0.md).

Legend: **S** = scout (Haiku) · **B** = builder (Sonnet) · **R** = reviewer (Opus) · **O** = orchestrator (Opus) · ∥ = may run in parallel with the previous WP.

| WP | Who | Task | Key acceptance |
| --- | --- | --- | --- |
| 0.0 | S | Confirm create-next-app / shadcn / Tailwind v4 / ESLint flat config facts — **done**, see research-notes (scaffold into a subdir: create-next-app refuses non-empty dirs) | Notes cited |
| 0.1 | B | Scaffold: Next 16, pnpm, TS strict, Tailwind v4, ESLint + Prettier, Vitest + Testing Library, Playwright; scripts `dev/typecheck/lint/test/e2e`; `.github/workflows/ci.yml`; `.env.example`; `CHANGELOG.md` | `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green; CI green |
| 0.2 | B | Tokens in `globals.css` `@theme`; fonts via `next/font` (Inter + Inter Tight); `<Grain />`, `<Aurora />`, `<Logo />` in `components/brand` | No raw hex outside `globals.css` (scout grep); reduced-motion stops drift |
| 0.3 | B ∥ | shadcn init; restyle Button (primary/secondary/ghost), IconButton, Input, SearchField, Dialog, Drawer (vaul), DropdownMenu, ContextMenu, Tooltip, Kbd, Badge, Toast (sonner), Command (cmdk), Skeleton | Each renders with tokens; keyboard focus visible |
| 0.4 | B | `/styleguide` (404 in production) showing tokens, components, motion samples; landing `/` (aurora hero, two CTAs, reference-style footer) | Playwright smoke on both pages |
| 0.G | R + O | Gate: Lighthouse perf ≥ 90 on `/` (`next build && next start` + `lighthouse` CLI, scout digests report); Playwright `emulateMedia({ reducedMotion: 'reduce' })` asserts no running animations; Opus reviews screenshots of `/` and `/styleguide` | All green |
