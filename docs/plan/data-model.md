# Things — Data model

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

**Counts** — a view `item_counts` grouped by `kind` and `collection_id` (security invoker) feeds the sidebar badges.
