# Things — Product & Build Plan

Oct 12, 2026 · @Faustino

## Overview

Things is a personal "save for later" web app: drop in any link, file or note, and it is auto-classified by format, filed by topic, and easy to find again. Usable without an account (guest mode), one user per account, Next.js + Supabase, no separate backend.

**Principles**

- **Capture in one gesture.** Paste anywhere, drop anywhere, or ⌘K. No forms before saving; enrichment happens after.
- **Organize without effort.** Format categories are automatic; topics (collections, tags, smart views) are optional and dynamic.
- **Calm, tactile UI.** Light airy surfaces, grain, iridescent gradients, spring-based motion — taken from the reference footer.
- **Cheap to run.** Fits Supabase + Vercel free tiers for a single heavy user; no paid image processing or AI in the MVP.

**Scope**

|  | MVP (v1) | Later (v2+) |
| --- | --- | --- |
| Capture | Paste, drag-and-drop files/URLs, quick-add, notes, link unfurl | Bookmarklet, browser extension, Android share target, email-in |
| Organize | Auto format categories, collections, tags, smart views, drag to file, infinite canvas per collection | AI auto-tagging, canvas connectors and frames |
| Browse | Grid + list, detail drawer with previews, unread/favorite/archive/trash | Reader mode, resurfacing ("you saved this 30 days ago") |
| Find | Postgres full-text + fuzzy search, filters, ⌘K | Semantic search (pgvector) |
| Sync | Single device refresh, optimistic UI | Realtime cross-tab sync, public shared collections |

## Phase files

Read this file, then only the current phase's file (plus [data-model.md](data-model.md) or [design.md](design.md) when the work needs them).

- [phase-0.md](phase-0.md) — Scaffold and design system
- [phase-1.md](phase-1.md) — Supabase, schema, auth, guests
- [phase-2.md](phase-2.md) — App shell and data layer
- [phase-3.md](phase-3.md) — Capture
- [phase-4.md](phase-4.md) — Browse
- [phase-5.md](phase-5.md) — Organize and drag-and-drop
- [phase-6.md](phase-6.md) — Canvas
- [phase-7.md](phase-7.md) — Search and command palette
- [phase-8.md](phase-8.md) — Motion, polish, release

## Architecture

The browser talks to Supabase directly for all CRUD, protected by Row Level Security; Next.js server code is used only for what the browser can't do safely (fetching third-party pages for unfurl, auth callbacks). No separate API server.

&#91;embedded content: architecture · browser, Supabase, Next.js\]

All CRUD and uploads go from the browser straight to Supabase under RLS; the server only fetches third-party pages, refreshes the session and renders the first page.

**Stack**

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 16 App Router, React 19, TypeScript strict | Your default stack; RSC for the shell, client components for the board |
| Styling | Tailwind CSS v4 (`@theme` tokens) + shadcn/ui | Token-driven restyle of accessible primitives |
| Motion | `motion` (Motion for React) | Layout, shared-element and spring animations |
| Drag-and-drop | `@dnd-kit/core` + `@dnd-kit/sortable` | Grid/list sorting + droppable sidebar + keyboard sensor |
| Canvas | React Flow (`@xyflow/react`) | MIT; custom nodes reuse the card components; pan, zoom, selection, resize built in |
| Server state | TanStack Query v5 + `@supabase/supabase-js` | Cache, optimistic updates, rollback |
| UI state | Zustand | Selection, view mode, filters, palette, drag state |
| Auth / DB / Files | Supabase (`@supabase/ssr`) | Email OTP, Google, anonymous guests; Postgres + RLS; Storage |
| Bot protection | Cloudflare Turnstile | Free CAPTCHA, native in Supabase Auth |
| Email | Brevo as custom SMTP (fallback: SMTP2GO) | OTP codes; Supabase's built-in SMTP is for testing only |
| Ordering | `fractional-indexing` | Reorder by updating one row |
| Unfurl parsing | `linkedom` (or `cheerio`) in a Route Handler | Lightweight HTML parsing on Vercel Node runtime |
| Previews | `pdfjs-dist` (client) | PDF first-page thumbnails, no server cost |
| Utilities | `cmdk`, `sonner`, `vaul`, `lucide-react`, `zod` | Palette, toasts, mobile drawer, icons, validation |
| Deploy | Vercel + Supabase cloud | Free tiers cover v1 |

**Where code runs**

