## Unreleased

### Landing

#### Changed

- Signed-in accounts that open the landing page (`/`) are redirected to `/app`, as on `/login`. Guests stay on the landing page.
- A visitor with a session (in practice a returning guest) sees "Open app" in the header and as the hero's primary button, in place of "Sign in" and "Try without an account".

### Brand assets

#### Added

- New mark (two sheared cards) in `Logo`, with `color` (default), `duo` and `mono` variants.
- App icons, favicon and Open Graph images from the Claude Design brand sheet: `src/app/icon.png`, `apple-icon.png`, `favicon.ico`, `opengraph-image.png`, `twitter-image.png`, plus `public/brand/*` (PWA icons, ink and aurora icons, `og-brand.png`) and a static web app manifest (`public/manifest.webmanifest`; it needs literal colors, which the no-raw-hex guard keeps out of `src`).
- `scripts/render-brand-assets.mjs` regenerates all PNGs from the design (Playwright Chromium).

### Phase 3 — Capture

#### Added

- Paste anywhere on the board: a pasted URL saves as a link, pasted text as a note and a pasted image as an image item. Pastes into a field or an open dialog are left alone.
- Drag files, links or text in from outside the page. An aurora "Drop to save" overlay shows while the drag is over the window, and dropping saves what it holds. Drags that start on the page are never captured, and drops while a dialog is open are ignored.
- A gesture saves at most 20 things. A list of up to 20 URL lines saves as one link each, other text saves as one note, and anything past the cap is skipped with a "Saved the first 20 items." toast.
- The toolbar's Add button opens quick add: one field for a link or a note, Enter to save, Shift + Enter for a new line, a Choose files button, and files pasted into the field are saved.
- Captures appear on the board at once and enrich in place. A capture made in a collection view goes into that collection; in any other view it goes to the Inbox, and a toast says where it went, with an Open action. The guest banner's reminder count updates right after a save.
- Links unfurl into cards with title, description, image, favicon and site name. Pages marked as articles (`og:type` article or `article:published_time`) get the article kind. YouTube and Vimeo links use oEmbed first, then the page.
- A link whose details can't be fetched shows "Couldn't fetch details" with a Retry button. A link still pending two minutes after its last update, for example after a reload, shows the same state; a file upload interrupted the same way says "Upload didn't finish".
- Files up to 6 MB upload in one request with an indeterminate progress bar; larger files upload resumably with real progress. A failed upload removes its card and shows a toast, with Retry for network and unknown errors.
- Images, PDFs and videos get a WebP thumbnail at most 480 px wide: an image is scaled down, a PDF uses its first page, and a video uses a frame at 1 s (the middle of clips under 2 s). Other kinds keep their icon.
- Kinds come from the file's MIME type, falling back to the extension when the type is empty or generic. For URLs, video hosts and code hosts win, then media and PDF extensions; any other URL, including a `.docx` URL, is a link. Text that is a URL saves as a link; other text saves as a note.
- Guest accounts can upload files up to 10 MB each and 25 MB in total; everyone is limited to 50 MB per file. Going over a limit shows a toast with the reason.
- `POST /api/unfurl` requires a session, guests included, and allows 60 requests per user per hour; after that it returns 429 with `Retry-After`. Every request counts, including blocked and failed ones.
- The unfurl fetch connects only to public unicast addresses and pins the address it checked to the connection. It re-checks each redirect (three at most), allows only ports 80 and 443 and URLs without credentials, caps the response at 1 MB, reads HTML only up to `</head>`, and gives up after 5 seconds.
- Data layer: `lib/items/detect-kind.ts`, `lib/unfurl/` (fetch-safe, parse, providers), `lib/items/upload.ts`, `thumbnails.ts`, `mutations.ts` (optimistic inserts, enrichment, retry and rollback) and `cache.ts`. New items get fractional-index positions reserved in order, so quick captures keep their order. Thumbnails are signed in one batch per page, and upload progress lives in a Zustand store.
- Tests: unfurl unit tests cover the SSRF cases (loopback, metadata, `[::1]`, `[::ffff:127.0.0.1]`, `2130706433`, port 22, DNS rebinding, a redirect to a private host, a fourth redirect), the oEmbed fallback and the shared deadline. `e2e/unfurl.spec.ts` checks 401, 400, 422 and 429 against the real route.
- Tests: upload and thumbnail unit tests cover size limits, safe object names, error mapping (a guest 500 is the quota toast), the 6 MB split, abort and thumbnail sizing. `e2e/upload.spec.ts` runs the pipeline on the local stack: a 1 MB standard upload, a 7 MB resumable upload with progress, guest quota rejections at 11 MB and past 25 MB, a 60 MB file rejected as too large, and an aborted upload that leaves no object behind. Unit tests for kind detection, mutations, clipboard handling, paste, drop, quick add and signed URLs cover the optimistic card before the network answers, rollback, the 20-item cap and the drag and paste guards. `e2e/capture.spec.ts` checks paste, drop and quick add across a reload, paste into a field, and Retry on a failed link.

#### Changed

- Node 22.19 or later is required (`package.json` engines), because undici 8 and pdfjs-dist need it.
- Dependencies added: undici, ipaddr.js, linkedom, tus-js-client, pdfjs-dist and fractional-indexing; `@vitest/coverage-v8` reports coverage for `src/lib`.
- ESLint ignores agent worktrees under `.claude/worktrees/`.

