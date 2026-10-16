# Phase 1 — Supabase, schema, auth, guests

Product spec for one phase. Shared context: [README.md](README.md) (always), [data-model.md](data-model.md) (schema work), [design.md](design.md) (UI work). How it is built: [../orchestration/phase-1.md](../orchestration/phase-1.md).

## Build

- Supabase CLI project, migrations from the Data model section (incl. canvas columns, guest quota trigger, `unfurl_log`), RLS, bucket + storage policies, `gen types`.
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

Claude Code should check these method names and options against the current supabase-js docs in Phase 1.