- **Server Components:** app shell, initial item page (first 50 items prefetched and hydrated into TanStack Query).
- **Client Components:** board, cards, DnD, drawer, palette, upload pipeline.
- **Route Handlers:** `POST /api/unfurl` (SSRF-safe fetch + parse), `GET /auth/callback`.
- **`proxy.ts`** (Next 16's rename of `middleware.ts`): refreshes the Supabase session cookie and redirects unauthenticated users away from `/app`. Claude Code should confirm the convention against the installed Next version.
- **Supabase Storage:** browser uploads directly with the user's JWT, so files never pass through Vercel functions (their request body limit is about 4.5 MB).

**Routes**

| Route | Screen |
| --- | --- |
| `/` | Landing page: aurora hero, "Try without an account" + "Sign in", footer in the reference style |
| `/login` | Email OTP code + Google sign-in |
| `/auth/callback` | Google OAuth code exchange |
| `/app` | Inbox (items without collection) |
| `/app/all`, `/app/unread`, `/app/favorites`, `/app/archive`, `/app/trash` | System views |
| `/app/f/[kind]` | Format view |
| `/app/c/[collectionId]` | Collection |
| `/app/t/[tag]` | Tag |
| `/app/v/[viewId]` | Smart view |
| `/app/settings` | Account, export (JSON), danger zone |
| `/styleguide` (dev only) | Tokens, components, motion samples |

Any route + `?item=<id>` opens the detail drawer.

**Folder structure**

```
src/
  app/
    (marketing)/page.tsx
    (auth)/login/page.tsx
    auth/callback/route.ts
    app/layout.tsx            # sidebar shell, providers
    app/[[...view]]/page.tsx  # one board page, view resolved from params
    api/unfurl/route.ts
    api/cron/cleanup-guests/route.ts  # only place using the service-role key
    styleguide/page.tsx
  components/
    ui/        # shadcn primitives, restyled
    brand/     # Logo, Grain, Aurora
    board/     # Board, ItemGrid, ItemList, SortableCard, DropOverlay
    cards/     # LinkCard, VideoCard, ImageCard, PdfCard, NoteCard, FileCard
    detail/    # ItemDrawer, previews per kind
    sidebar/   # Sidebar, NavItem, CollectionList (droppable)
    capture/   # PasteListener, ExternalDropZone, QuickAdd
    command/   # CommandPalette
    canvas/    # CanvasView (React Flow), ItemNode, CanvasControls
    account/   # GuestBanner, UpgradeDialog, OtpForm
  lib/
    supabase/  # client.ts, server.ts, proxy.ts
    items/     # detect-kind.ts, queries.ts, mutations.ts, upload.ts, thumbnails.ts
    unfurl/    # fetch-safe.ts, parse.ts, providers.ts (YouTube, Vimeo oEmbed)
    order.ts   # fractional index helpers
    filters.ts # smart-view rules -> Supabase query
  stores/      # ui-store.ts (Zustand)
  hooks/       # use-items, use-shortcuts, use-paste, use-selection
  types/       # database.types.ts (generated)
supabase/
  migrations/
  seed.sql
```

## Build phases for Claude Code

Nine phases, all part of the MVP, each one Claude Code session (or one PR) with a clear "done" gate. Each session starts by reading `CLAUDE.md` and `docs/plan/README.md` and its phase file, and ends with typecheck, lint, tests and a short changelog entry.

**After MVP (v2 backlog):** bookmarklet and browser extension · Android share target (Web Share Target API; iOS Safari does not support it) · article text extraction for full-text search · AI auto-tagging and semantic search (pgvector, embeddings on save) · canvas connectors, frames and groups · realtime sync · public shared collections · merging guest data into an existing account.

## Costs and limits

v1 is designed to run at $0 for one person; the main limits are Supabase Free's storage and inactivity pausing. Figures are from memory of current plans — verify on the pricing pages before relying on them.

| Service | Free tier (approx.) | Impact on Things |
| --- | --- | --- |
| Supabase Free | 500 MB database, 1 GB file storage, 50 MB max file size; projects pause after \~1 week inactive | Storage is the first ceiling, now shared with guests (hence the 25 MB guest quota). Pro is \~US$25/month |
| Supabase image transforms | Paid plans only | Avoided: thumbnails generated in the browser |
| Vercel Hobby | Non-commercial use; \~4.5 MB function body limit; daily cron only | Fine for a personal app; uploads bypass functions; guest cleanup runs daily |
| Brevo (custom SMTP) | 300 emails/day; free-plan emails may carry Brevo branding | Plenty for OTP codes |
| Cloudflare Turnstile | Free | Bot protection on guest and OTP sign-in |
| React Flow | MIT, free; small attribution link by default | Keep the link, or subscribe to Pro if you hide it in a commercial product |
| AI tagging (v2) | Per-token API cost | Optional; batch on save, cheapest small model |

## Risks

| Risk | Mitigation |
| --- | --- |
| Canvas with many image cards gets heavy | 480px thumbnails only, `onlyRenderVisibleElements`, test 300+ nodes in Phase 6 |
| Two drag systems (dnd-kit and React Flow) leak into each other | Hard split: dnd-kit only in grid/list/sidebar, React Flow only on the canvas |
| dnd-kit and Motion layout animations conflict, causing jumpy cards | Disable `layout` during drag; test early in Phase 5 with 200+ items |
| Guest abuse (spam sign-ups, storage, unfurl as a proxy) | Turnstile, 25 MB guest quota, 60/hour unfurl limit, 30-day cleanup |
| Guests lose data by clearing cookies | Banner plus a reminder after 10 saves to add an email |
| SSRF through `/api/unfurl` | DNS resolve + IP blocklist on every redirect, timeout, body cap (Phase 3 tests) |
| Sites blocking unfurl (X, Instagram, paywalls) | Graceful fallback card: domain + favicon + editable title |
| Remote og:images break over time | v2: copy og:image into Storage on save |
| Supabase free project pauses | Expect a cold wake-up after a week idle; Pro removes it |

## Decisions

Confirmed on 2026-10-12; all are reflected in the sections above.

| Decision | Choice |
| --- | --- |
| "Formato libre" | Any content format + grid/list + infinite canvas per collection, all in the MVP |
| Collections | One collection per item, many tags |
| Auth | Email OTP code + Google; no magic link, no GitHub |
| No-account use | Guest mode via Supabase anonymous sign-in, upgradable to email or Google (proposed instead of localStorage) |
| Landing page | Yes, at `/`, with "Try without an account" |
| AI auto-tagging | Out of the MVP |
| UI language | English only |
