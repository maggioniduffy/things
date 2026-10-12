alter table public.collections enable row level security;
alter table public.items enable row level security;
alter table public.tags enable row level security;
alter table public.item_tags enable row level security;
alter table public.smart_views enable row level security;
alter table public.unfurl_log enable row level security;

-- Guests are `authenticated` too (anonymous sign-in); no policy targets `anon`.

create policy "own rows" on public.collections for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "own rows" on public.tags for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "own rows" on public.smart_views for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- FK checks bypass RLS, so the with-check also proves the referenced row is the caller's own.
create policy "own rows" on public.items for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (
      collection_id is null
      or exists (
        select 1 from public.collections c
        where c.id = collection_id and c.user_id = (select auth.uid())
      )
    )
  );

create policy "own rows" on public.item_tags for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.items i
      where i.id = item_id and i.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.tags t
      where t.id = tag_id and t.user_id = (select auth.uid())
    )
  );

-- Append-only log: read and insert own rows, no update/delete
create policy "own select" on public.unfurl_log for select to authenticated
  using (user_id = (select auth.uid()));

create policy "own insert" on public.unfurl_log for insert to authenticated
  with check (user_id = (select auth.uid()));
