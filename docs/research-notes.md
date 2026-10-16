# Research notes

Verified facts that **override the spec in `docs/plan/` and model memory** where they differ. The Haiku scouts read package sources from npm (`npm pack`, read-only), and Opus reviewed and spot-checked what they found. Checked 2026-10-12. Items marked UNVERIFIED must be confirmed by the WP that first uses them.

## Pinned versions (Phase 0 installs these majors)

| Package | Version | Note |
| --- | --- | --- |
| next / eslint-config-next | 16.4.x | Node ≥ 20.9 for Next itself; the repo needs ≥ 22.19 since Phase 3 (undici 8). Container has 22.22 |
| react / react-dom | 19.x | |
| tailwindcss / @tailwindcss/turbopack | 4.3.x | `@theme` in `globals.css`; the Next 16.4 scaffold wires Tailwind via a `turbopack.rules` loader in `next.config.ts`, not PostCSS |
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

## Design token adjustments (Phase 0 gate)

- `--color-ink-subtle` is `#6B6B74`, not the plan's `#8B8B94`. The plan's value is only 3.1:1 on paper, which fails WCAG AA for 13px meta text; `#6B6B74` gives 4.8:1 on paper and 5.3:1 on white.

## Phase 1 — local stack and storage quota (verified by Opus, WP 1.0)

- **Local Supabase works in cloud containers**: start Docker (`dockerd &`), then
  `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io pnpm supabase start -x studio,imgproxy,vector,logflare,edge-runtime,supavisor,realtime,postgres-meta`
  (default registry `public.ecr.aws` is rate-limited here). Postgres 17, API on 54321, DB on 54322, Mailpit on 54324. Local keys are the well-known demo keys printed by `supabase status`.
  If Docker Hub also answers `429 Too Many Requests` (seen in Phase 5), pull the missing image from Google's Docker Hub mirror and retag it, e.g. `docker pull mirror.gcr.io/supabase/postgres:<tag> && docker tag mirror.gcr.io/supabase/postgres:<tag> supabase/postgres:<tag>`, then run `supabase start` again.
- **Storage quota mechanism (resolves spec review #2, docs/plan/archive.md)**: probed with a trigger on `storage.objects`:
  - The final object row is inserted by the storage service as `service_role` — `auth.jwt()` inside a storage trigger does **not** identify the user, so RLS-style checks on JWT claims can't enforce quotas there.
  - At `BEFORE INSERT`, `NEW.metadata->>'size'` already holds the **real byte size** (server-measured) and `NEW.owner_id` holds the uploader's user id.
  - **Decision**: enforce the guest quota with a `BEFORE INSERT OR UPDATE` trigger on `storage.objects` (bucket `things`): look up `auth.users.is_anonymous` by `owner_id`; reject if the file > 10 MB or the owner's existing `things` objects + this file > 25 MB. Raising an exception fails the upload. The `items` trigger on `file_size` stays as the friendly early check (it can be lied to; the storage trigger cannot). Thumbnails count toward the quota (they're small; acceptable).
  - TUS resumable uploads are expected to end in the same insert; WP 3.3 must confirm with a >6 MB guest upload test.

## Phase 1 — auth wiring (scout report, Opus decisions)

