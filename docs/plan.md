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

## Visual language

The reference is a light, near-white page with a fine film grain, dark grotesk type, hairline borders, and an iridescent "hills" gradient (pink → violet → blue, with red and olive undertones) rising from the bottom. Things keeps the content area calm and uses the gradient only as atmosphere: empty states, the drop overlay, auth and landing.

**Tokens** (Tailwind v4 `@theme` in `globals.css`; hex values are eyeballed from the image — tune in the styleguide page)

| Token | Value | Use |
| --- | --- | --- |
| `--color-paper` | `#F3F4F6` | App background, slightly cool |
| `--color-surface` | `rgb(255 255 255 / 0.65)` + `backdrop-blur-md` | Cards, sidebar, popovers |
| `--color-ink` | `#0F0F12` | Headings, logo, primary text |
| `--color-ink-muted` | `#4A4A52` | Body, link lists |
| `--color-ink-subtle` | `#8B8B94` | Meta (domain, dates, counts) |
| `--color-line` | `rgb(15 15 18 / 0.12)` | Hairline dividers, card and icon-button borders |
| `--aurora-pink` | `#EE5BC4` | Gradient stop |
| `--aurora-violet` | `#8E6CF0` | Gradient stop, focus ring base |
| `--aurora-blue` | `#4F63DE` | Gradient stop, primary accent |
| `--aurora-red` | `#EF4A30` | Gradient stop, destructive hint |
| `--aurora-coral` | `#F6A79C` | Gradient haze at horizon |
| `--aurora-olive` | `#A9A55C` | Gradient highlight band |
| `--radius-control` | `8px` | Buttons, inputs, icon buttons |
| `--radius-card` | `14px` | Item cards, drawer |

**Typography.** Inter for UI (variable, `font-feature-settings: "ss01", "cv11"`), Inter Tight or Geist for headings and the wordmark with `-0.02em` tracking. Scale: 13 meta · 15 body · 17 card title · 20 section · 28 page title. Column headers in the reference are 17px medium ink; links are 15px regular ink-muted. Footer-style text links use a 1px underline offset 3px.

**Signature elements**

- **Grain overlay.** A fixed full-screen SVG `feTurbulence` noise layer (`baseFrequency ≈ 0.85`, 3 octaves) at 6–10% opacity, `mix-blend-mode: multiply`, `pointer-events: none`. One component: `<Grain />`.
- **Aurora hills.** `<Aurora />` = 4–6 large blurred radial/elliptical gradients in the stops above, masked to a wavy horizon, with the grain on top so the noise reads stronger on color (as in the image). Slow drift: 20–40s keyframes on `transform` only. Static when `prefers-reduced-motion`. CSS only, no WebGL in v1.
- **Outlined icon buttons.** 40×40, 1px `--color-line` border, 8px radius, white surface, ink icon at 18px (the social buttons in the reference). Used for toolbar actions and card quick actions.
- **Hairline dividers.** Full-width 1px lines separate sidebar sections and the list view rows.
- **Wordmark.** "Things" in the heading font next to a geometric mark built from stacked chevrons/slashes in the spirit of the reference logo — an original mark, not a copy.

**Components (shadcn/ui base, restyled to tokens):** Button (primary ink-filled, secondary outlined, ghost), IconButton, Input, SearchField, Dialog, Drawer (vaul on mobile), DropdownMenu, ContextMenu, Tooltip, Kbd, Badge (outlined, kind-colored dot), Toast (sonner), Command (cmdk), Skeleton with shimmer.

## Features and UX

The app is one screen: a sidebar of categories, a toolbar, and a grid of cards that accepts drops anywhere. Every save lands instantly as an optimistic card and enriches in place (title, image, thumbnail) a moment later.

**Layout**

