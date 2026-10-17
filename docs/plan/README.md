# Things — Plan

Things is a personal "save for later" web app: drop in any link, file or note, and it is auto-classified by format, filed by topic, and easy to find again. Usable without an account (guest mode), one user per account, Next.js + Supabase, no separate backend.

**Read order for a session:** `CLAUDE.md` → this file → the current `phase-N.md` → `docs/research-notes.md` (wins over the spec where they differ). [data-model.md](data-model.md) and [design.md](design.md) only when the work touches schema or UI. [archive.md](archive.md) is history.

## Progress

| Phase | File | Status | PR |
| --- | --- | --- | --- |
| 0 Scaffold & design system | [phase-0.md](phase-0.md) | done (Lighthouse 96/100, e2e 13/13) | #1 + next PR |
| 1 Supabase, auth, guests | [phase-1.md](phase-1.md) | done (gate passed after open-redirect fix) | Phase 1 PR |
| 2 Shell & data layer | [phase-2.md](phase-2.md) | done (gate passed after cache-isolation fix) | #5 |
| 3 Capture | [phase-3.md](phase-3.md) | done (gate passed after concurrent-capture and rollback fixes) | Phase 3 PR |
| 4 Browse | [phase-4.md](phase-4.md) | WP 4.1–4.4 done; gate, CHANGELOG and PR next | |
| 5 Organize & DnD | [phase-5.md](phase-5.md) | done (gate passed after smart-view input and sidebar-handler fixes) | Phase 5 PR |
| 6 Canvas | [phase-6.md](phase-6.md) | done (gate passed: unit 1388/1388, e2e 96/96, 300 cards at 59.6 fps; leftovers in phase-8) | #14 + `claude/cool-archimedes-gikegv` |
| 7 Search & palette | [phase-7.md](phase-7.md) | | |
| 8 Polish & release | [phase-8.md](phase-8.md) | | |

Update this table when a WP or gate lands.

## How we work

**Roles** (agents in `.claude/agents/`)

| Role | Model | Does | Never does |
| --- | --- | --- | --- |
| Orchestrator (**O**) | Opus, main session | Splits phases into WPs, writes briefs, decides trade-offs, reviews diffs, runs gates, commits, opens PRs | Writes large feature code (small post-review fixes are fine) |
| Scout (**S**) | Haiku | Large-but-simple reading: package docs/`.d.ts`, codebase sweeps, log digests (tests, CI, axe, Lighthouse), "find every X" audits, CHANGELOG drafts | Edits the repo; makes decisions |
| Builder (**B**) | Sonnet | Implements one WP per brief, writes its tests, runs typecheck/lint and its own tests | Commits, pushes, widens scope |
| Reviewer (**R**) | Opus | Independent check of a WP diff or a phase gate | Fixes what it finds |

Rule of thumb: a summary → scout; code → builder; a decision or verdict → Opus. In WP tables, ∥ = may run in parallel with the previous WP.

**The loop** (one phase = one session = one PR, branch `phase-N-<slug>`)

