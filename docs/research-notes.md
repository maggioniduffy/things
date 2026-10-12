# Research notes

Verified facts that **override `docs/plan.md` and model memory** where they differ. The Haiku scouts read package sources from npm (`npm pack`, read-only), and Opus reviewed and spot-checked what they found. Checked 2026-10-12. Items marked UNVERIFIED must be confirmed by the WP that first uses them.

## Pinned versions (Phase 0 installs these majors)

| Package | Version | Note |
| --- | --- | --- |
| next / eslint-config-next | 16.4.x | Node ≥ 20.9 (container has 22.22) |
| react / react-dom | 19.x | |
| tailwindcss / @tailwindcss/postcss | 4.3.x | `@theme` in `globals.css` |
| shadcn (CLI) | 4.21.x | see Phase 0 notes |
| @supabase/supabase-js | 2.117.x | |
| @supabase/ssr | 0.12.x | 0.x, so pin exact |
| supabase (CLI, devDependency) | 2.120.x | run via `pnpm supabase …` |
| @xyflow/react | 12.12.x | **not** the 13.x `next` tag |
| motion | 14.1.x | import only from `motion/react` |
| @dnd-kit/core · sortable · utilities | 6.3 · 10.0 · 3.2 | **not** `@dnd-kit/react` (0.x, pre-1.0 API) |
| @tanstack/react-query | 5.104.x | `HydrationBoundary`, `dehydrate` |
| zustand | 5.0.x | |
| zod | 4.x | use `z.uuid()`; `z.string().uuid()` is deprecated |
| fractional-indexing | 4.0.x | ESM-only |
| cmdk 1.1 · sonner 2.0 · vaul 1.1 · lucide-react 1.55 | | all declare React 19 peers |
| linkedom | 0.18.x | `parseHTML(html)` |
| ipaddr.js | 2.5.x | SSRF range checks |
| undici | 8.x | `Agent({ connect: { lookup } })` for IP pinning |
| pdfjs-dist | 6.4.x | worker at `pdfjs-dist/build/pdf.worker.mjs` |
| tus-js-client | 4.3.x | resumable uploads |
| @marsidev/react-turnstile | 1.6.x | API UNVERIFIED |
| vitest | **4.1.x (V4 tag)** | 5.0.4 is `latest` but brand new; revisit after Phase 0 |
| @playwright/test | 1.64.x | not the 1.65 alpha |
| @testing-library/react + @testing-library/dom | 16.3 + 10.x | dom is a separate install |
| @axe-core/playwright | 4.13.x | Phase 8 |
| @tanstack/react-virtual | 3.14.x | Phase 8, only if needed |

## Next.js 16 (`next@16.4.0/dist/docs/…`)

- **`proxy.ts` replaces `middleware.ts`.** It lives in `src/proxy.ts` (next to `app/`) and exports a named `proxy` function (or a default export). `config.matcher` must be static literals. It runs on the **Node runtime only**, and setting `runtime` throws. Exclude static assets in the matcher. Ref: `01-app/03-api-reference/03-file-conventions/proxy.md`.
- **Caching is opt-in.** Without `cacheComponents`, `fetch` is not cached by default. **Decision: scaffold with `--no-cache-components`.** The app is per-user and dynamic, and turning it on would also forbid the `dynamic`/`revalidate` segment configs.
- **Async request APIs.** `params`, `searchParams`, `cookies()` and `headers()` are Promises in pages, layouts and route handlers, and synchronous access is a hard error.
- `[[...view]]` optional catch-all is supported. On the bare `/app` route, `params.view` is `undefined`.
- **Turbopack** is the default for dev and build, so don't add a custom webpack config. **`next lint` is removed.** Use the ESLint CLI with a flat `eslint.config.mjs` (eslint-config-next is flat-only and needs ESLint ≥ 9). `next build` no longer lints, so CI runs `pnpm lint` separately.
- **create-next-app refuses non-empty directories.** Only `.git`, `.gitignore`, `docs`, LICENSE and similar entries are ignored, and `CLAUDE.md` and `.claude/` would conflict. `--yes` reuses saved preferences, so pass every flag. WP 0.1 command (then move the files to the repo root, keeping the existing `CLAUDE.md`, `docs/` and `.claude/`):
  ```
  pnpm create next-app@16.4.0 next-scaffold --ts --eslint --tailwind --app --src-dir \
    --import-alias "@/*" --use-pnpm --no-cache-components --no-react-compiler \
    --no-agent-feedback --disable-git --yes
  ```
  Don't pass `--agents-md`, because this repo already has `CLAUDE.md`.
- Vercel Cron is not in the Next docs. Use `vercel.json` `crons` (verify in WP 4.4).

## Supabase (`@supabase/auth-js@2.117.3`, `storage-js`, `ssr@0.12.7`)