#### Fixed (review)

- The unfurl guard blocks IPv4-compatible IPv6 (`::/96`, such as `[::127.0.0.1]`), which ipaddr.js reports as unicast, and checks IP literals with `net.isIP` so they are never resolved.
- An unfurl has one 5-second deadline: oEmbed gets 2 seconds of it, and the page fallback shares the rest.
- Request bodies over 4 KB are rejected before they are parsed.
- Thumbnails are stored as `.thumb.webp` beside the item's file, not `thumb.webp`, so a user's own file can never collide with its thumbnail.
- Signed URLs refresh every 50 minutes, even in a tab that stays focused, so thumbnails don't stop loading after an hour.
- A broken PDF's pdf.js task is destroyed, and rendering times out after 10 seconds.
- Audio-only video files get no thumbnail instead of a blank one, and videos preload with `preload="auto"` so Safari produces a frame.
- The tus client no longer stores resume fingerprints in localStorage.
- Several captures at once (a 20-file drop) no longer lose their cards: the list refetches only after the last capture in the tab finishes, instead of after the first.
- A failed upload waits for its row to be deleted before the list refetches, so the card can't come back stuck as pending; if the delete fails too, the row is marked failed.
- Remote preview images load with `referrerPolicy="no-referrer"`.

#### Notes

- Cloud containers have no outbound DNS, so real-site unfurls are mocked in e2e with `page.route`; the real route is hit only for auth, SSRF and rate-limit cases. Real YouTube and blog checks are left to the deployed app (Phase 8).
- pdf.js uses the legacy build. The modern build calls `Map.prototype.getOrInsertComputed`, which Chromium 141 lacks, so rendering threw. The legacy build also covers Safari before 17.4.
- Standard uploads (up to 6 MB) can't be cancelled, because storage-js has no abort; the request finishes in the background. Resumable uploads can be aborted, and the partial object is removed.
- Unfurl has no server cache in v1, because it is a POST; the 60 per hour limit bounds the cost.
- Any HTTP 500 on a guest upload reads as "Guest storage is full", because storage gives no separate code for quota rejections.
- Unfurl decodes every page as UTF-8, so non-UTF-8 titles can come out garbled, and `unfurl_log` keeps full URLs until the daily purge lands in WP 4.4.

### Phase 2 — App shell and data layer

#### Added

- `/app/[[...view]]`: one board page for every view — Inbox, All, Unread, Favorites, Archive, Trash, formats (`/app/f/<kind>`), collections (`/app/c/<id>`), tags (`/app/t/<id>`) and smart views (`/app/v/<id>`). Unknown routes render the 404 page.
- The first page of items is fetched on the server and hydrated into TanStack Query; later pages load with keyset pagination (50 per page) as you scroll, with a "Load more" fallback.
- Sort modes (manual, newest, oldest, title) live in the URL (`?sort=`), so the server prefetch and the client agree.
- Sidebar: system views, formats that have items (with counts), collections, tags, smart views, Archive and Trash, plus the signed-in account and sign out. On phones it opens as a drawer from the toolbar.
- Toolbar: view title, sort menu, grid/list toggle (remembered per browser) and a canvas toggle that stays disabled until Phase 6. The search field is a placeholder until Phase 7.
- Aurora empty states with copy for every view, a "not found" state for unknown collections, tags and smart views, and a loading skeleton for navigations.
- Data layer: `lib/views.ts` (route ↔ `ViewSpec`, sort parsing), `lib/items/queries.ts` (view filters, keyset cursors, quoted PostgREST values), `lib/sidebar/` (counts summarized from `item_counts`, collections, tags, smart views), a per-request server `QueryClient` and a Zustand UI store.
- Tests: unit tests for routing, query building, counts, sidebar, toolbar, empty states and board states; `e2e/board.spec.ts` checks sidebar counts against seeded data, client-side navigation without a reload, sorting, 404s, pagination, view toggle and the phone drawer.

#### Changed

- Tooltips share one app-level `TooltipProvider`, so skip-delay grouping works.
- Buttons, icon buttons, inputs and the landing page's links transition only background, border and text color, so the focus ring no longer animates in.

#### Fixed (gate review)

- The browser query cache is tied to the signed-in user and cleared on sign-out, so after signing out, the next account or guest in the same tab never sees the previous account's items. Covered by `e2e/account-switch.spec.ts`.
- A failing "load more" no longer retries in a loop; it shows "Couldn't load more things." with a "Try again" button.
- The disabled canvas toggle is focusable with `aria-disabled`, so keyboard and screen-reader users get the "Canvas is coming soon" hint; the sidebar toggle no longer double-announces its state.

#### Notes

- Tag routes use the tag id, not its name, so renaming a tag never breaks a link.
- Smart views show an empty state until the smart-view builder lands (WP 5.4).
- Invalid `/app` routes show the 404 page with HTTP status 200, because the loading skeleton starts streaming before the route is validated. `/app` is private and not indexed.
- Keyset pagination was verified against local Postgres 17 with duplicate positions and timestamps, null titles and titles containing PostgREST syntax characters.

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
