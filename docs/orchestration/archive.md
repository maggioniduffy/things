# Things — Orchestration archive

Done or settled; kept for history. Binding facts from here are mirrored in `docs/research-notes.md`.

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

## Resolved or settled findings

From the Phase 0 gate review (non-blocking). Each lands in the WP named.

| Finding | Fix in |
| --- | --- |
| `Tooltip` creates its own Provider per instance, which breaks Radix skip-delay grouping; move to one app-level `TooltipProvider` | WP 2.3 (shell/toolbar) |
| `transition-colors` animates `outline-color`, so the focus ring flashes for 150 ms on focus; transition only bg/border/text | WP 2.3 |
| Storage quota rejections come back as a generic HTTP 500 `DatabaseError` (message lacks `guest_quota_exceeded`); the upload client must map a 500 on a guest upload to the quota toast | WP 3.3 |
| `05_functions` foreign-id case passes via the function's own `user_id` filter rather than RLS (RLS is covered in `01`) | No action |
| `unfurl_log` keeps full URLs forever; purge rows older than a day in `/api/cron/daily` | WP 4.4 |
| Any HTTP 500 on a guest upload maps to the quota toast (storage gives no distinguishable code); a real server error reads as "storage is full" | Accepted for v1 |
| Orphaned storage objects: an upload that lands but whose response is lost, or a thumbnail uploaded before a failed final patch, stays in Storage (and counts toward the guest quota) with no row; sweep `{user}/{item}/` folders without an `items` row in `/api/cron/daily` | WP 4.4 |
| Pending file rows left by a closed tab show "Upload didn't finish" but can't be removed yet | WP 4.3 (trash/delete) |
| "Dropping on a sidebar collection files it there directly" (plan, Capture §2) is not built; external drops always go to the current view's target | WP 5.3 (sidebar drop targets) |
