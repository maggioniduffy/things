# Things — Execution plan

How we build `docs/plan.md` (the product spec) with three models. This file is the source of truth for **who does what, in what order, and how we know it's done**. The spec says *what* to build; this says *how*.

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
Read first: CLAUDE.md · docs/plan.md §<sections> · docs/research-notes.md §<sections>
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

## 5. Spec review — changes Opus is making to the plan

Found while analysing `docs/plan.md`. These are binding for the builders; they are also mirrored in `docs/research-notes.md`.

**Security / data integrity**
1. **Cross-user foreign keys.** RLS `with check (user_id = auth.uid())` does not stop a user from pointing `items.collection_id`, `item_tags.item_id` or `item_tags.tag_id` at *someone else's* row (FK checks bypass RLS). Fix: policies' `with check` also require `exists (select 1 from collections c where c.id = collection_id)` (that subquery is itself RLS-filtered), same for `item_tags` → `items` and `tags`. Tested in WP 1.3.
2. **Guest quota trusts the client.** The trigger sums `items.file_size`, which the browser writes. Fix: enforce on the real object — a storage insert policy for anonymous users that checks the per-file size from the upload, plus the `items` trigger as the friendly first line; set the bucket `file_size_limit` to 50 MB for everyone. Exact mechanism verified by a scout in Phase 1 (storage.objects metadata timing) before WP 1.2 is briefed.
3. **SSRF via DNS rebinding.** "Resolve, check, then fetch" re-resolves at connect time. Fix: pin the checked IP — do the check inside the HTTP client's `lookup` hook (undici `Agent({ connect: { lookup } })`) so the address that is connected to is the one that was checked; redirects handled manually (`redirect: 'manual'`, max 3). Allowlist instead of blocklist: after `ipaddr.process()` (unwraps IPv4-mapped IPv6) accept only `range() === 'unicast'`; also reject non-80/443 ports. See research-notes.
4. **Unfurl cache vs custom fetch.** Next's fetch cache doesn't apply to an undici-agent fetch. Cache parsed results instead (`unfurl_cache(url_hash, payload, fetched_at)` table read under RLS-free security-definer function, or simply per-user in TanStack Query + 24 h `Cache-Control` on the response). Decision: response cache header + skip the server cache in v1 — simplest, and the 60/h rate limit bounds abuse.
5. **`search_path` in SQL functions.** `f_unaccent`, `search_items`, `save_canvas_layout` and triggers get `set search_path = ''` and fully qualified names (`extensions.similarity`, `public.items`) — Supabase's linter flags mutable search paths and the `%` operator lives in `extensions`.
6. **`updated_at`** needs a `before update` trigger (`moddatetime` or a small plpgsql function); the spec only sets it in the canvas RPC.

**Sequencing**
7. **Trash purge needs a cron in Phase 4**, not Phase 8. One route `/api/cron/daily` (secret-key client, `CRON_SECRET`) does both trash purge (≥30 days) and, from Phase 8, guest cleanup. Storage files are deleted through the Storage API (deleting `storage.objects` rows in SQL is blocked/leaves orphans), then rows.
8. **dnd-kit × Motion spike first in Phase 5** (WP 5.0): 200 cards, sortable + `layout`, before building on it — the spec lists it as a risk; we retire it before it costs a rewrite.
9. **Canvas perf harness built with the canvas** (WP 6.1 seeds 300 items), not at the end.

