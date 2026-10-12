# Things

Things is a save-for-later app for links, files and notes, with one user per account. Save anything, organise it into collections, and find it again with fast search. It is built on Next.js 16, Supabase and Tailwind CSS v4.

## Requirements

- Node.js >= 20.9
- pnpm (see the `packageManager` field in `package.json`)

## Commands

```
pnpm dev · pnpm typecheck · pnpm lint · pnpm test · pnpm e2e
pnpm supabase start · pnpm supabase db reset · pnpm supabase test db
pnpm supabase gen types typescript --local > src/types/database.types.ts
```

Also available: `pnpm build`, `pnpm start`, `pnpm format`, `pnpm format:check`, `pnpm test:watch`.

Copy `.env.example` to `.env.local` and fill in the values before running against Supabase.

## Docs

- `docs/plan.md`: product spec and architecture
- `docs/orchestration.md`: execution plan and work packages
- `docs/research-notes.md`: verified API facts and pinned versions
- `CLAUDE.md`: project rules for contributors and agents
