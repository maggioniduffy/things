-- Signed-out callers (role anon) see nothing and write nothing.
begin;
select plan(14);

-- Fixtures (as postgres): one user with a row in every table
insert into auth.users (id, email, is_anonymous, aud, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@test.local', false, 'authenticated', 'authenticated');

insert into public.collections (id, user_id, name, position) values
  ('ac000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A box', 'a0');
insert into public.items (id, user_id, kind, title, position, canvas_x) values
  ('a1000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'note', 'A item', 'a0', 5);
insert into public.tags (id, user_id, name) values
  ('a7000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A tag');
insert into public.item_tags (item_id, tag_id, user_id) values
  ('a1000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
insert into public.smart_views (user_id, name, rules, position) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A view', '{}', 'a0');
insert into public.unfurl_log (user_id, url) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'https://example.com');

-- ---------------------------------------------------------------- signed out
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is_empty($$ select 1 from public.collections $$, 'anon sees no collections');
select is_empty($$ select 1 from public.items $$, 'anon sees no items');
select is_empty($$ select 1 from public.tags $$, 'anon sees no tags');
select is_empty($$ select 1 from public.item_tags $$, 'anon sees no item_tags');
select is_empty($$ select 1 from public.smart_views $$, 'anon sees no smart_views');
select is_empty($$ select 1 from public.unfurl_log $$, 'anon sees no unfurl_log rows');
select is_empty($$ select 1 from public.item_counts $$, 'anon sees nothing in item_counts');

select throws_ok(
  $$ insert into public.collections (user_id, name, position)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'x', 'a1') $$,
  '42501', null, 'anon cannot insert a collection');
select throws_ok(
  $$ insert into public.items (user_id, kind, position)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'note', 'a1') $$,
  '42501', null, 'anon cannot insert an item');
select throws_ok(
  $$ insert into public.tags (user_id, name) values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'x') $$,
  '42501', null, 'anon cannot insert a tag');
select throws_ok(
  $$ insert into public.smart_views (user_id, name, rules, position)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'x', '{}', 'a1') $$,
  '42501', null, 'anon cannot insert a smart view');
select throws_ok(
  $$ insert into public.unfurl_log (user_id, url)
     values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'https://example.com') $$,
  '42501', null, 'anon cannot insert into unfurl_log');

-- save_canvas_layout runs as invoker with auth.uid() = null: it must touch nothing
select lives_ok(
  $$ select public.save_canvas_layout('[{"id":"a1000000-0000-0000-0000-000000000001","x":99,"y":99,"w":1,"h":1,"z":1}]'::jsonb) $$,
  'anon can call save_canvas_layout without error');

reset role;

select is(
  (select canvas_x from public.items where id = 'a1000000-0000-0000-0000-000000000001'),
  5::real,
  'anon''s save_canvas_layout moved nothing');

select * from finish();
rollback;
