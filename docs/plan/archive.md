# Things — Archive

Done, settled or reference-only material. Not needed to build a phase. Binding facts from here are mirrored in `docs/research-notes.md`.

## Spec review (#1–#13)

Changes Opus made to the original spec before building. Phase files cite them as #N.

**Security / data integrity**
1. **Cross-user foreign keys.** RLS `with check (user_id = auth.uid())` does not stop a user from pointing `items.collection_id`, `item_tags.item_id` or `item_tags.tag_id` at *someone else's* row (FK checks bypass RLS). Fix: policies' `with check` also require `exists (select 1 from collections c where c.id = collection_id)` (that subquery is itself RLS-filtered), same for `item_tags` → `items` and `tags`. Tested in WP 1.3.
2. **Guest quota trusts the client.** The trigger sums `items.file_size`, which the browser writes. Fix: enforce on the real object — a storage insert policy for anonymous users that checks the per-file size from the upload, plus the `items` trigger as the friendly first line; bucket `file_size_limit` 50 MB for everyone. Mechanism verified in Phase 1 (see research-notes).
3. **SSRF via DNS rebinding.** "Resolve, check, then fetch" re-resolves at connect time. Fix: check inside the HTTP client's `lookup` hook (undici `Agent({ connect: { lookup } })`) so the connected address is the checked one; redirects manual (`redirect: 'manual'`, max 3). Allowlist: after `ipaddr.process()` (unwraps IPv4-mapped IPv6) accept only `range() === 'unicast'`; reject non-80/443 ports.
4. **Unfurl cache vs custom fetch.** Next's fetch cache doesn't apply to an undici-agent fetch. Decision: no server cache in v1; the 60/h rate limit bounds abuse.
5. **`search_path` in SQL functions.** `f_unaccent`, `search_items`, `save_canvas_layout` and triggers get `set search_path = ''` and fully qualified names (`extensions.similarity`, `public.items`).
6. **`updated_at`** needs a `before update` trigger; the spec only set it in the canvas RPC.

**Sequencing**
7. **Trash purge cron in Phase 4**, not Phase 8. One route `/api/cron/daily` (secret-key client, `CRON_SECRET`) does trash purge (≥ 30 days) and, from Phase 8, guest cleanup. Storage files are deleted through the Storage API, then rows.
8. **dnd-kit × Motion spike first in Phase 5** (WP 5.0), before building on it.
9. **Canvas perf harness built with the canvas** (WP 6.1 seeds 300 items), not at the end.

**Testability**
10. **Auth e2e without real email**: Playwright reads the 6-digit code from the local mail catcher's HTTP API. Turnstile uses Cloudflare's test keys (`1x00000000000000000000AA` / `1x0000000000000000000000000000000AA`) in dev and CI.
11. **SQL tests** with pgTAP via `supabase test db` (`supabase/tests/*.sql`) — RLS isolation, quota trigger, search accent/typo cases.
12. **CI from day one** (WP 0.1): typecheck, lint, unit tests; a second job runs `supabase start` + `supabase test db` + Playwright from Phase 1 on.

**Environment (cloud sessions)**
13. Docker daemon is not running by default; `dockerd &` starts it. `public.ecr.aws` hit a rate limit while Docker Hub worked — point the Supabase CLI at Docker Hub images if ECR fails. Fallback: plain Postgres 16 (with `pg_trgm`/`unaccent`) plus a tiny `auth` schema shim for SQL/RLS tests only.

## Resolved findings

| Finding | Fixed in |
| --- | --- |
| `Tooltip` creates its own Provider per instance, breaking Radix skip-delay grouping; one app-level `TooltipProvider` | WP 2.3 |
| `transition-colors` animates `outline-color`, so the focus ring flashes on focus; transition only bg/border/text | WP 2.3 |
| Storage quota rejections come back as a generic HTTP 500 `DatabaseError`; the upload client maps a 500 on a guest upload to the quota toast | WP 3.3 |
| `05_functions` foreign-id case passes via the function's own `user_id` filter rather than RLS (RLS covered in `01`) | No action |
| `unfurl_log` kept full URLs forever; purge rows older than a day in `/api/cron/daily` | WP 4.4 |
| Any HTTP 500 on a guest upload maps to the quota toast; a real server error reads as "storage is full" | Accepted for v1 |
| Orphaned storage objects (lost upload response, thumbnail before a failed patch); sweep `{user}/{item}/` folders without a row in `/api/cron/daily` | WP 4.4 |
| Pending file rows left by a closed tab couldn't be removed | WP 4.3 |
| "Dropping on a sidebar collection files it there directly" wasn't built | WP 5.3 |
| A canvas save fired on `pagehide` had no `keepalive`, so a reload right after a drag could lose it | WP 6.2 review fixes |

## Costs and limits

v1 is designed to run at $0 for one person; the main limits are Supabase Free's storage and inactivity pausing. Figures from memory — verify on pricing pages.

| Service | Free tier (approx.) | Impact on Things |
| --- | --- | --- |
| Supabase Free | 500 MB database, 1 GB file storage, 50 MB max file size; pauses after \~1 week inactive | Storage is the first ceiling, shared with guests (hence the 25 MB guest quota). Pro is \~US$25/month |
| Supabase image transforms | Paid plans only | Avoided: thumbnails generated in the browser |
| Vercel Hobby | Non-commercial; \~4.5 MB function body limit; daily cron only | Uploads bypass functions; cron runs daily |
| Brevo (custom SMTP) | 300 emails/day; may carry Brevo branding | Plenty for OTP codes |
| Cloudflare Turnstile | Free | Bot protection on guest and OTP sign-in |
| React Flow | MIT; small attribution link by default | Keep the link, or Pro if hidden in a commercial product |

## Risks (original assessment)

| Risk | Mitigation |
| --- | --- |
| Canvas with many image cards gets heavy | 480px thumbnails, `onlyRenderVisibleElements`, 300+ node test in Phase 6 |
| dnd-kit and React Flow leak into each other | dnd-kit only in grid/list/sidebar, React Flow only on the canvas |
| dnd-kit and Motion layout animations conflict | Disable `layout` during drag; spike in Phase 5 |
| Guest abuse (spam sign-ups, storage, unfurl as a proxy) | Turnstile, 25 MB guest quota, 60/hour unfurl limit, 30-day cleanup |
| Guests lose data by clearing cookies | Banner plus a reminder after 10 saves |
| SSRF through `/api/unfurl` | #3, Phase 3 tests |
| Sites blocking unfurl (X, Instagram, paywalls) | Fallback card: domain + favicon + editable title |
| Remote og:images break over time | v2: copy og:image into Storage on save |
| Supabase free project pauses | Cold wake-up after a week idle; Pro removes it |

## Decisions (2026-10-12)

| Decision | Choice |
| --- | --- |
| "Formato libre" | Any content format + grid/list + infinite canvas per collection, all in the MVP |
| Collections | One collection per item, many tags |
| Auth | Email OTP code + Google; no magic link, no GitHub |
| No-account use | Guest mode via Supabase anonymous sign-in, upgradable to email or Google |
| Landing page | Yes, at `/`, with "Try without an account" |
| AI auto-tagging | Out of the MVP |
| UI language | English only |

## v2 backlog

Bookmarklet and browser extension · Android share target (Web Share Target API) · article text extraction for full-text search · AI auto-tagging and semantic search (pgvector) · canvas connectors, frames and groups · realtime sync · public shared collections · merging guest data into an existing account · reader mode, resurfacing · email-in.
