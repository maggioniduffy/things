# Thingteca · Cosateca

Thingteca (English, https://thing.teca.plus) and Cosateca (Spanish, https://cosa.teca.plus) are one save-for-later app for links, files and notes, with one user per account. Save anything, organise it into collections, and find it again with fast search. It is built on Next.js 16, Supabase and Tailwind CSS v4.

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

## Local setup

1. Start Docker (in a cloud container: `dockerd &`).
2. Start the local Supabase stack: `pnpm db:start`.
3. Write `.env.local` from `pnpm supabase status -o env`: copy `API_URL` to `NEXT_PUBLIC_SUPABASE_URL`, `PUBLISHABLE_KEY` to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SECRET_KEY` to `SUPABASE_SECRET_KEY` (see `.env.example`).
4. Run the app: `pnpm dev`, then open http://localhost:3000.

`.env.local` is gitignored. The app needs it to build and start, so `pnpm e2e` (which runs `pnpm build && pnpm start`) needs it too.

## Docs

- `docs/plan/`: plan and progress (README) + spec and work packages per phase
- `docs/research-notes.md`: verified API facts and pinned versions
- `CLAUDE.md`: project rules for contributors and agents
