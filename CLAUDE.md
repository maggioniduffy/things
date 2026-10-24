# Thingteca · Cosateca

Save-for-later app: links, files, notes. Single user per account. Thingteca in English (thing.teca.plus), Cosateca in Spanish (cosa.teca.plus); "Teca" for both (email sender).
Plan: docs/plan/README.md (progress, roles, loop, brief template, owner actions, architecture) + docs/plan/phase-N.md (spec, WPs, gate, open findings for one phase).
Read only the current phase's file; data-model.md and design.md only when the work needs them; archive.md is history.
Verified API facts (supersede memory and the spec where they differ): docs/research-notes.md.

## Stack
Next.js 16 App Router · React 19 · TypeScript strict · Tailwind v4 (@theme tokens)
shadcn/ui · motion (motion/react) · dnd-kit (grid/list/sidebar) · React Flow @xyflow/react (canvas)
TanStack Query v5 · Zustand
Supabase (@supabase/ssr, Postgres + RLS, Storage; auth = email OTP, Google, anonymous guests) · Turnstile · Brevo SMTP · Vercel

## How work is run (model routing)
- Opus (main session): orchestrates, plans, writes WP briefs, reviews, runs gates, commits.
- `researcher` agent (Haiku wrapper around OpenCode): large-but-simple reading — docs, package types, codebase sweeps, logs — returns summaries. `tester` (same setup) writes and runs tests.
- `builder` agent (Sonnet): implements one work package per brief; never commits.
- `reviewer` agent (Opus): independent check of a WP diff or a phase gate.
See docs/plan/README.md for the loop and the brief template.

## Rules
- Start tasks in PLAN MODE
- No separate backend. Browser -> Supabase with RLS for CRUD.
  Route Handlers only for /api/unfurl, auth callback, /api/cron/* and /api/mcp (caller's JWT under RLS, never the service key).
- Service-role / secret key only in /api/cron/* (server-only, CRON_SECRET-protected); never anywhere else. Env vars in .env.local, read via process.env, never logged.
- Every table has user_id + RLS. New migration = new file in supabase/migrations; regenerate types.
- Server state in TanStack Query with optimistic updates + rollback. UI-only state in Zustand.
- Colors, radii, fonts only via tokens; no raw hex in components.
- All motion respects prefers-reduced-motion. During dnd-kit drags, no Motion layout animations.
- Guests are anonymous Supabase users: same code path, no localStorage data layer.
- Canvas: React Flow owns position/drag; never mix dnd-kit or Motion layout into it.
- UI copy in English, sentence case.
- Verify Next.js 16 conventions (proxy.ts, caching) against installed docs (node_modules/next/dist/docs) before using them.

## Commands
pnpm dev · pnpm typecheck · pnpm lint · pnpm test · pnpm e2e
pnpm supabase start · pnpm supabase db reset · pnpm supabase test db
pnpm supabase gen types typescript --local > src/types/database.types.ts

## Definition of done
- Work package: typecheck + lint green · the WP's own new/changed unit tests green (`pnpm test <paths>`). No full suite, no e2e.
- Phase gate: full `pnpm test` + `pnpm e2e` green (including the specs the phase's WPs wrote) · no console errors · styleguide still renders · CHANGELOG.md entry.

## Delegation
OpenCode-backed wrappers (haiku, thin; config in `opencode.json`, model `opencode/deepseek-v4.1-flash-free`). They count toward the two-agent limit.
- `researcher`: docs/API lookups, endpoint probes, file inventories, summarizing long logs. Read-only.
- `tester`: unit/DB tests, fixtures, long mechanical edits.
- Give them paths, never file contents or secrets. Never send customer data.
- Don't switch to a free model that may train on data (Big Pickle, MiMo, Nemotron); the Zen free tier for deepseek is zero-retention per opencode.ai/docs/zen.
- Report agent results to the user in 1–3 lines. If a test failure's cause isn't obvious, the investigation goes to a stronger agent, not the tester.