**Testability**
10. **Auth e2e without real email**: local Supabase ships a mail catcher (Mailpit/Inbucket); Playwright reads the 6-digit code from its HTTP API. Turnstile uses Cloudflare's test keys (`1x00000000000000000000AA` / `1x0000000000000000000000000000000AA`) in dev and CI.
11. **SQL tests** with pgTAP via `supabase test db` (supabase/tests/*.sql) — RLS isolation, quota trigger, search accent/typo cases.
12. **CI from day one** (WP 0.1): GitHub Actions running typecheck, lint, unit tests; a second job runs `supabase start` + `supabase test db` + Playwright from Phase 1 on.

**Environment (cloud sessions)**
13. Docker is installed but the daemon is not running by default; `dockerd &` starts it. Pulling from `public.ecr.aws` hit a rate limit ("Data limit exceeded") while Docker Hub worked — WP 1.0 points the Supabase CLI at Docker Hub images if ECR fails. Fallback if the stack still won't start: plain Postgres 16 (installed, with `pg_trgm`/`unaccent`) plus a tiny `auth` schema shim (`auth.uid()`, `auth.jwt()`, `auth.users`) for SQL/RLS tests only.

## 6. Phases and work packages

Legend: **S** = scout (Haiku) · **B** = builder (Sonnet) · **R** = reviewer (Opus) · **O** = orchestrator (Opus) · ∥ = may run in parallel with the previous WP.

### Phase 0 — Scaffold and design system
| WP | Who | Task | Key acceptance |
| --- | --- | --- | --- |
| 0.0 | S | Confirm create-next-app / shadcn / Tailwind v4 / ESLint flat config facts — **done**, see research-notes (scaffold into a subdir: create-next-app refuses non-empty dirs) | Notes cited |
| 0.1 | B | Scaffold: Next 16, pnpm, TS strict, Tailwind v4, ESLint + Prettier, Vitest + Testing Library, Playwright; scripts `dev/typecheck/lint/test/e2e`; `.github/workflows/ci.yml`; `.env.example`; `CHANGELOG.md` | `pnpm typecheck && pnpm lint && pnpm test && pnpm build` green; CI green |
| 0.2 | B | Tokens in `globals.css` `@theme`; fonts via `next/font` (Inter + Inter Tight); `<Grain />`, `<Aurora />`, `<Logo />` in `components/brand` | No raw hex outside `globals.css` (scout grep); reduced-motion stops drift |
| 0.3 | B ∥ | shadcn init; restyle Button (primary/secondary/ghost), IconButton, Input, SearchField, Dialog, Drawer (vaul), DropdownMenu, ContextMenu, Tooltip, Kbd, Badge, Toast (sonner), Command (cmdk), Skeleton | Each renders with tokens; keyboard focus visible |
| 0.4 | B | `/styleguide` (404 in production) showing tokens, components, motion samples; landing `/` (aurora hero, two CTAs, reference-style footer) | Playwright smoke on both pages |
| 0.G | R + O | Gate: Lighthouse perf ≥ 90 on `/` (`next build && next start` + `lighthouse` CLI, scout digests report); Playwright `emulateMedia({ reducedMotion: 'reduce' })` asserts no running animations; Opus reviews screenshots of `/` and `/styleguide` | All green |

### Phase 1 — Supabase, schema, auth, guests
| WP | Who | Task | Key acceptance |
| --- | --- | --- | --- |
| 1.0 | S + O | Verify auth/storage APIs (**done**, research-notes); confirm local stack starts in this container (§5.13); storage metadata timing for quota (§5.2) | Decision recorded |
| 1.1 | B | `supabase init`; migrations: extensions, `f_unaccent`, enum, 5 tables + `unfurl_log`, indexes, `updated_at` trigger, RLS with cross-ownership checks (§5.1), `item_counts` view (security invoker), `save_canvas_layout`, `search_items` stub, all with fixed `search_path` (§5.5); `seed.sql` | `supabase db reset` clean; `supabase db lint` no errors |
| 1.2 | B | Storage bucket `things` (private, 50 MB limit) + policies; guest quota (10 MB/file, 25 MB total) per §5.2 | SQL tests below |
| 1.3 | B | pgTAP tests: user A can't select/update/delete B's rows or link to B's collection/tag/item; can't upload to B's path; guest blocked past 25 MB and 10 MB/file | `supabase test db` green |
| 1.4 | B | `lib/supabase/{client,server,proxy}.ts`, `proxy.ts` (session refresh + redirect away from `/app`), `gen types` → `src/types/database.types.ts`, env handling | Unauthed `/app` → redirect to `/login` (Playwright) |
| 1.5 | B | `/login` (email → 6-digit code → verify), Google button, `/auth/callback`, sign-out; Turnstile widget (test keys locally); landing "Try without an account" → anonymous sign-in → `/app` | e2e: OTP login via mail catcher |
| 1.6 | B | `GuestBanner` (+ reminder after 10 saves), `UpgradeDialog`: email (`updateUser` → `verifyOtp` `email_change`) and Google (`linkIdentity`); conflict message when the identity already exists | e2e: guest saves an item, upgrades by email, same `user.id`, item still there |
| 1.G | R + O | Gate: the four "done when" checks of Phase 1; reviewer focuses on RLS + storage policies | All green |

### Phase 2 — App shell and data layer
| WP | Who | Task | Key acceptance |
| --- | --- | --- | --- |
| 2.1 | B | `QueryProvider` (+ hydration), `stores/ui-store.ts` (selection, view mode, filters, palette, drag), `lib/views.ts`: `[[...view]]` params → `ViewSpec` (pure, unit-tested) | Unit tests for every route in the routes table |
| 2.2 | B | `lib/items/queries.ts`: list by `ViewSpec` (keyset pagination, 50/page, sort modes), counts from `item_counts`; server prefetch of page 1 + `HydrationBoundary` | Unit tests on query builder; no client waterfall on first load |
| 2.3 | B | `app/app/layout.tsx` shell; Sidebar (system views, formats with counts only when > 0, collections, tags, smart views), Toolbar (search placeholder, sort, grid/list/canvas toggle with canvas disabled), empty states with aurora | Playwright: switching views keeps the same document (no full reload); counts match seeded DB |
| 2.G | R + O | Gate | Green |

### Phase 3 — Capture
| WP | Who | Task | Key acceptance |
| --- | --- | --- | --- |
| 3.1 | B | `lib/items/detect-kind.ts` + table-driven tests from the spec's kind table (+ edge cases: `youtu.be`, query strings, uppercase extensions, `text/markdown`) | 100% branch coverage of the function |
| 3.2 | B ∥ | `/api/unfurl`: zod input, session required, `unfurl_log` 60/h, `lib/unfurl/fetch-safe.ts` (§5.3), `parse.ts` (linkedom, `<head>` only, 1 MB cap), `providers.ts` (YouTube/Vimeo oEmbed), article detection | Tests reject `127.0.0.1`, `169.254.169.254`, `[::1]`, `[::ffff:127.0.0.1]`, `2130706433`, redirect-to-private, port 22; fixture HTML parses |
| 3.3 | B ∥ | `lib/items/upload.ts` (standard ≤ 6 MB, TUS above, progress), `thumbnails.ts` (image → WebP 480, PDF page 1 via pdfjs worker, video frame at 1 s), signed-URL batching hook | Unit tests with fixtures; 50 MB client limit toast |
| 3.4 | B | `lib/items/mutations.ts`: optimistic create (link/note/file) → enrich patch, `enrich_status` + retry; notes | Optimistic card appears before network resolves (test with delayed mock) |
| 3.5 | B | `capture/`: `PasteListener`, `ExternalDropZone` + `DropOverlay` (aurora), `QuickAdd` (⌘K "Add" / + button) | Playwright: paste URL/text/image, drop file |
| 3.G | R + O | Gate: YouTube URL, blog URL, PDF, image, text → right kind + enriched card ≤ 3 s; SSRF cases rejected. Reviewer focus: SSRF + upload paths | Green |

### Phase 4 — Browse
| WP | Who | Task | Key acceptance |
| --- | --- | --- | --- |
| 4.1 | B | `cards/` per kind (Link, Video, Image, Pdf, Note, File) + `ItemGrid`, `ItemList` | Storybook-free: styleguide section lists every card state (pending, done, failed) |
| 4.2 | B | `ItemDrawer` via `?item=`: previews (image lightbox, PDF iframe from signed URL, video embed, link card, note editor), editable title/note/collection/tags, metadata, actions | `?item=` survives reload (Playwright) |
| 4.3 | B | State mutations: read on open, favorite, archive, trash with Undo toast (inverse mutation) | Optimistic + rollback tests |
| 4.4 | B | `/api/cron/daily` (§5.7): purge trash ≥ 30 days (storage first, then rows), `CRON_SECRET` bearer check; `vercel.json` cron | Route test: 401 without secret; purges only old trashed rows |
| 4.G | R + O | Gate: every kind in grid, list and drawer | Green |

### Phase 5 — Organize and drag-and-drop
| WP | Who | Task | Key acceptance |
| --- | --- | --- | --- |
| 5.0 | B | **Spike** (§5.8): 200 sortable cards with Motion `layout` disabled during drag; measure; Opus decides pattern | Pattern recorded in research-notes |
| 5.1 | B | Collections CRUD (emoji, aurora color) + tags CRUD; inline `#tag` parsing in title/note inputs | Optimistic CRUD tests |
| 5.2 | B | `lib/order.ts` (fractional-indexing wrappers) + sortable grid/list (manual sort only), `DragOverlay`, keyboard sensor | Reorder = one-row update (assert request count); persists after reload |
| 5.3 | B | Multi-select (⌘/Shift-click) + drag one/many to sidebar targets (collection, tag, Favorites, Archive, Trash); one optimistic batch mutation | 5 cards → collection in one mutation |
| 5.4 | B | Sidebar reorder (collections, smart views); smart-view builder: zod `Rules` → `lib/filters.ts` → query (unit-tested) | Rules round-trip tests |
| 5.G | R + O | Gate incl. keyboard DnD | Green |

### Phase 6 — Canvas
| WP | Who | Task | Key acceptance |
| --- | --- | --- | --- |
| 6.1 | B | `CanvasView` (React Flow) for Inbox + collections, `ItemNode` reusing cards, default sizes by kind, `autoPlace()` pure function (tested), dot grid, minimap toggle, `onlyRenderVisibleElements` > 300; seed script with 300 items | Renders seeded 300 |
| 6.2 | B | Layout persistence: pending map + 400 ms debounce → `save_canvas_layout`; rollback + toast; viewport save (1 s debounce; collections → DB, Inbox → localStorage) | Positions/sizes/viewport persist after reload (Playwright) |
| 6.3 | B | Drops/pastes at position (`screenToFlowPosition`), double-click note, resize (min 160×120), z-order `]`/`[`, snap 8 px, shortcuts table, `M` move via context menu | Shortcut tests |
| 6.4 | B | Copy/paste (plan §Canvas): ⌘C/⌘V/⌘D + context menu; in-app clipboard (Zustand) + plain-text system clipboard with fallback to normal paste; batch insert (tags copied, file items via `storage.copy()`, guest quota respected); Undo toast; works across canvases | Playwright: copy 3 cards, paste in another collection at the cursor with the same relative layout, Undo removes them; a copied file still opens after the original is purged from Trash |
| 6.G | R + O | Gate: 300 cards at 60 fps (Playwright trace; scout digests), canvas moves never touch `position` | Green |

### Phase 7 — Search and command palette
| WP | Who | Task | Key acceptance |
| --- | --- | --- | --- |
| 7.1 | B | `search_items(q, rules, lim)` migration (FTS ∪ trigram, ranked, rules applied, security invoker) + pgTAP | "cancion" → "Canción"; one-char typo matches |
| 7.2 | B | Debounced search field (`/`), filter chips (kind, tag, domain, status) synced to URL, `CommandPalette` (results, actions, navigation) | Playwright |
| 7.3 | B | `hooks/use-shortcuts.ts` with chord support (`G` then `I/A/F`), all global shortcuts | One test per shortcut |
| 7.4 | S | Sweep: build a matrix of every shortcut in both spec tables vs. implementation + tests; report gaps | Zero gaps |
| 7.G | R + O | Gate | Green |

### Phase 8 — Motion, polish, release
| WP | Who | Task | Key acceptance |
| --- | --- | --- | --- |
| 8.1 | B | Motion pass per the motion spec table; `MotionConfig reducedMotion="user"` | Reduced-motion e2e |
| 8.2 | B ∥ | Responsive: drawer → bottom sheet (vaul), canvas pan/zoom + tap to open, sidebar as sheet | Playwright mobile viewport |
| 8.3 | B | a11y: `@axe-core/playwright` on every route; focus rings, DnD announcements, contrast fixes; scout digests axe output between rounds | 0 critical |
| 8.4 | B | PWA manifest + icons, error boundaries (`error.tsx`, `global-error.tsx`), guest cleanup added to `/api/cron/daily` (inactive 30 days, files then `auth.admin.deleteUser`) | Route tests |
| 8.5 | B | 500-item grid drag at 60 fps; virtualize (`@tanstack/react-virtual`) only if the trace says so | Trace digest |
| 8.G | R + O | Gate + production deploy (needs O2–O6); smoke test on the live URL | Live |

## 7. Session kickoff prompt (paste at the start of each phase)

```
Phase N. You are the orchestrator (Opus). Read CLAUDE.md, docs/orchestration.md §1–3 and Phase N,
docs/plan.md sections for Phase N, and docs/research-notes.md.
1. Send scouts for anything Phase N needs verified that research-notes doesn't cover.
2. Write the WP briefs for Phase N using the template, then run builders WP by WP
   (parallel only where marked ∥, in worktrees).
3. Review each WP (reviewer agent for auth/RLS/SSRF/storage/ordering/canvas-save WPs), commit per WP.
4. Run the phase gate, have a scout draft the CHANGELOG entry, push branch phase-N-<slug> and open a PR.
Stop and ask me only for owner actions (§4) or a decision that changes the spec.
```

## 8. Status

| Phase | Status | PR |
| --- | --- | --- |
| Plan + orchestration | done | maggioniduffy/things#1 |
| 0 Scaffold & design system | done (gate passed: Lighthouse 96/100, e2e 13/13) | WP 0.1 in #1; WP 0.2–0.4 next PR |
| 1 Supabase, auth, guests | done (gate passed after open-redirect fix) | Phase 1 PR |
| 2 Shell & data layer | done (gate passed after cache-isolation fix) | maggioniduffy/things#5 |
| 3 Capture | done (gate passed after concurrent-capture and rollback fixes) | Phase 3 PR |
| 4 Browse | next | |
| 5 Organize & DnD | | |
| 6 Canvas | | |
| 7 Search & palette | | |
| 8 Polish & release | | |

## 9. Carried-over findings

From the Phase 0 gate review (non-blocking). Each lands in the WP named.

| Finding | Fix in |
| --- | --- |
| `Tooltip` creates its own Provider per instance, which breaks Radix skip-delay grouping; move to one app-level `TooltipProvider` | WP 2.3 (shell/toolbar) |
| `transition-colors` animates `outline-color`, so the focus ring flashes for 150 ms on focus; transition only bg/border/text | WP 2.3 |
| Menu/command highlighted row is 1.13:1 against the menu surface; strengthen the highlight | WP 7.2 (palette) |
| Styleguide lacks derived `rounded-sm…xl`, `CommandDialog`, bottom drawer, sub-menus, radio items | WP 7.2 / 8.3 |
| Motion JS animations need `MotionConfig reducedMotion="user"` (CSS rule doesn't cover them) | WP 8.1 (already planned) |
| Playwright `reuseExistingServer` can pick up a stale server without `STYLEGUIDE=1`; stop stray servers before e2e | Process note |
| Google `linkIdentity` conflict (`identity_already_exists`) surfaces at `/auth/callback` as the generic callback error, not the "already has an account" copy; pass the provider error code through to `/login` | When O3 (Google) is done |
| "Sign in instead" from the upgrade conflict leaves the guest's rows orphaned until the 30-day cleanup | WP 8.4 (cleanup cron) — acceptable for v1 |
| Storage quota rejections come back as a generic HTTP 500 `DatabaseError` (message lacks `guest_quota_exceeded`); the upload client must map a 500 on a guest upload to the quota toast | WP 3.3 |
| `05_functions` foreign-id case passes via the function's own `user_id` filter rather than RLS (RLS is covered in `01`) | No action |
| Unfurl decodes every page as UTF-8; pages in windows-1252 or Shift_JIS get garbled titles (charset from `Content-Type`/`<meta charset>` is ignored) | v2 (or WP 8.x if seen in practice) |
| `unfurl_log` keeps full URLs forever; purge rows older than a day in `/api/cron/daily` | WP 4.4 |
| `createImageBitmap` decodes images at full size before the 480 px thumbnail; a 20k px image risks memory pressure — pass `resizeWidth` when the file is large | WP 8.5 |
| Any HTTP 500 on a guest upload maps to the quota toast (storage gives no distinguishable code); a real server error reads as "storage is full" | Accepted for v1 |
| Upgrade dialog lives inside `GuestBanner`, so the guest-quota toast can't offer "Add email" | WP 7.2 (palette/actions) |
| Orphaned storage objects: an upload that lands but whose response is lost, or a thumbnail uploaded before a failed final patch, stays in Storage (and counts toward the guest quota) with no row; sweep `{user}/{item}/` folders without an `items` row in `/api/cron/daily` | WP 4.4 |
| Pending file rows left by a closed tab show "Upload didn't finish" but can't be removed yet | WP 4.3 (trash/delete) |
| "Dropping on a sidebar collection files it there directly" (plan, Capture §2) is not built; external drops always go to the current view's target | WP 5.3 (sidebar drop targets) |
| Drop overlay only fades in; the spec's "drifts up from the bottom edge" is missing | WP 8.1 (motion pass) |
| The gate's "≤ 3 s" is asserted in e2e only for links (unfurl mocked); image/PDF cases use longer timeouts on the local stack | Re-check on the deployed app, WP 8.G |