- **Keys:** use the new names in code and env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`) and server-only `SUPABASE_SECRET_KEY` (`sb_secret_…`, only in `/api/cron/*`). New-format keys go in the `apikey` header only.
- **@supabase/ssr:** use cookie adapters with only `getAll` / `setAll(cookies, headers)`. `get/set/remove` are deprecated. In `proxy.ts` and server code, check auth with `supabase.auth.getClaims()` (verified locally via JWKS) and never trust `getSession()` on the server. Which of `getClaims` and `getUser` is recommended is ambiguous in the JSDoc. Use `getClaims` for the proxy redirect and `getUser` where a fresh user record matters (UNVERIFIED preference).
- **Auth calls (types confirmed):**
  - `signInWithOtp({ email, options: { shouldCreateUser, captchaToken } })`
  - `verifyOtp({ email, token, type: 'email' })` for login and `type: 'email_change'` for guest upgrade. The type accepts any string, so typos are not caught. Use a const.
  - `signInAnonymously({ options: { captchaToken } })`
  - `signInWithOAuth({ provider: 'google', options: { redirectTo } })` → `exchangeCodeForSession(code)` in `/auth/callback`
  - `updateUser({ email }, { emailRedirectTo })`
  - `linkIdentity({ provider: 'google', options: { redirectTo } })`
  - `signOut()` (default scope `global`, use `'local'` for "this device")
  - `captchaToken` on `verifyOtp` is deprecated. Pass it on the sign-in call.
- `User.is_anonymous?: boolean` exists, and the JWT carries `is_anonymous`.
- **Storage:** `upload(path, file, { contentType, upsert: false, cacheControl })`. `createSignedUrls(paths, 3600)` returns `[{ path, signedUrl, error }]`, so read `signedUrl`. It has no transform option, which we don't need anyway. **There is no resumable helper in storage-js**, so use `tus-js-client` against `${SUPABASE_URL}/storage/v1/upload/resumable` (endpoint and the 6 MB chunk size come from Supabase docs, UNVERIFIED here, so confirm in WP 3.3).
- `rpc()` args and returns are typed from generated `Database` types, so regenerate types after every migration.
- **CLI:** `pnpm add -D supabase`, then `pnpm supabase <cmd>`.

## Container / cloud-session environment (checked by Opus)

- Docker 29 is installed but **the daemon isn't running**. `dockerd &` starts it in about 2 s. Docker Hub pulls work. A pull from `public.ecr.aws` (the Supabase CLI's default registry) failed with "Data limit exceeded". WP 1.0 tries the CLI's registry override to Docker Hub images first. The fallback is the local Postgres 16 (`/usr/lib/postgresql/16`, `pg_trgm` and `unaccent` available) with an `auth` schema shim, for SQL and RLS tests only.
- `npm`/`pnpm` registry access works. pnpm is 10.28 and Node is 22.22.
- Chromium for Playwright is preinstalled (`PLAYWRIGHT_BROWSERS_PATH`). Don't run `playwright install`.

## UI libraries

- **React Flow 12:**
  - `useReactFlow().screenToFlowPosition({x,y})` for drop and paste placement
  - props: `onlyRenderVisibleElements`, `snapToGrid` + `snapGrid={[8,8]}`, `selectionOnDrag`, `panOnScroll`, `zoomOnScroll`, `minZoom={0.1}`, `maxZoom={2}`, `onNodeDragStop`, `onMoveEnd`
  - `<NodeResizer minWidth={160} minHeight={120} />`, `<MiniMap />`, `<Background variant={BackgroundVariant.Dots} />`
  - CSS: `import '@xyflow/react/dist/style.css'`
- **motion:**
  - `motion/react` exports `useReducedMotion`, `MotionConfig reducedMotion="user"`, `LayoutGroup` and `AnimatePresence`
  - `layoutId` works at runtime. Its typing is UNVERIFIED, so check it in the WP 0.3 styleguide sample.
- **dnd-kit:** `KeyboardSensor` + `sortableKeyboardCoordinates`, `rectSortingStrategy` for the grid, `verticalListSortingStrategy` for the list, and `DragOverlay`.
- **fractional-indexing 4:** `generateKeyBetween(a|null, b|null)` and `generateNKeysBetween(a, b, n)`. Always use the default base-62 alphabet, and never pass custom digits, because keys from different alphabets don't compare correctly. The `position` columns are `collate "C"` to match.
- **shadcn 4.21 init:** there is no `--base-color` flag. Use `pnpm dlx shadcn@4.21 init -t next -b radix` (Radix primitives, needed for ContextMenu and DropdownMenu). Base color is forced to neutral, and we override everything with our tokens anyway. Confirm the generated CSS uses Tailwind v4 `@theme inline`.
- **pdfjs-dist 6:** set `GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString()` in a client-only module, and load it lazily.
- **ipaddr.js:** `ipaddr.process(ip)` unwraps IPv4-mapped IPv6. Allow only `range() === 'unicast'` and reject everything else (private, loopback, linkLocal, carrierGradeNat, uniqueLocal, 6to4, teredo, reserved, and so on). This allowlist is simpler and safer than a blocklist.
- **zod 4:** `z.uuid()`, `z.url()` and `z.email()` are top-level. Update the plan's `Rules` schema to use `z.array(z.uuid())`.
