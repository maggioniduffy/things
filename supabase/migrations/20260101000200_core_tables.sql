create type public.item_kind as enum
  ('link','article','video','image','pdf','document','note','audio','code','other');

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  emoji text,
  color text check (color is null or color in ('pink','violet','blue','red','coral','olive')),
  canvas_viewport jsonb,            -- {x, y, zoom}; Inbox viewport lives in localStorage
  position text collate "C" not null,
  created_at timestamptz not null default now()
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  collection_id uuid references public.collections on delete set null,  -- null = Inbox
  kind public.item_kind not null,
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
    setweight(to_tsvector('simple', public.f_unaccent(coalesce(title,''))), 'A') ||
    setweight(to_tsvector('simple', public.f_unaccent(coalesce(description,'') || ' ' || coalesce(site_name,''))), 'B') ||
    setweight(to_tsvector('simple', public.f_unaccent(coalesce(note,'') || ' ' || coalesce(file_name,'') || ' ' || coalesce(url,''))), 'C')
  ) stored
);

create trigger items_set_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  color text check (color is null or color in ('pink','violet','blue','red','coral','olive')),
  created_at timestamptz not null default now()
);
create unique index tags_user_name on public.tags (user_id, lower(name));

create table public.item_tags (
  item_id uuid not null references public.items on delete cascade,
  tag_id uuid not null references public.tags on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  primary key (item_id, tag_id)
);

create table public.smart_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  icon text,
  rules jsonb not null,             -- see filter schema in docs/plan.md
  position text collate "C" not null,
  created_at timestamptz not null default now()
);

-- Backs the 60-per-hour unfurl limit
create table public.unfurl_log (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  url text not null,
  created_at timestamptz not null default now()
);
create index unfurl_log_user_created on public.unfurl_log (user_id, created_at desc);

-- indexes
create index items_board on public.items (user_id, collection_id, position) where deleted_at is null and archived_at is null;
create index items_kind on public.items (user_id, kind) where deleted_at is null;
create index items_domain on public.items (user_id, domain);
create index items_search on public.items using gin (search);
create index items_title_trgm on public.items using gin (title extensions.gin_trgm_ops);
create index items_user_deleted on public.items (user_id, deleted_at);  -- trash purge
create index item_tags_tag on public.item_tags (tag_id);
