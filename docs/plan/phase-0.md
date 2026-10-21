# Phase 0 — Scaffold and design system

Shared rules, loop and status: [README.md](README.md). Tokens, typography, components: [design.md](design.md).

## Build

- Next.js 16 + TS strict + Tailwind v4 + shadcn init; ESLint, Prettier, Vitest, Playwright.
- Tokens in `@theme`, fonts, `<Grain />`, `<Aurora />`, Logo, restyled primitives, `/styleguide`.
- Landing page `/` with aurora hero, "Try without an account" and "Sign in" CTAs, footer in the reference layout.
- **Done when:** `/styleguide` shows every token and component; Lighthouse performance ≥ 90 on `/`; reduced-motion disables drift.

## Work packages

| WP | Who | Task | Key acceptance |
| --- | --- | --- | --- |
| 0.0 | S | Confirm create-next-app / shadcn / Tailwind v4 / ESLint flat config facts — **done**, see research-notes (scaffold into a subdir: create-next-app refuses non-empty dirs) | Notes cited |
| 0.1 | B | Scaffold: Next 16, pnpm, TS strict, Tailwind v4, ESLint + Prettier, Vitest + Testing Library, Playwright; scripts `dev/typecheck/lint/test/e2e`; `.github/workflows/ci.yml`; `.env.example`; `CHANGELOG.md` | `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green; CI green |
| 0.2 | B | Tokens in `globals.css` `@theme`; fonts via `next/font` (Inter + Inter Tight); `<Grain />`, `<Aurora />`, `<Logo />` in `components/brand` | No raw hex outside `globals.css` (researcher grep); reduced-motion stops drift |
| 0.3 | B ∥ | shadcn init; restyle Button (primary/secondary/ghost), IconButton, Input, SearchField, Dialog, Drawer (vaul), DropdownMenu, ContextMenu, Tooltip, Kbd, Badge, Toast (sonner), Command (cmdk), Skeleton | Each renders with tokens; keyboard focus visible |
| 0.4 | B | `/styleguide` (404 in production) showing tokens, components, motion samples; landing `/` (aurora hero, two CTAs, reference-style footer) | Playwright smoke on both pages |
| 0.G | R + O | Gate: Lighthouse perf ≥ 90 on `/` (`next build && next start` + `lighthouse` CLI, researcher digests report); Playwright `emulateMedia({ reducedMotion: 'reduce' })` asserts no running animations; Opus reviews screenshots of `/` and `/styleguide` | All green |
