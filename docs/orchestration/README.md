# Things — Execution plan

How we build the product spec in `docs/plan/` with three models. This file is the source of truth for **who does what, in what order, and how we know it's done**. The spec says *what* to build; this says *how*.

## 0, Rule

- Start tasks in plan mode

## 1. Roles and model routing

| Role | Model | Where | Does | Never does |
| --- | --- | --- | --- | --- |
| **Orchestrator** | Opus | Main Claude Code session | Reads the spec, splits phases into work packages (WPs), writes briefs, decides trade-offs, reviews diffs, runs phase gates, commits, opens PRs | Writes large feature code itself (small fixes after review are fine) |
| **Scout** | Haiku | `.claude/agents/scout.md` | Large-but-simple reading: package `.d.ts`/docs, codebase sweeps, test/CI/axe/Lighthouse log digests, "find every X" audits, CHANGELOG drafts from `git log` | Edits the repo; makes design decisions |
| **Builder** | Sonnet | `.claude/agents/builder.md` | Implements one WP per brief, writes its tests, runs `typecheck/lint/test` | Commits, pushes, widens scope |
| **Reviewer** | Opus | `.claude/agents/reviewer.md` | Independent check of a WP diff or a phase gate; runs the acceptance commands | Fixes what it finds |

Routing rule of thumb: *if the answer is a summary, send a scout; if the answer is code, send a builder; if the answer is a decision or a verdict, Opus does it.*

## 2. The loop (one phase = one session = one PR)

```
Opus: read CLAUDE.md + plan section + research-notes
  │
  ├─► scouts (Haiku, parallel)  → verify APIs / sweep code the phase touches → summaries
  │
Opus: write WP briefs (template §3), order them, mark which can run in parallel
  │
  ├─► builder (Sonnet) per WP  → code + tests, checks green, report
  │     (independent WPs run in parallel with isolation: worktree)
  │
Opus: read the report + diff; small fixes inline; otherwise re-brief the builder
  ├─► reviewer (Opus) on risky WPs (auth, RLS, SSRF, storage, ordering, canvas save)
  │
Opus: commit the WP ("phaseN(wpX): …")
  │
  └─ after the last WP: phase gate (§6) → reviewer → scout drafts CHANGELOG → Opus opens PR
```

Rules of the loop
- One WP in flight per file area. Parallel builders only for WPs with disjoint file lists (marked ∥ below), each in its own worktree; Opus merges.
- A builder report that says "deviated" or "blocked" goes back through Opus before anything else runs.
- Scout output that contradicts the spec gets written into `docs/research-notes.md` (the spec stays as-is; research notes win).
- Every phase ends green: `pnpm typecheck && pnpm lint && pnpm test` plus that phase's gate.
- Branch per phase: `phase-N-<slug>`, PR into `main`. Commits per WP.

## 3. WP brief template (Opus → builder)

```markdown
## WP <id> — <title>
Goal: <one sentence, user-visible outcome>
Read first: CLAUDE.md · docs/plan/phase-N.md §<sections> (+ data-model.md / design.md if needed) · docs/research-notes.md §<sections>
Files (create/modify): <explicit list>; anything else = ask first
Inputs/contracts: <types, function signatures, table columns, props the WP must honor>
Constraints: <rules from CLAUDE.md that matter here, perf limits, libs to use/not use>
Acceptance checks:
- [ ] <command or test that must pass>
- [ ] <observable behavior>
Out of scope: <things a builder might be tempted to do>
```

Scout briefs are one paragraph: question, where to look, word budget, required citations.

## 4. Owner actions (things only you can do)

These need your accounts or secrets. Each is listed with the first WP it blocks; everything before that runs locally without them.