- **config.toml today** (`supabase init` defaults): `site_url = "http://127.0.0.1:3000"`, `additional_redirect_urls = ["https://127.0.0.1:3000"]` (https typo — fix to `http://localhost:3000/**` and `http://127.0.0.1:3000/**`), `enable_anonymous_sign_ins = false`, `enable_manual_linking = false`, `[auth.email] otp_length = 6`, `otp_expiry = 3600`, `double_confirm_changes = true`, `[auth.rate_limit] email_sent = 2` per hour (**raise to 100 locally** or OTP e2e will be throttled), `anonymous_users = 30`/h/IP. `env(NAME)` substitution for secrets.
- **Email templates** (Opus, from Supabase docs knowledge — UNVERIFIED by scout): `signInWithOtp` sends the **magic_link** template (and **confirmation** for brand-new users when confirmations are on); `updateUser({ email })` sends **email_change**. Override all three in config.toml (`[auth.email.template.<name>] subject, content_path = "./supabase/templates/<name>.html"`) using `{{ .Token }}` (6-digit code), never `{{ .ConfirmationURL }}`. With `double_confirm_changes = true` the guest→email upgrade sends codes to both old and new address; guests have no old address, so set it to `false`.
- **Google** (UNVERIFIED keys, standard pattern): `[auth.external.google] enabled = env-driven, client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)", secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)", skip_nonce_check = true` (local only). Disabled locally until owner action O3. `enable_manual_linking = true` for `linkIdentity`.
- **@supabase/ssr 0.12.7**: cookie adapter `getAll()` / `setAll(cookies, headers)`; in the proxy, call `supabase.auth.getClaims()` **before** building the final response or refreshed cookies are lost, copy `setAll` cookies **and headers** onto the `NextResponse`. Prefer `getClaims()` over `getUser()` (types.ts:113). In Server Components `cookies()` is async; wrap `setAll` in try/catch (Server Components can't set cookies; the proxy refreshes them).
- **Mailpit** (local, port 54324): `GET /api/v1/search?query=to:<email>` → `messages[].ID`; `GET /api/v1/message/{ID}` → `{ Text, HTML, Subject }`; delete by `DELETE /api/v1/messages` with `{"IDs":[…]}` (empty body deletes all — UNVERIFIED; prefer IDs). E2E reads the 6-digit code from `Text` with `/\b(\d{6})\b/`.
- **Turnstile**: `@marsidev/react-turnstile` `<Turnstile siteKey onSuccess onError onExpire options={{ size, theme, appearance }} ref />`, ref has `reset()`, `getResponse()`. Cloudflare test keys (from Cloudflare docs, Opus): site `1x00000000000000000000AA` / secret `1x0000000000000000000000000000000AA` always pass. **Decision**: captcha is **off in local dev and e2e** (GoTrue would have to call `challenges.cloudflare.com` from inside Docker, and the widget script loads from Cloudflare — both unreliable in containers). The widget renders only when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is set; `[auth.captcha]` is enabled in production via the dashboard (owner action O4). The token is passed as `options.captchaToken` on `signInWithOtp` and `signInAnonymously`.

## Phase 2 — data layer (scout report, Opus spot-checked the TanStack claims in source)

- **TanStack Query 5.104 deprecations (verified in `query-core/src/queryClient.ts:645,684`)**: `fetchQuery`, `prefetchQuery`, `fetchInfiniteQuery`, `prefetchInfiniteQuery`, `ensureQueryData` are `@deprecated` → use `queryClient.query(options)` / `queryClient.infiniteQuery(options)` (swallow errors with `.catch(noop)` when prefetching). Root `isServer` is deprecated → `environmentManager.isServer()` (exported from `@tanstack/react-query`).
- **SSR pattern**: per-request `new QueryClient()` in the Server Component → `await qc.infiniteQuery(itemsQuery(view))` → `<HydrationBoundary state={dehydrate(qc)}>`. Browser singleton via `environmentManager.isServer() ? new QueryClient() : (browserQC ??= new QueryClient())`. Set `defaultOptions.queries.staleTime` (e.g. 30 s) on **both** — dehydrated state doesn't carry staleTime, so 0 would refetch immediately after hydration. Default `shouldDehydrateQuery` keeps only successful queries.
- Share keys/fns with `queryOptions` / `infiniteQueryOptions`. Prefer `useQuery`/`useInfiniteQuery` over suspense variants for the board (needs `placeholderData` and `enabled`).
- **Optimistic mutations**: `onMutate` → `await qc.cancelQueries({ queryKey })` → snapshot `getQueryData` → `setQueryData` → return context; `onError` restores + toast; `onSettled` invalidates list + counts. `useMutationState({ filters: { mutationKey, status: 'pending' }, select: m => m.state.variables })` exists for variable-based optimistic UI.
- **Zustand 5**: module-level `create` is fine for client-only UI state (keep server/client initial values identical). `persist` + `createJSONStorage(() => sessionStorage)` + `partialize` + `skipHydration: true`, then `useUiStore.persist.rehydrate()` in an effect. `useShallow` from `zustand/react/shallow`.
- **postgrest-js 2.117**: `select('*', { count: 'exact', head: true })` → `count`; `.is(col, null)`; `.not(col, 'is', null)` narrows types; `.range(from, to)` inclusive; keyset with `.or('position.gt.X,and(position.eq.X,id.gt.Y)')`; `returns<T>()` is deprecated → `overrideTypes<T, { merge: false }>()`.
- **Next 16 routing**: under `app/app/[[...view]]/page.tsx`, the shared `layout.tsx` keeps state across view changes, but the page segment remounts when its params change (UNVERIFIED, from `template.md:65`) — so keep board UI state in Zustand/layout, filters in search params. Client components using `useSearchParams` must sit under `<Suspense>` or prerendering fails. `router.push(href, { scroll: false })`. `<Link prefetch>` defaults to `auto` (dynamic routes prefetch to the nearest `loading.tsx`).

## Phase 2 — design decisions (Opus)

- **Routes → `ViewSpec`** (`src/lib/views.ts`, pure). `/app` inbox · `/app/all|unread|favorites|archive|trash` · `/app/f/<kind>` (the `item_kind` enum value, e.g. `/app/f/pdf`) · `/app/c/<collectionId>` · `/app/t/<tagId>` · `/app/v/<viewId>`. Anything else → `notFound()`. Ids must be UUIDs (`z.uuid()`). **Tags use the id, not the name** (the plan's `[tag]`): renames don't break links and the query needs no name lookup.
- **What each view shows** (all exclude trashed rows unless noted): inbox = `collection_id is null`, not archived · all = not archived · unread = `is_read = false`, not archived · favorites = `is_favorite`, not archived · archive = archived, not trashed · trash = trashed (archived or not) · kind / collection / tag = that filter, not archived · smart view = its saved rules via `lib/filters.ts` (WP 5.4), not archived.
- **Sort** lives in the URL (`?sort=manual|newest|oldest|title`, default `manual`, invalid → default), so the server prefetch and the client agree. Manual = `position asc, id asc`; newest = `created_at desc, id desc`; oldest = `created_at asc, id asc`; title = `title asc nulls last, id asc`. Keyset pagination, 50 per page; the cursor is the last row's sort value + id. PostgREST `or()` values are double-quoted with `\` escaping (titles can contain commas and parentheses).
- **View mode** (grid/list/canvas) is per-viewer UI state: Zustand, persisted to localStorage (`skipHydration`, rehydrated in an effect). Canvas stays disabled until Phase 6.
- **Counts**: the client sums `item_counts` rows with a pure `summarizeCounts()` (unit-tested). Tags have no counts in v1.
- **Item columns**: every query selects an explicit column list without the `search` tsvector.
- **Query keys**: `['items', viewKey, sort]`, `['counts']`, `['collections']`, `['tags']`, `['smart-views']`. Query option factories take the Supabase client as an argument so the same options run on the server (prefetch) and in the browser.
- Phase 2 renders items as minimal placeholder rows/tiles (title, kind, domain); real cards are Phase 4.
- **Keyset pagination verified against local Postgres 17** (Opus, WP 2.2 follow-up): 120 rows with duplicate `position`s, duplicate microsecond `created_at`s, null titles and titles containing `, ( ) " \ .` and non-ASCII page through in exactly 3 pages for every sort, with no duplicates or gaps, in the same order as Postgres' own `order by`. PostgREST returns `timestamptz` at full microsecond precision, so `created_at` cursors are exact.
- **Cloud container e2e**: the preinstalled Chromium doesn't match Playwright 1.64's expected build; run `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/opt/pw-browsers/chromium-1194/chrome-linux/chrome pnpm e2e`. If Docker Hub answers 429, retry later or exclude unused services; Phase 2 ran without pulling `realtime`.

## Phase 3 — capture (scout reports, Opus decisions)

- **Node ≥ 22.19**: undici 8.11 declares `engines.node >=22.19.0` and pdfjs-dist 6.4 `>=22.13.0`; `package.json` engines raised to `>=22.19` (CI uses Node 22, container 22.22).
- **undici 8.11.2**: `import { Agent, fetch } from "undici"`; `fetch(url, { dispatcher, redirect: "manual", signal })`. `new Agent({ connect: { lookup } })` spreads `lookup` into `net.connect`/`tls.connect` (connect.js:67,86,128). Node 22 has `autoSelectFamily` on by default, so lookup is called with `{ all: true }` → `cb(null, [{ address, family }])`; without it → `cb(null, address, family)`. Handle both. **IP-literal hosts never call lookup**, so the guard checks the URL host itself before fetching. `redirect: "manual"` returns the real 3xx with a readable `location` (from source). `response.body` is a WHATWG stream: read with `getReader()`, count bytes, `cancel()` past the cap.
- **ipaddr.js 2.5**: `ipaddr.process()` unwraps IPv4-mapped IPv6; public addresses are `range() === "unicast"` in both families (the `.d.ts` range unions are incomplete — compare to `"unicast"`, no exhaustive switch). WHATWG `URL` already normalizes `2130706433` and `0x7f.1` to `127.0.0.1`; IPv6 `hostname` keeps the brackets (`[::ffff:7f00:1]`) — strip them before parsing.
- **linkedom 0.18.13**: `parseHTML(html)` returns a Window; `const { document } = parseHTML(html)`. Never assign properties onto that window (it writes through to `globalThis`).
- **oEmbed (UNVERIFIED, endpoints unreachable from the container)**: YouTube `https://www.youtube.com/oembed?url=<url>&format=json` (title, author_name, thumbnail_url; no duration); Vimeo `https://vimeo.com/api/oembed.json?url=<url>` (title, author_name, thumbnail_url, duration in seconds).
- **No outbound DNS in cloud containers** (egress only via the agent proxy, which the SSRF-pinned fetch deliberately does not use). Real-site unfurl can't run here: unit tests drive `fetch-safe` with an injected lookup + a local HTTP server; e2e mocks `/api/unfurl` with `page.route` for real-site cases and hits the real route only for auth, SSRF and rate-limit cases. A real YouTube/blog check happens on the deployed app (Phase 8).
- **Unfurl caching (resolves spec review #4, docs/plan/archive.md)**: `/api/unfurl` is a POST, which browsers don't cache, so v1 has no unfurl cache; the 60/h limit bounds cost.
- **storage-js 2.117.3**: `upload(path, file, { contentType, upsert, cacheControl })` returns `{ data, error }` (no throw); **no progress events**; `contentType` is ignored for Blob/File bodies (multipart part type comes from the Blob), so wrap blobs as `new File([blob], name, { type })`. Errors: `StorageApiError { status, statusCode }`. `createSignedUrls(paths, s)` → `[{ path, signedUrl, error }]`. `copy(from, to)` exists.
- **Upload progress decision**: ≤ 6 MB → `storage.upload` (indeterminate progress; small files are quick); > 6 MB → `tus-js-client` with `onProgress`. Headers `apikey: <publishable key>`, `authorization: Bearer <access token>` (refresh per request in `onBeforeRequest`). tus `chunkSize` defaults to Infinity — set it. **Confirmed on the local stack (WP 3.3)**: endpoint `${SUPABASE_URL}/storage/v1/upload/resumable`; headers `apikey`, `authorization: Bearer <access token>`, `x-upsert: false`; metadata `bucketName`, `objectName`, `contentType`, `cacheControl`; `uploadDataDuringCreation: true` works. The local stack accepts any chunk size; we keep 6 MB because the hosted docs require it. A guest over quota gets HTTP 500 `database error, code: P0001` on the PATCH (not retried — `onShouldRetry`); > 50 MB gets 413 `Maximum size exceeded`. The standard (≤ 6 MB) upload can't be cancelled (storage-js has no abort hook). tus `storeFingerprintForResuming: false` (no resume UI; keeps localStorage clean).
- **Thumbnail path is `{user_id}/{item_id}/.thumb.webp`** (not the plan's `thumb.webp`): `safeObjectName` strips leading dots, so a user file named `thumb.webp` can never collide with its thumbnail (WP 3.3 review).
- **pdfjs-dist 6.4.299**: no `exports` map. `page.render({ canvas, viewport }).promise`. **Use the legacy build** (`pdfjs-dist/legacy/build/pdf.mjs` + `legacy/build/pdf.worker.mjs`): the modern build calls `Map.prototype.getOrInsertComputed`, which Chromium 141 lacks, so `render` throws (WP 3.3, verified in Chromium); legacy also covers Safari < 17.4. Under Turbopack `new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url)` works in dev and production builds (emitted to `/_next/static/media/`), so no `public/` copy.
- **Thumbnails**: always check `blob.type` after `toBlob(…, "image/webp")` — browsers may fall back to PNG.

## Phase 5 — dnd-kit × Motion pattern (WP 5.0 spike, Opus decision)

Spike: `/styleguide/dnd-spike?mode=off-during-drag|always|none` (dev only, 200 cards). Measured on a production build in headless Chromium, at 1x and 4x CPU throttling.
- **Pattern (use in WP 5.2):** the outer `motion.li` owns `layout`. An inner element owns the `useSortable` ref, listeners and `CSS.Transform`, so the two libraries never write `transform` on the same node. `layout = anyDragActive || reducedMotion ? false : "position"`, where "any drag active" means the whole board, not just the dragged card. The `DragOverlay` renders the moving card.
- **Why:** frame cost during the drag is the same in all three modes (1x: p95 16.7 ms; 4x: p95 about 50 ms in each), so the drag cost comes from dnd-kit, not Motion. With `layout` always on, a bystander card jumps about 280 px back to its old slot on drop and then animates, because Motion's snapshot includes the dnd-kit displacement. When `layout` flips to `"position"` in the same commit as the reorder, there's no snapshot and no jump.
- **Follow-up:** on drop, the 200-item re-render costs one frame of about 280 ms at 4x CPU, so memoize sortable cards in WP 5.2. Keyboard DnD (Space, arrows, Space) works with `sortableKeyboardCoordinates` + `rectSortingStrategy`.
- **Local run note:** `next start` needs dummy `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` values, or the proxy rejects the spike page.
