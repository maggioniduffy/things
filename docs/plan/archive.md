# Things — Plan archive

Superseded material kept for history. Not needed to build anything.

## CLAUDE.md draft

Drop this at the repo root before Phase 0; Claude Code reads it every session.

```markdown
# Things

Save-for-later app: links, files, notes. Single user per account.
Full plan: docs/plan.md (exported from the Things plan doc).

## Stack
Next.js 16 App Router · React 19 · TypeScript strict · Tailwind v4 (@theme tokens)
shadcn/ui · motion (motion/react) · dnd-kit (grid/list/sidebar) · React Flow @xyflow/react (canvas)
TanStack Query v5 · Zustand
Supabase (@supabase/ssr, Postgres + RLS, Storage; auth = email OTP, Google, anonymous guests) · Turnstile · Brevo SMTP · Vercel

## Rules
- No separate backend. Browser -> Supabase with RLS for CRUD.
  Route Handlers only for /api/unfurl and auth callback.
- Service-role key only in /api/cron/* (server-only, CRON_SECRET-protected); never anywhere else. Env vars in .env.local, read via process.env, never logged.
- Every table has user_id + RLS. New migration = new file in supabase/migrations; regenerate types.
- Server state in TanStack Query with optimistic updates + rollback. UI-only state in Zustand.
- Colors, radii, fonts only via tokens; no raw hex in components.
- All motion respects prefers-reduced-motion. During dnd-kit drags, no Motion layout animations.
- Guests are anonymous Supabase users: same code path, no localStorage data layer.
- Canvas: React Flow owns position/drag; never mix dnd-kit or Motion layout into it.
- UI copy in English, sentence case.
- Verify Next.js 16 conventions (proxy.ts, caching) against installed docs before using them.

## Commands
pnpm dev · pnpm typecheck · pnpm lint · pnpm test · pnpm e2e
supabase start · supabase db reset · supabase gen types typescript --local > src/types/database.types.ts

## Definition of done (every phase)
typecheck + lint + tests green · no console errors · styleguide still renders · CHANGELOG.md entry
```