| # | Action | Needed by | Notes |
| --- | --- | --- | --- |
| O1 | Create the GitHub `main` branch protection / accept PR flow | Phase 0 PR | One PR per phase |
| O2 | Create a Supabase cloud project (free) and provide `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` as env/secrets | Phase 1 deploy check (local dev uses `supabase start`) | Secret key only for `/api/cron/*`. In Auth settings keep **Confirm email ON** (otherwise a guest's `updateUser({ email })` is auto-confirmed and a guest could claim any address unverified — found in WP 1.6), enable anonymous sign-ins and manual identity linking, and paste the three email templates from `supabase/templates/`. Also set **Site URL** to the production origin and the **redirect allow-list** to `https://<prod>/auth/callback` (plus preview URLs), and review email OTP frequency and the auth rate limits (local dev uses relaxed values). Don't copy local-only settings: `skip_nonce_check` (Google) stays off in production; `double_confirm_changes = false` is deliberate (guests have no old address) |
| O3 | Google Cloud OAuth client (web), redirect `https://<project>.supabase.co/auth/v1/callback`; enable Google + **manual identity linking** + **anonymous sign-ins** in Supabase Auth | WP 1.6 (Google), WP 1.7 (linking) | Local dev can skip Google: OTP + guest cover the gate |
| O4 | Cloudflare Turnstile site (site key + secret) and enable CAPTCHA in Supabase Auth | Production only | Local/e2e uses Cloudflare's always-pass test keys |
| O5 | Brevo account → SMTP credentials into Supabase Auth custom SMTP; OTP template using `{{ .Token }}` | Production only | Local uses the CLI's built-in mail catcher |
| O6 | Vercel project linked to the repo; env vars; `CRON_SECRET` | Phase 8 deploy | Hobby plan, daily cron |

## 5. Phases

One file per phase: [phase-0.md](phase-0.md) … [phase-8.md](phase-8.md), each with its WP table, gate and the open findings that land there. The spec review that shaped the plan and the findings already fixed are in [archive.md](archive.md).

Legend: **S** = scout (Haiku) · **B** = builder (Sonnet) · **R** = reviewer (Opus) · **O** = orchestrator (Opus) · ∥ = may run in parallel with the previous WP.

## 6. Session kickoff prompt (paste at the start of each phase)

```
Phase N. You are the orchestrator (Opus). Read CLAUDE.md, docs/orchestration/README.md,
docs/orchestration/phase-N.md, docs/plan/README.md, docs/plan/phase-N.md and docs/research-notes.md
(docs/plan/data-model.md or design.md only if the phase touches them).
1. Send scouts for anything Phase N needs verified that research-notes doesn't cover.
2. Write the WP briefs for Phase N using the template, then run builders WP by WP
   (parallel only where marked ∥, in worktrees).
3. Review each WP (reviewer agent for auth/RLS/SSRF/storage/ordering/canvas-save WPs), commit per WP.
4. Run the phase gate, have a scout draft the CHANGELOG entry, push branch phase-N-<slug> and open a PR.
Stop and ask me only for owner actions (§4) or a decision that changes the spec.
```

## 7. Status

| Phase | Status | PR |
| --- | --- | --- |
| Plan + orchestration | done | maggioniduffy/things#1 |
| 0 Scaffold & design system | done (gate passed: Lighthouse 96/100, e2e 13/13) | WP 0.1 in #1; WP 0.2–0.4 next PR |
| 1 Supabase, auth, guests | done (gate passed after open-redirect fix) | Phase 1 PR |
| 2 Shell & data layer | done (gate passed after cache-isolation fix) | maggioniduffy/things#5 |
| 3 Capture | done (gate passed after concurrent-capture and rollback fixes) | Phase 3 PR |
| 4 Browse | WP 4.1–4.4 done; gate, CHANGELOG and PR next | |
| 5 Organize & DnD | done (gate passed after smart-view input and sidebar-handler fixes) | Phase 5 PR |
| 6 Canvas | WP 6.1–6.2 done (6.2 reviewed, fixes in); 6.3 next | maggioniduffy/things#14 |
| 7 Search & palette | | |
| 8 Polish & release | | |

## 8. Process notes

| Finding | Fix in |
| --- | --- |
| Playwright `reuseExistingServer` can pick up a stale server without `STYLEGUIDE=1`; stop stray servers before e2e | Process note |
| Google `linkIdentity` conflict (`identity_already_exists`) surfaces at `/auth/callback` as the generic callback error, not the "already has an account" copy; pass the provider error code through to `/login` | When O3 (Google) is done |
| Plain `pnpm e2e` in cloud sessions needs `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium-1194/chrome-linux/chrome` | Process note |
