-- search_items RPC: ranked, typo-tolerant, accent-insensitive search with smart-view rules.
begin;
select plan(23);

insert into auth.users (id, email, is_anonymous, aud, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@test.local', false, 'authenticated', 'authenticated'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@test.local', false, 'authenticated', 'authenticated');

insert into public.collections (id, user_id, name, position) values
  ('c1000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Music', 'a0');
insert into public.tags (id, user_id, name) values
  ('d1000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 't1'),
  ('d1000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 't2');

-- A's items (ids encode intent)
insert into public.items (id, user_id, kind, title, note, domain, position, collection_id, is_read, is_favorite, created_at) values
  ('a1000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'note', 'Canción de cuna para dormir', null, null, 'a0', 'c1000000-0000-0000-0000-000000000001', false, true, now()),
  ('a1000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'note', 'Receta de pan', null, null, 'a1', null, true, false, now() - interval '1 hour'),
  ('a1000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'link', 'Gardening', 'zanahoria tips', 'garden.com', 'a2', null, false, false, now() - interval '30 days'),
  ('a1000000-0000-0000-0000-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'note', 'Zanahoria soup', null, null, 'a3', null, false, false, now() - interval '2 hours');
insert into public.items (id, user_id, kind, title, position, archived_at) values
  ('a1000000-0000-0000-0000-000000000005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'note', 'Archived thing', 'a4', now());
insert into public.items (id, user_id, kind, title, position, deleted_at) values
  ('a1000000-0000-0000-0000-000000000006', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'note', 'Trashed thing', 'a5', now());
insert into public.items (id, user_id, kind, title, position) values
  ('b1000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'note', 'Canción de B', 'a0');
insert into public.item_tags (item_id, tag_id, user_id) values
  ('a1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('a1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('a1000000-0000-0000-0000-000000000002', 'd1000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');

-- anon cannot execute
set local role anon;
select throws_ok($$ select * from public.search_items('x') $$, '42501', null, 'anon cannot execute search_items');

set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'role', 'authenticated', 'is_anonymous', false)::text, true);

create function pg_temp.ids(q text, r jsonb default '{}'::jsonb, l int default 50) returns text[]
language sql as $$
  select coalesce(array_agg(right(id::text, 3) order by ord), '{}') from (
    select id, row_number() over () as ord from public.search_items(q, r, l)) s
$$;

select is(pg_temp.ids('cancion'), array['001'], '"cancion" finds "Canción" (accent-insensitive, own rows only)');
select is(pg_temp.ids('CANCIÓN'), array['001'], 'accented uppercase query matches too');
select is(pg_temp.ids('cancoin'), array['001'], 'transposition typo "cancoin" finds "Canción de cuna para dormir"');
select is(pg_temp.ids('reseta'), array['002'], 'typo "reseta" finds "Receta de pan"');
select is(pg_temp.ids('zzzzqqq'), '{}'::text[], 'unrelated query matches nothing');
select is(pg_temp.ids('zanahoria'), array['004','003'], 'title match ranks above note-only match');
select is(pg_temp.ids(null), array['001','002','004','003'], 'null q: live items, newest first');
select is(pg_temp.ids('   '), array['001','002','004','003'], 'blank q behaves like null');
select is(pg_temp.ids('', '{"kinds":["link"]}'), array['003'], 'kinds rule');
select is(pg_temp.ids('', '{"collectionIds":["c1000000-0000-0000-0000-000000000001"]}'), array['001'], 'collectionIds rule');
select is(pg_temp.ids('', '{"tagIds":["d1000000-0000-0000-0000-000000000001"]}'), array['001','002'], 'single tag rule');
select is(pg_temp.ids('', '{"tagIds":["d1000000-0000-0000-0000-000000000001","d1000000-0000-0000-0000-000000000002"]}'), array['001'], 'tagIds match ALL');
select is(pg_temp.ids('', '{"domains":["garden.com"]}'), array['003'], 'domains rule');
select is(pg_temp.ids('', '{"isRead":true}'), array['002'], 'isRead rule');
select is(pg_temp.ids('', '{"isFavorite":true}'), array['001'], 'isFavorite rule');
select is(pg_temp.ids('', '{"savedWithinDays":7}'), array['001','002','004'], 'savedWithinDays rule');
select is(pg_temp.ids('', '{"query":"cancion"}'), array['001'], 'rules.query is an extra unaccented FTS filter');
select is(pg_temp.ids('', '{"inbox":true}'), array['002','004','003'], 'inbox rule: no collection');
select is(pg_temp.ids('', '{"scope":"archived"}'), array['005'], 'scope archived');
select is(pg_temp.ids('', '{"scope":"trashed"}'), array['006'], 'scope trashed');
select is(cardinality(pg_temp.ids('', '{}', 2)), 2, 'lim caps the result');
select is(cardinality(pg_temp.ids('', '{}', 0)), 1, 'lim below 1 is clamped to 1');

select * from finish();
rollback;