1. Opus reads the files above; scouts verify anything research-notes doesn't cover.
2. Opus writes WP briefs (template below), orders them, marks ∥.
3. Builder per WP → code + tests + green WP checks (typecheck, lint, the WP's own unit tests; e2e specs are written but run at the gate) → report. Parallel builders only for ∥ WPs with disjoint files, each in its own worktree.
4. Opus reads report + diff; small fixes inline, otherwise re-brief. Reviewer on risky WPs (auth, RLS, SSRF, storage, ordering, canvas save). A "deviated" or "blocked" report goes back through Opus before anything else runs.
5. Commit per WP: `phaseN(wpX): …`.
6. After the last WP: gate → reviewer → scout drafts CHANGELOG → PR. The main suites run only here: every phase ends with `pnpm typecheck && pnpm lint && pnpm test && pnpm e2e` green plus its gate; failures found then are fixed before the PR.

Scout findings that contradict the spec go into `docs/research-notes.md` (spec stays as-is). Non-blocking review findings go into the "Open findings" table of the phase that will fix them; once fixed, move them to [archive.md](archive.md).

**WP brief template** (Opus → builder)

```markdown
## WP <id> — <title>
Goal: <one sentence, user-visible outcome>
Read first: CLAUDE.md · docs/plan/phase-N.md §<sections> (+ data-model.md / design.md if needed) · docs/research-notes.md §<sections>
Files (create/modify): <explicit list>; anything else = ask first
Inputs/contracts: <types, signatures, columns, props the WP must honor>
Constraints: <CLAUDE.md rules that matter here, perf limits, libs to use/not use>
Acceptance checks:
- [ ] <command or test that must pass>
- [ ] <observable behavior>
Out of scope: <things a builder might be tempted to do>
```

Scout briefs are one paragraph: question, where to look, word budget, required citations.

**Kickoff prompt** (paste at the start of a phase)

```
Phase N. You are the orchestrator (Opus). Read CLAUDE.md, docs/plan/README.md,
docs/plan/phase-N.md and docs/research-notes.md (data-model.md / design.md only if needed).
1. Send scouts for anything Phase N needs verified that research-notes doesn't cover.
2. Write the WP briefs, then run builders WP by WP (parallel only where marked ∥, in worktrees).
3. Review each WP (reviewer agent for auth/RLS/SSRF/storage/ordering/canvas-save WPs), commit per WP.
4. Run the gate, have a scout draft the CHANGELOG entry, push phase-N-<slug> and open a PR.
Stop and ask me only for owner actions or a decision that changes the spec.
```

**Process notes**

- Playwright `reuseExistingServer` can pick up a stale server without `STYLEGUIDE=1`; stop stray servers before e2e.
- Canvas perf gate: `CANVAS_PERF=1 pnpm exec playwright test e2e/canvas-perf.spec.ts` logs frame times for 300 enriched cards (`CANVAS_PERF_COUNT`, `CANVAS_PERF_PENDING` vary it).
- Plain `pnpm e2e` in cloud sessions needs `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.

## Owner actions (need your accounts or secrets)

| # | Action | Needed by | Notes |
| --- | --- | --- | --- |
| O1 | GitHub `main` branch protection / PR flow | Phase 0 PR | One PR per phase |
| O2 | Supabase cloud project; provide `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | Production (local uses `supabase start`) | Secret key only for `/api/cron/*`. Auth settings: keep **Confirm email ON** (else a guest's `updateUser({ email })` auto-confirms any address); enable anonymous sign-ins and manual identity linking; paste the three templates from `supabase/templates/`; **Site URL** = production origin; redirect allow-list `https://<prod>/auth/callback` (+ previews); review OTP frequency and rate limits. Don't copy local-only settings: `skip_nonce_check` stays off; `double_confirm_changes = false` is deliberate |
| O3 | Google OAuth client (web), redirect `https://<project>.supabase.co/auth/v1/callback`; enable Google in Supabase Auth | Google sign-in / linking | Local skips Google. Once done: `linkIdentity` conflict (`identity_already_exists`) shows the generic callback error at `/auth/callback`; pass the provider error code through to `/login` |
| O4 | Cloudflare Turnstile site + enable CAPTCHA in Supabase Auth | Production | Local/e2e uses always-pass test keys |
| O5 | Brevo SMTP into Supabase Auth; OTP template with `{{ .Token }}` | Production | Local uses the mail catcher |
| O6 | Vercel project, env vars, `CRON_SECRET` | Phase 8 deploy | Hobby plan, daily cron |

## Architecture

The browser talks to Supabase directly for all CRUD and uploads, under RLS. Next.js server code only does what the browser can't do safely.

- **Server Components:** app shell, first 50 items prefetched and hydrated into TanStack Query.
- **Client Components:** board, cards, DnD, drawer, palette, upload pipeline.
- **Route Handlers:** `POST /api/unfurl` (SSRF-safe fetch + parse), `GET /auth/callback`, `/api/cron/daily` (trash purge, guest cleanup; only place with the secret key).
- **`proxy.ts`** (Next 16's `middleware.ts`): refreshes the session cookie, redirects unauthenticated users away from `/app`.
- **Storage:** browser uploads with the user's JWT, so files never pass through Vercel functions (≈4.5 MB body limit).

Libraries beyond the CLAUDE.md stack: `fractional-indexing` (ordering), `linkedom` (unfurl parsing), `pdfjs-dist` (PDF thumbnails), `cmdk`, `sonner`, `vaul`, `lucide-react`, `zod`.

**Routes**

| Route | Screen |
| --- | --- |
| `/` | Landing: aurora hero, "Try without an account" + "Sign in", reference-style footer |
| `/login` | Email OTP code + Google |
| `/auth/callback` | Google OAuth code exchange |
| `/app` | Inbox (items without collection) |
| `/app/all`, `/unread`, `/favorites`, `/archive`, `/trash` | System views |
| `/app/f/[kind]` · `/app/c/[collectionId]` · `/app/t/[tag]` · `/app/v/[viewId]` | Format · collection · tag · smart view |
| `/app/settings` | Account, export (JSON), danger zone |
| `/styleguide` (dev only) | Tokens, components, motion samples |

Any route + `?item=<id>` opens the detail drawer. One board page (`src/app/app/[[...view]]`) resolves the view from params; for file layout, look at `src/` rather than a list here.
