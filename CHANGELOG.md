## Unreleased

### Phase 1 — Supabase, auth and guests

#### Added

- Local Supabase project in `supabase/`: config, five migrations (extensions and helpers, core tables, RLS, functions, storage), seed and email templates. Postgres 17.
- Schema: `collections`, `items`, `tags`, `item_tags`, `smart_views` and `unfurl_log`, the `item_kind` enum, `updated_at` triggers, and indexes for the board, kinds, domains, trash purge and tag lookups. A generated `search` tsvector holds unaccented lexemes, plus a trigram index on `title`.
- RLS on every table, granted to `authenticated` only. Guests are authenticated too, and nothing is granted to `anon`.
- Cross-user foreign-key checks in `with check`: `items.collection_id` and both keys of `item_tags` must point at the caller's own rows. Foreign-key checks bypass RLS, so without these a user could link to someone else's rows.
- `unfurl_log` is append-only and backs the 60-per-hour unfurl limit.
- `save_canvas_layout(layout jsonb)` RPC: security invoker with a fixed `search_path`, and it touches only the caller's items.
- `item_counts` view (security invoker) feeding the sidebar counts.
- Private `things` storage bucket (50 MB per file) with policies that tie the first path segment to the caller's user id.
- Guest quotas of 10 MB per file and 25 MB in total. An `items` trigger catches overruns early; the authoritative check is a `storage.objects` trigger (see Notes).
- pgTAP suite: 132 assertions across 8 files covering RLS isolation, anon access, functions, storage policies, guest quotas and the search column.
- Typed Supabase browser and server clients (`@supabase/ssr` `getAll`/`setAll`), a zod-validated public env, and generated database types.
- `src/proxy.ts`: refreshes the session with `getClaims()`, sends signed-out users from `/app` to `/login?next=…`, and sends signed-in non-guests away from `/login`.
- `/login`: email, then a 6-digit code (auto-submit, resend cooldown, inline errors). Also a Google button behind `NEXT_PUBLIC_AUTH_GOOGLE_ENABLED`, and "Try without an account" (anonymous sign-in).
- `/auth/callback`: OAuth code exchange that accepts only a same-origin `next`.
- `GuestBanner` and `UpgradeDialog`: a guest adds an email (confirmed with an `email_change` code) or links Google and keeps the same user id and every item. A conflict message appears when the email already has an account.
- E2E specs for the auth guard, OTP login, guest sessions and the guest upgrade; codes are read from the local Mailpit.
- `db:*` scripts: `db:start`, `db:stop`, `db:reset`, `db:test`, `db:lint`, `db:types`, `db:env` (writes `.env.local` from the running stack without printing keys).
- CI `db` job: schema lint, pgTAP and a check that the generated types match the schema. The `e2e` job now runs against a real Supabase stack.

#### Notes

- Email confirmation is required (`enable_confirmations = true`). Without it, a guest's email change is auto-confirmed, so a guest could claim any address without proving they own it. Production must keep "Confirm email" on (owner action O2).
- Captcha is off locally and in CI. The Turnstile widget renders only when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set; production enables captcha in the Supabase dashboard (O4).
- `db:start` pulls images from Docker Hub because the default registry is rate-limited from cloud containers. CI uses the default.
- The storage quota is a trigger because the storage service inserts objects as `service_role`, so the uploader can't be identified from the JWT. The trigger reads `owner_id` and the server-measured size, and takes a per-user advisory lock so parallel uploads can't each pass the sum check.
- Known gap: a Google identity conflict shows the generic callback error, not the "already has an account" message. It will be fixed when Google is enabled (O3).
- Gate review fixes: `safeNextPath` now resolves `next` against a fixed origin and rejects control characters and backslashes (a tab in `next` was an open redirect after sign-in); re-uploading a file no longer counts it twice against the guest quota; `anon` can no longer execute `save_canvas_layout`. The guest 25 MB limit and parallel-upload safety are now tested through the real Storage API.

### Phase 0 — Scaffold and design system

#### Added

- Next.js 16.4 app (React 19.3, TypeScript strict, Tailwind v4, pnpm). Requires Node 20.9 or later; CI runs Node 22.
- Landing page at `/`: aurora hero with "Try without an account" and "Sign in" calls to action, a three-step "how it works" strip, and a footer in the reference layout.
- `/login` placeholder. Sign-in arrives in Phase 1; the landing calls to action already link here.
- `/styleguide`: every color, type, radius, shadow and motion token, the brand components and every primitive. It returns 404 in production unless `STYLEGUIDE=1`.
- Design tokens in `src/app/globals.css` (`@theme`): paper, surface, ink, line and focus colors; six aurora stops; control (8px) and card (14px) radii; a five-step type scale; card shadows; motion easing and durations.
- Inter and Inter Tight via `next/font`, exposed as `font-sans` and `font-heading`.
- `<Grain />`: a fixed film-grain overlay from an inline SVG noise filter, mounted once in the root layout.
- `<Aurora />`: CSS-only iridescent hills (`hero` and `subtle` variants) with a slow, transform-only drift that stops under reduced motion.
- `<Logo />`: an original mark of three stacked chevrons, plus the wordmark.
- UI primitives in `src/components/ui/`, using token classes only: Button, IconButton, Input, SearchField, Dialog, Drawer (vaul), DropdownMenu, ContextMenu, Tooltip, Kbd, Badge, Toast (sonner, with an `undoToast` helper), Command (cmdk), Skeleton and Separator.
- Scripts: `typecheck`, `lint` (ESLint flat config), `format` / `format:check` (Prettier with the Tailwind plugin), `test` (Vitest 4 and Testing Library), `e2e` (Playwright 1.64).
- Unit tests for the primitives and brand components, plus a raw-hex guard that fails when a hex color appears outside `globals.css`.
- Playwright specs for the landing page (calls to action, no horizontal scroll at 390px, reduced motion stops the aurora, no console errors) and for the styleguide (dialog, undo toast, menus, drawer, command filtering).
- GitHub Actions CI: a `checks` job (typecheck, lint, format, unit tests, build), then an `e2e` job.
- `.env.example` listing the Supabase, Turnstile and cron secret variable names.

#### Notes

- Phase 0 gate on `/`: Lighthouse performance 96 on mobile and 100 on desktop; accessibility, best practices and SEO each scored 96 or higher.
- v1 is light only: `globals.css` has no `.dark` block.
- `--color-ink-subtle` is `#6B6B74`, not the plan's `#8B8B94`. The plan's value is only 3.1:1 on paper, below the AA minimum of 4.5:1 for 13px text; the new value is 4.8:1.
- The shadcn primitives were copied from shadcn's new-york-v4 sources on GitHub, because the shadcn registry is unreachable from the build container.
- `cn()` is extended so `tailwind-merge` knows the token font sizes and radii.
- `AGENTS.md` is generated by `next dev` and committed as-is.
- Focus ring is solid aurora violet (3.4:1 on paper) to meet WCAG 1.4.11.
