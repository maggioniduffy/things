# Phase 1 — Supabase, schema, auth, guests

Work packages for one phase. Read [README.md](README.md) first (roles, loop, brief template, status). The product spec for this phase: [../plan/phase-1.md](../plan/phase-1.md).

Legend: **S** = scout (Haiku) · **B** = builder (Sonnet) · **R** = reviewer (Opus) · **O** = orchestrator (Opus) · ∥ = may run in parallel with the previous WP.

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