- **Sidebar (260px, collapsible):** wordmark · Inbox (no collection) · All · Unread · Favorites · *Formats* (only kinds that have items, with counts: Links, Articles, Videos, Images, PDFs, Documents, Notes, Code) · *Collections* (user topics, emoji + color, drop targets) · *Tags* · *Smart views* · Archive · Trash.
- **Toolbar:** search field (/), filter chips (kind, tag, domain, status), sort (manual, newest, oldest, title), view toggle (grid / list / canvas), "+ Add" primary button.
- **Main:** responsive card grid (auto-fill, min 240px). List view = dense rows with hairline dividers. Canvas view = an infinite board per collection (see Canvas).
- **Detail drawer** (right side, `?item=<id>` in the URL so it is linkable): large preview, editable title and note, collection, tags, source link, metadata, actions.

**Capture (MVP)**

1. **Paste anywhere** (⌘V when no input is focused): URL → link item; text → note; image on clipboard → image item.
2. **Drop anywhere:** files from the OS, links or images dragged from another tab. A full-screen overlay with the aurora and "Drop to save" appears on `dragenter`. Dropping on a sidebar collection files it there directly.
3. **Quick add** (⌘K → "Add", or the + button): one field that accepts a URL, text, or a file picker.
4. **Notes:** plain text with light markdown, rendered on the card.

**Dynamic categories**

