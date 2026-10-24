-- search_items: ranked, typo-tolerant, accent-insensitive search that applies smart-view rules.

-- Word similarity on the unaccented title ("cancoin" still finds "Canción de cuna").
create index items_title_unaccent_trgm
  on public.items using gin (public.f_unaccent(title) extensions.gin_trgm_ops);

-- rules keys: kinds, collectionIds, tagIds (match all), domains, isRead, isFavorite,
-- savedWithinDays, query, plus scope ('live' default | 'archived' | 'trashed') and inbox.
-- Runs as the caller: RLS limits rows to the caller's own.
create function public.search_items(
  q text,
  rules jsonb default '{}'::jsonb,
  lim int default 50
) returns setof public.items
language sql stable security invoker
set search_path = ''
set pg_trgm.word_similarity_threshold = 0.4
as $$
  select i.*
  from public.items i
  cross join lateral (
    select
      coalesce(rules, '{}'::jsonb) as r,
      nullif(btrim(public.f_unaccent(coalesce(q, ''))), '') as uq
  ) p
  cross join lateral (
    select
      case when p.uq is not null then websearch_to_tsquery('simple', p.uq) end as tsq,
      nullif(btrim(public.f_unaccent(coalesce(p.r->>'query', ''))), '') as rq
  ) s
  where
    (
      p.uq is null
      or i.search @@ s.tsq
      or p.uq operator(extensions.<%) public.f_unaccent(i.title)
    )
    and (s.rq is null or i.search @@ websearch_to_tsquery('simple', s.rq))
    and case coalesce(p.r->>'scope', 'live')
      when 'live' then i.archived_at is null and i.deleted_at is null
      when 'archived' then i.archived_at is not null and i.deleted_at is null
      when 'trashed' then i.deleted_at is not null
      else false
    end
    and (coalesce((p.r->>'inbox')::boolean, false) is false or i.collection_id is null)
    and (
      not (p.r ? 'kinds')
      or jsonb_array_length(p.r->'kinds') = 0
      or i.kind::text in (select jsonb_array_elements_text(p.r->'kinds'))
    )
    and (
      not (p.r ? 'collectionIds')
      or jsonb_array_length(p.r->'collectionIds') = 0
      or i.collection_id::text in (select jsonb_array_elements_text(p.r->'collectionIds'))
    )
    and not exists (
      select 1
      from jsonb_array_elements_text(
        case when p.r ? 'tagIds' then p.r->'tagIds' else '[]'::jsonb end
      ) t(tag_id)
      where not exists (
        select 1 from public.item_tags it
        where it.item_id = i.id and it.tag_id = t.tag_id::uuid
      )
    )
    and (
      not (p.r ? 'domains')
      or jsonb_array_length(p.r->'domains') = 0
      or i.domain in (select jsonb_array_elements_text(p.r->'domains'))
    )
    and (not (p.r ? 'isRead') or i.is_read = (p.r->>'isRead')::boolean)
    and (not (p.r ? 'isFavorite') or i.is_favorite = (p.r->>'isFavorite')::boolean)
    and (
      not (p.r ? 'savedWithinDays')
      or i.created_at >= now() - make_interval(days => (p.r->>'savedWithinDays')::int)
    )
  order by
    case when p.uq is not null then
      coalesce(ts_rank(i.search, s.tsq), 0)
      + extensions.word_similarity(p.uq, public.f_unaccent(coalesce(i.title, '')))
    end desc nulls last,
    i.created_at desc,
    i.id
  limit least(greatest(coalesce(lim, 50), 1), 200)
$$;

revoke execute on function public.search_items(text, jsonb, int) from public, anon;
grant execute on function public.search_items(text, jsonb, int) to authenticated;
