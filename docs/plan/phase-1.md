# Phase 1 — Supabase, schema, auth, guests

Shared rules, loop and status: [README.md](README.md). Schema: [data-model.md](data-model.md). Spec-review items (#N) are in [archive.md](archive.md).

## Build

- Supabase CLI project, migrations from [data-model.md](data-model.md) (incl. canvas columns, guest quota trigger, `unfurl_log`), RLS, bucket + storage policies, `gen types`.
- `@supabase/ssr` clients, `proxy.ts`, `/login` with email OTP + Google, `/auth/callback`, sign-out.
- Brevo as custom SMTP + OTP email template; Turnstile on OTP and guest sign-in; anonymous sign-in; GuestBanner + UpgradeDialog (email and Google linking).
- **Done when:** a SQL test proves user A cannot read, update or upload into user B's rows/paths; OTP login works end-to-end; a guest saves items, adds an email, and keeps every item under the same user id; a guest is blocked past 25 MB.

## Spec

**Guest mode (no account)**

"Try without an account" on the landing calls Supabase anonymous sign-in, so guests use the same database, RLS and code path as everyone else. A persistent banner offers to keep their things by adding an email (OTP) or Google, which upgrades the same user id with no data migration.

- Guest limits: 25 MB of files total, 10 MB per file, enforced by a DB trigger plus a client check.
- Cloudflare Turnstile CAPTCHA on guest sign-in and OTP requests (supported natively by Supabase Auth, free).
- Guests inactive for 30 days are deleted with their files by a daily cron.
- Why not localStorage: browser storage caps around 5 MB and can't hold files without IndexedDB, every query and mutation would need a second local implementation plus a merge on sign-up, and unfurl needs the server anyway. Anonymous auth gives the same no-signup experience with one code path. Trade-off: guests need a connection.

## Key flows

**Sign-in and guest upgrade**

1. OTP: `signInWithOtp({ email })` sends a 6-digit code (email template uses `{{ .Token }}` instead of a link) → `verifyOtp({ email, token, type: 'email' })`.
2. Google: `signInWithOAuth({ provider: 'google' })` → `/auth/callback` exchanges the code.
3. Guest: `signInAnonymously({ options: { captchaToken } })` with a Turnstile token.
4. Guest → email: `updateUser({ email })`, then `verifyOtp({ type: 'email_change' })`. Guest → Google: `linkIdentity({ provider: 'google' })` (requires manual identity linking enabled). Same user id, so every item stays.
5. If that email or Google account already has a Things account, the link fails; v1 offers to sign in to it and says guest items won't be merged (merge is v2).

Check these method names and options against research-notes.

## Work packages

| WP | Who | Task | Key acceptance |
| --- | --- | --- | --- |
| 1.0 | S + O | Verify auth/storage APIs (**done**, research-notes); confirm local stack starts in this container (#13); storage metadata timing for quota (#2) | Decision recorded |
| 1.1 | B | `supabase init`; migrations: extensions, `f_unaccent`, enum, 5 tables + `unfurl_log`, indexes, `updated_at` trigger, RLS with cross-ownership checks (#1), `item_counts` view (security invoker), `save_canvas_layout`, `search_items` stub, all with fixed `search_path` (#5); `seed.sql` | `supabase db reset` clean; `supabase db lint` no errors |
| 1.2 | B | Storage bucket `things` (private, 50 MB limit) + policies; guest quota (10 MB/file, 25 MB total) per #2 | SQL tests below |
| 1.3 | B | pgTAP tests: user A can't select/update/delete B's rows or link to B's collection/tag/item; can't upload to B's path; guest blocked past 25 MB and 10 MB/file | `supabase test db` green |
| 1.4 | B | `lib/supabase/{client,server,proxy}.ts`, `proxy.ts` (session refresh + redirect away from `/app`), `gen types` → `src/types/database.types.ts`, env handling | Unauthed `/app` → redirect to `/login` (Playwright) |
| 1.5 | B | `/login` (email → 6-digit code → verify), Google button, `/auth/callback`, sign-out; Turnstile widget (test keys locally); landing "Try without an account" → anonymous sign-in → `/app` | e2e: OTP login via mail catcher |
| 1.6 | B | `GuestBanner` (+ reminder after 10 saves), `UpgradeDialog`: email (`updateUser` → `verifyOtp` `email_change`) and Google (`linkIdentity`); conflict message when the identity already exists | e2e: guest saves an item, upgrades by email, same `user.id`, item still there |
| 1.G | R + O | Gate: the four "done when" checks; reviewer focuses on RLS + storage policies | All green |