| Category | How it's built | Editable by user |
| --- | --- | --- |
| Format | Derived from MIME type and URL on save (`kind` column) | Override per item |
| Collection | One home per item (folder-like), `collection_id`; null = Inbox | Yes, CRUD + reorder |
| Tags | Many-to-many, created inline by typing `#tag` | Yes |
| Domain | Derived from URL host (`youtube.com`, `github.com`) | No — a filter chip |
| Smart view | Saved filter rules in JSON (e.g. unread PDFs tagged #thesis) | Yes |

**Drag-and-drop (dnd-kit)**

- Reorder cards in manual sort (grid and list) — persisted with fractional indexing.
- Drag one card or a multi-selection (⌘/Shift-click) onto a collection, a tag, Favorites, Archive or Trash in the sidebar.
- Reorder collections and smart views in the sidebar.
- External drops (files/URLs) use native HTML5 events, separate from dnd-kit, so the two never fight.
- Keyboard DnD via dnd-kit's keyboard sensor for accessibility.

**Canvas (MVP)**

Every collection and the Inbox has its own infinite canvas built with React Flow; formats, tags and smart views stay grid/list because they are filters, not places.

- Cards are React Flow custom nodes that reuse the grid's card components; notes render as sticky-style text cards.
- Pan with space-drag, trackpad or middle mouse; zoom 10–200% with pinch or ⌘-scroll; dot-grid background in `--color-line` under the grain.
- Marquee and Shift-click multi-select, multi-drag, resize (min 160×120), bring to front, optional 8px snap.
- Items land where they happen: drops at the cursor (`screenToFlowPosition`), pastes at the viewport center, double-click on empty space creates a note there.
- Items without a position (saved from grid or another device) are auto-placed in a free column right of the existing content.
- Moving to another collection from the canvas: context menu or `M`. Dropping a node on a sidebar collection (detected on drag stop with `elementFromPoint`) is a stretch goal.
- Grid manual order and canvas positions are independent; switching views never moves items.
- Minimap toggle; `onlyRenderVisibleElements` above \~300 nodes.
- Copy and paste cards: ⌘C copies the selected cards, ⌘V pastes copies at the cursor (viewport center if the cursor is off the canvas), keeping their relative layout; ⌘D duplicates in place, offset by 16px. Also in the node and pane context menus (Copy, Duplicate, Paste). Pasting works across canvases (copy in the Inbox, paste into a collection). A paste is one batch insert with an Undo toast, and the copies become the new selection.
  - The copy goes to an in-app clipboard (item ids + offsets, Zustand) and, as plain text, to the system clipboard (URLs for links, text for notes, one per line), so it also pastes into other apps. On ⌘V the canvas checks whether the system clipboard still holds that exact text: if yes it duplicates the items, otherwise it falls back to the normal paste (URL → link, text → note, image → image item).
  - Copies keep title, note, metadata and tags, get fresh ids, `position` and canvas coordinates, and start unread and not favorited. File items copy their Storage object (`storage.copy()` to the new item's path), so the copy counts toward the guest quota and deleting one never breaks the other.

| Key | Canvas action |
| --- | --- |
| Space + drag | Pan |
| ⌘ + / ⌘ − | Zoom in / out |
| Shift + 1 | Fit all items |
| Shift + 0 | Zoom to 100% |
| N | New note at viewport center |
| \] / \[ | Bring forward / send backward |
| ⌘C / ⌘V | Copy selected cards / paste copies at the cursor |
| ⌘D | Duplicate selected cards |

**Item states:** unread → read (on open), favorite toggle, archive, soft delete to Trash (30-day purge), every destructive action with an Undo toast.

**Guest mode (no account)**

"Try without an account" on the landing calls Supabase anonymous sign-in, so guests use the same database, RLS and code path as everyone else. A persistent banner offers to keep their things by adding an email (OTP) or Google, which upgrades the same user id with no data migration.

- Guest limits: 25 MB of files total, 10 MB per file, enforced by a DB trigger plus a client check.
- Cloudflare Turnstile CAPTCHA on guest sign-in and OTP requests (supported natively by Supabase Auth, free).
- Guests inactive for 30 days are deleted with their files by a daily cron.
- Why not localStorage: browser storage caps around 5 MB and can't hold files without IndexedDB, every query and mutation would need a second local implementation plus a merge on sign-up, and unfurl needs the server anyway. Anonymous auth gives the same no-signup experience with one code path. Trade-off: guests need a connection.

**Motion spec (Motion for React — `motion/react`)**

| Moment | Animation | Timing |
| --- | --- | --- |
| New item lands | Scale 0.96→1, opacity 0→1, blur 6px→0; enters from drop point when known | Spring, stiffness 380, damping 30 |
| Grid reflow (filter, delete, reorder) | `layout` animation on cards; exits collapse + fade | 250ms ease-out |
| Card hover | Lift y −2px, shadow grows, thumbnail scales 1.02 | 150ms |
| Card → detail drawer | Shared `layoutId` on the thumbnail; drawer slides from right | Spring |
| Drag over a sidebar target | Target scales 1.03, aurora gradient border fades in | 150ms |
| Drop overlay | Aurora fades and drifts up from the bottom edge | 300ms |
| Enrichment arrives | Skeleton shimmer cross-fades to the real image/title | 200ms |
| Empty states | Slow aurora drift + one line of copy ("Drop anything here.") | 30s loop |

Rule: during an active dnd-kit drag, cards use dnd-kit transforms only; Motion `layout` resumes after drop. All motion respects `prefers-reduced-motion` (opacity-only fallbacks).

On the canvas, React Flow owns node position and drag; Motion animates only each card's inner content (enter, hover, enrichment). dnd-kit is never used on the canvas.

**Keyboard shortcuts**

| Key | Action |
| --- | --- |
| ⌘K | Command palette (search, add, jump to collection, actions) |
| ⌘V | Save clipboard |
| / | Focus search |
| J / K or arrows | Move selection |
| Enter / Space | Open detail / quick look |
| F | Toggle favorite |
| E | Archive |
| ⌫ | Move to Trash |
| M | Move to collection (opens picker) |
| T | Add tag |
| G then I / A / F | Go to Inbox / All / Favorites |

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

## Data model

Five core tables, all owned by `user_id` and locked down with RLS: `items`, `collections`, `tags`, `item_tags`, `smart_views`. Files live in one private Storage bucket keyed by user and item.

```sql
-- extensions (Supabase installs them in the `extensions` schema)
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- unaccent() is not IMMUTABLE, so wrap it to use in a generated column
create or replace function public.f_unaccent(text) returns text
language sql immutable parallel safe strict as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, $1)
$$;

create type item_kind as enum
  ('link','article','video','image','pdf','document','note','audio','code','other');

create table collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  emoji text,
  color text,                       -- one of the aurora token names
  canvas_viewport jsonb,            -- {x, y, zoom}; Inbox viewport lives in localStorage
  position text collate "C" not null,
  created_at timestamptz not null default now()
);

create table items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  collection_id uuid references collections on delete set null,  -- null = Inbox
  kind item_kind not null,
  title text,
  description text,
  note text,
  -- links
  url text,
  domain text,
  site_name text,
  favicon_url text,
  image_url text,                   -- remote og:image
  -- files
  file_path text,                   -- storage: {user_id}/{item_id}/{file_name}
  file_name text,
  mime_type text,
  file_size bigint,
  thumbnail_path text,              -- storage: {user_id}/{item_id}/thumb.webp
  -- state
  enrich_status text not null default 'pending' check (enrich_status in ('pending','done','failed')),
  is_read boolean not null default false,
  is_favorite boolean not null default false,
  archived_at timestamptz,
  deleted_at timestamptz,
  position text collate "C" not null,  -- fractional index; "C" = byte order
  canvas_x real,                    -- canvas: null = not placed yet
  canvas_y real,
  canvas_w real,
  canvas_h real,
  canvas_z int not null default 0,
  metadata jsonb not null default '{}', -- provider extras: duration, pages, author
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search tsvector generated always as (
    setweight(to_tsvector('simple', f_unaccent(coalesce(title,''))), 'A') ||
    setweight(to_tsvector('simple', f_unaccent(coalesce(description,'') || ' ' || coalesce(site_name,''))), 'B') ||
    setweight(to_tsvector('simple', f_unaccent(coalesce(note,'') || ' ' || coalesce(file_name,'') || ' ' || coalesce(url,''))), 'C')
  ) stored
);

create table tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now()
);
create unique index tags_user_name on tags (user_id, lower(name));

create table item_tags (
  item_id uuid not null references items on delete cascade,
  tag_id uuid not null references tags on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  primary key (item_id, tag_id)
);

create table smart_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  icon text,
  rules jsonb not null,             -- see filter schema below
  position text collate "C" not null,
  created_at timestamptz not null default now()
);

-- indexes
create index items_board on items (user_id, collection_id, position) where deleted_at is null and archived_at is null;
create index items_kind on items (user_id, kind) where deleted_at is null;
create index items_domain on items (user_id, domain);
create index items_search on items using gin (search);
create index items_title_trgm on items using gin (title extensions.gin_trgm_ops);
```

**RLS** — enable on every table; one policy per table for all commands:

```sql
alter table items enable row level security;
create policy "own rows" on items for all
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
-- same for collections, tags, item_tags, smart_views
```

Wrapping `auth.uid()` in a `select` lets Postgres evaluate it once per query instead of per row (Supabase's documented RLS performance tip).

**Storage** — private bucket `things`, path `{user_id}/{item_id}/{file}`; policies on `storage.objects` for select/insert/update/delete with `bucket_id = 'things' and (storage.foldername(name))[1] = (select auth.uid())::text`. Reads use signed URLs (1 h), batched with `createSignedUrls` per page of cards.

**Guests** — anonymous users are ordinary `auth.users` rows with `is_anonymous = true`, and their JWT carries an `is_anonymous` claim, so RLS works unchanged. A `before insert or update` trigger on `items` rejects a file when `(auth.jwt()->>'is_anonymous')::boolean` is true and the user's `sum(file_size)` would pass 25 MB (or the file passes 10 MB). A table `unfurl_log (user_id, created_at)` backs a 60-per-hour unfurl limit for everyone.

**Canvas layout RPC** — one call saves every moved or resized node; `security invoker` keeps RLS in force:

```sql
create or replace function save_canvas_layout(layout jsonb)
returns void language sql security invoker as $$
  update items i set
    canvas_x = (l->>'x')::real, canvas_y = (l->>'y')::real,
    canvas_w = (l->>'w')::real, canvas_h = (l->>'h')::real,
    canvas_z = (l->>'z')::int, updated_at = now()
  from jsonb_array_elements(layout) l
  where i.id = (l->>'id')::uuid;
$$;
```

**Smart-view rules (zod schema, also used for toolbar filters)**

```ts
const Rules = z.object({
  kinds: z.array(ItemKind).optional(),
  collectionIds: z.array(z.string().uuid()).optional(),
  tagIds: z.array(z.string().uuid()).optional(),   // match all
  domains: z.array(z.string()).optional(),
  isRead: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
  savedWithinDays: z.number().int().positive().optional(),
  query: z.string().optional(),                    // full-text
});
```

**Search** — one RPC `search_items(q text, rules jsonb, lim int)` (security invoker, so RLS applies) that ORs `search @@ websearch_to_tsquery('simple', f_unaccent(q))` with `title % q` (trigram), ranks by `ts_rank` + `similarity`, and applies the same rules. The `simple` config + unaccent handles mixed Spanish/English content without stemming surprises.

**Counts** — a view `item_counts` grouped by `kind` and `collection_id` (security invoker) feeds the sidebar badges.

## Key flows

Every save follows the same two-step shape: insert a minimal row immediately (optimistic card on screen), then enrich it and patch the row. Failures leave a usable card with `enrich_status = 'failed'` and a retry action.

**Kind detection (`lib/items/detect-kind.ts`, pure function, unit-tested)**

| Input | Rule | Kind |
| --- | --- | --- |
| File | `image/*` | image |
| File | `application/pdf` | pdf |
| File | `audio/*` | audio |
| File | `video/*` | video |
| File | Word, Excel, PowerPoint, ODF, `text/*`, Markdown | document |
| URL | youtube.com, youtu.be, vimeo.com, loom.com | video |
| URL | github.com, gitlab.com, codepen.io, codesandbox.io | code |
| URL | Path ends in `.pdf` / `.png` / `.jpg` etc. | pdf / image |
| URL | After unfurl: `og:type = article` or an `article:published_time` tag | article |
| URL | Anything else | link |
| Text | Not a URL | note |

**Link unfurl — `POST /api/unfurl`**

1. Validate with zod: http(s) only, max 2,048 chars; require an authenticated Supabase session.
2. **SSRF guard:** resolve DNS, reject private, loopback, link-local and metadata ranges (10/8, 172.16/12, 192.168/16, 127/8, 169.254/16, ::1, fc00::/7); re-check on every redirect; max 3 redirects.
3. Fetch with a 5 s timeout, a browser-like User-Agent, and a 1 MB body cap; parse only `<head>`.
4. Extract `og:*`, `twitter:*`, `<title>`, meta description, canonical URL, favicon (`<link rel=icon>` → fallback `/favicon.ico`).
5. Provider overrides via oEmbed for YouTube and Vimeo (title, thumbnail, duration). X/Twitter and Instagram block scraping; v1 stores those as plain links with domain and favicon only.
6. Return JSON; the client patches the row (`title`, `description`, `image_url`, `kind`, `enrich_status = 'done'`). Cache successful results for 24 h with Next's fetch cache.

**File upload (client only)**

1. Insert the row (kind from MIME, `file_name`, `file_size`, `enrich_status = 'pending'`).
2. Upload to `things/{user_id}/{item_id}/{file_name}` with `supabase.storage.upload`; switch to resumable (TUS) uploads above 6 MB. Show progress on the card.
3. Generate a thumbnail in the browser: images via `createImageBitmap` → canvas → WebP 480px; PDFs via `pdfjs-dist` page 1; video via a `<video>` frame at 1 s. Upload as `thumb.webp`, then patch `thumbnail_path`.
4. Enforce a client-side size limit that matches the Supabase plan (50 MB on Free) with a clear error toast.

**Ordering**

- New items get a key before the current first item (newest on top in manual sort).
- On drop, compute `generateKeyBetween(prev.position, next.position)` and update only the moved row; multi-select moves use `generateNKeysBetween`.
- Sort modes other than manual are pure queries and don't touch `position`; dragging is disabled outside manual sort.

**Canvas save**

1. React Flow updates node state locally on every pointer move; nothing hits the network during a drag.
2. On drag stop or resize end, changed nodes go into a pending map; a 400 ms debounce flushes them in one `save_canvas_layout` call. Optimistic; on error, roll back to the last saved layout and toast.
3. Viewport (x, y, zoom) is saved on move end, debounced 1 s, to `collections.canvas_viewport` (Inbox: localStorage).
4. Auto-place: on load, items with null `canvas_x` are stacked in a column right of the content's bounding box (24px gaps), then saved in one batch.
5. Default node size by kind: link/article 280×240, image by aspect ratio (max 320 wide), note 240×160, file 240×200.

**Sign-in and guest upgrade**

1. OTP: `signInWithOtp({ email })` sends a 6-digit code (email template uses `{{ .Token }}` instead of a link) → `verifyOtp({ email, token, type: 'email' })`.
2. Google: `signInWithOAuth({ provider: 'google' })` → `/auth/callback` exchanges the code.
3. Guest: `signInAnonymously({ options: { captchaToken } })` with a Turnstile token.
4. Guest → email: `updateUser({ email })`, then `verifyOtp({ type: 'email_change' })`. Guest → Google: `linkIdentity({ provider: 'google' })` (requires manual identity linking enabled). Same user id, so every item stays.
5. If that email or Google account already has a Things account, the link fails; v1 offers to sign in to it and says guest items won't be merged (merge is v2).

Claude Code should check these method names and options against the current supabase-js docs in Phase 1.

**Optimistic mutations (TanStack Query)** — every mutation runs `onMutate` (snapshot + patch cache) → `onError` (rollback + toast) → `onSettled` (invalidate the affected list and counts). Undo toasts call the inverse mutation.

## Build phases for Claude Code

Nine phases, all part of the MVP, each one Claude Code session (or one PR) with a clear "done" gate. Each session starts by reading `CLAUDE.md` and this plan's section for the phase, and ends with typecheck, lint, tests and a short changelog entry.

1. **Phase 0 — Scaffold and design system**
   - Next.js 16 + TS strict + Tailwind v4 + shadcn init; ESLint, Prettier, Vitest, Playwright.
   - Tokens in `@theme`, fonts, `<Grain />`, `<Aurora />`, Logo, restyled primitives, `/styleguide`.
   - Landing page `/` with aurora hero, "Try without an account" and "Sign in" CTAs, footer in the reference layout.
   - **Done when:** `/styleguide` shows every token and component; Lighthouse performance ≥ 90 on `/`; reduced-motion disables drift.
2. **Phase 1 — Supabase, schema, auth, guests**
   - Supabase CLI project, migrations from the Data model section (incl. canvas columns, guest quota trigger, `unfurl_log`), RLS, bucket + storage policies, `gen types`.
   - `@supabase/ssr` clients, `proxy.ts`, `/login` with email OTP + Google, `/auth/callback`, sign-out.
   - Brevo as custom SMTP + OTP email template; Turnstile on OTP and guest sign-in; anonymous sign-in; GuestBanner + UpgradeDialog (email and Google linking).
   - **Done when:** a SQL test proves user A cannot read, update or upload into user B's rows/paths; OTP login works end-to-end; a guest saves items, adds an email, and keeps every item under the same user id; a guest is blocked past 25 MB.
3. **Phase 2 — App shell and data layer**
   - Sidebar (system views, formats with counts, collections, tags), toolbar with grid/list/canvas toggle (canvas disabled until Phase 6), `[[...view]]` routing, Zustand UI store, TanStack Query provider with hydration.
   - Empty states with the aurora.
   - **Done when:** navigating between views changes the query without a full reload; sidebar counts match the DB.
4. **Phase 3 — Capture**
   - `detect-kind.ts` with unit tests; paste listener; external drop overlay; quick add.
   - `/api/unfurl` with SSRF guard, rate limit and oEmbed providers; file upload pipeline + client thumbnails; notes.
   - **Done when:** a YouTube URL, a blog URL, a PDF, an image and plain text each produce the right kind and an enriched card within 3 s on a normal connection; unfurl rejects `http://127.0.0.1` and `http://169.254.169.254`.
5. **Phase 4 — Browse**
   - Card variant per kind, grid and list views, detail drawer with previews (image lightbox, PDF iframe, video embed, link card, note editor).
   - Read/favorite/archive/trash with undo; Trash purge after 30 days.
   - **Done when:** every kind renders correctly in both views and the drawer; `?item=` links survive a reload.
6. **Phase 5 — Organize and drag-and-drop**
   - Collections and tags CRUD; dnd-kit sortable grid/list with fractional ordering; drag (and multi-drag) to sidebar targets; sidebar reordering; smart views builder.
   - **Done when:** reorder persists after reload with a single-row update; dropping 5 selected cards on a collection moves all 5 with one optimistic update; keyboard DnD works.
7. **Phase 6 — Canvas**
   - React Flow view for Inbox and each collection; `ItemNode` reusing card components; pan, zoom, marquee, multi-drag, resize, z-order, snap, minimap.
   - Drops and pastes at position, double-click to add a note, copy/paste and duplicate cards, auto-place for unplaced items, `save_canvas_layout` RPC with debounce, viewport persistence, canvas shortcuts.
   - **Done when:** positions, sizes and viewport persist after reload and on another device; a file dropped at a point appears there; copied cards paste at the cursor with their layout, including into another collection; 300 cards pan and zoom at 60 fps; moving cards on the canvas never changes grid order.
8. **Phase 7 — Search and command palette**
   - `search_items` RPC, debounced search field, filter chips, ⌘K palette (search results + actions + navigation), all shortcuts.
   - **Done when:** searching "cancion" finds "Canción"; a one-character typo still matches titles; every shortcut in both tables works.
9. **Phase 8 — Motion, polish, release**
   - Motion pass per the spec; responsive/mobile (drawer becomes bottom sheet, canvas is pan/zoom + tap to open); a11y audit (focus rings, ARIA for DnD, contrast); PWA manifest; error boundaries.
   - Guest cleanup cron (`/api/cron/cleanup-guests`, daily Vercel Cron, `CRON_SECRET`); Vercel production deploy.
   - **Done when:** axe shows no critical issues; 60 fps while dragging in a 500-item grid (virtualize if not); production deploy is live.

**After MVP (v2 backlog):** bookmarklet and browser extension · Android share target (Web Share Target API; iOS Safari does not support it) · article text extraction for full-text search · AI auto-tagging and semantic search (pgvector, embeddings on save) · canvas connectors, frames and groups · realtime sync · public shared collections · merging guest data into an existing account.

## CLAUDE.md draft

Drop this at the repo root before Phase 0; Claude Code reads it every session.

```markdown
# Things

Save-for-later app: links, files, notes. Single user per account.
Full plan: docs/plan.md (exported from the Things plan doc).

## Stack
Next.js 16 App Router · React 19 · TypeScript strict · Tailwind v4 (@theme tokens)
shadcn/ui · motion (motion/react) · dnd-kit (grid/list/sidebar) · React Flow @xyflow/react (canvas)
TanStack Query v5 · Zustand
Supabase (@supabase/ssr, Postgres + RLS, Storage; auth = email OTP, Google, anonymous guests) · Turnstile · Brevo SMTP · Vercel

## Rules
- No separate backend. Browser -> Supabase with RLS for CRUD.
  Route Handlers only for /api/unfurl and auth callback.
- Service-role key only in /api/cron/* (server-only, CRON_SECRET-protected); never anywhere else. Env vars in .env.local, read via process.env, never logged.
- Every table has user_id + RLS. New migration = new file in supabase/migrations; regenerate types.
- Server state in TanStack Query with optimistic updates + rollback. UI-only state in Zustand.
- Colors, radii, fonts only via tokens; no raw hex in components.
- All motion respects prefers-reduced-motion. During dnd-kit drags, no Motion layout animations.
- Guests are anonymous Supabase users: same code path, no localStorage data layer.
- Canvas: React Flow owns position/drag; never mix dnd-kit or Motion layout into it.
- UI copy in English, sentence case.
- Verify Next.js 16 conventions (proxy.ts, caching) against installed docs before using them.

## Commands
pnpm dev · pnpm typecheck · pnpm lint · pnpm test · pnpm e2e
supabase start · supabase db reset · supabase gen types typescript --local > src/types/database.types.ts

## Definition of done (every phase)
typecheck + lint + tests green · no console errors · styleguide still renders · CHANGELOG.md entry
```

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
