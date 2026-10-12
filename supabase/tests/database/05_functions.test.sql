-- save_canvas_layout, item_counts view and unfurl_log policies.
begin;
select plan(18);

create function pg_temp.affected(q text) returns bigint
language plpgsql as $$
declare n bigint;
begin
  execute q;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Fixtures (as postgres)
insert into auth.users (id, email, is_anonymous, aud, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@test.local', false, 'authenticated', 'authenticated'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@test.local', false, 'authenticated', 'authenticated');

-- A: two links (same flags) and one favorite note. B: three links.
insert into public.items (id, user_id, kind, title, position, is_favorite) values
  ('a1000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'link', 'A link 1', 'a0', false),
  ('a1000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'link', 'A link 2', 'a1', false),
  ('a1000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'note', 'A note', 'a2', true),
  ('b1000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'link', 'B link 1', 'a0', false),
  ('b1000000-0000-0000-0000-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'link', 'B link 2', 'a1', false),
  ('b1000000-0000-0000-0000-000000000003', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'link', 'B link 3', 'a2', false);
update public.items set canvas_x = 5, canvas_y = 6, canvas_w = 7, canvas_h = 8, canvas_z = 0
  where id = 'b1000000-0000-0000-0000-000000000001';

insert into public.unfurl_log (user_id, url) values
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'https://b.example.com');

-- ---------------------------------------------------------------- user A
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'role', 'authenticated', 'is_anonymous', false)::text, true);

-- save_canvas_layout
select lives_ok(
  $$ select public.save_canvas_layout('[
       {"id":"a1000000-0000-0000-0000-000000000001","x":10,"y":20,"w":100,"h":50,"z":3},
       {"id":"b1000000-0000-0000-0000-000000000001","x":999,"y":999,"w":1,"h":1,"z":9}
     ]'::jsonb) $$,
  'A can call save_canvas_layout, including a foreign item id');

-- item_counts
select results_eq(
  $$ select kind::text, n from public.item_counts order by kind $$,
  $$ values ('link', 2), ('note', 1) $$,
  'item_counts returns only A''s rows with correct counts');
select is(
  (select sum(n)::int from public.item_counts),
  3,
  'item_counts totals A''s three items, not B''s');

-- unfurl_log
select lives_ok(
  $$ insert into public.unfurl_log (url) values ('https://a.example.com') $$,
  'A can insert into unfurl_log (user_id defaults to A)');
select results_eq(
  $$ select url from public.unfurl_log $$,
  $$ values ('https://a.example.com') $$,
  'A sees only their own unfurl_log rows');
select throws_ok(
  $$ insert into public.unfurl_log (user_id, url)
     values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'https://evil.example.com') $$,
  '42501', null, 'A cannot insert an unfurl_log row for B');
select is(
  pg_temp.affected($$ update public.unfurl_log set url = 'https://changed.example.com' $$),
  0::bigint, 'unfurl_log is append-only: update affects 0 rows');
select is(
  pg_temp.affected($$ delete from public.unfurl_log $$),
  0::bigint, 'unfurl_log is append-only: delete affects 0 rows');
select results_eq(
  $$ select url from public.unfurl_log $$,
  $$ values ('https://a.example.com') $$,
  'A''s log row is intact after the update/delete attempts');

-- ---------------------------------------------------------------- user B
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'role', 'authenticated', 'is_anonymous', false)::text, true);

select results_eq(
  $$ select url from public.unfurl_log $$,
  $$ values ('https://b.example.com') $$,
  'B cannot see A''s unfurl_log row');
select results_eq(
  $$ select kind::text, n from public.item_counts $$,
  $$ values ('link', 3) $$,
  'item_counts for B counts only B''s items');

-- ---------------------------------------------------------------- back to postgres: verify layout effects
reset role;

select results_eq(
  $$ select canvas_x, canvas_y, canvas_w, canvas_h, canvas_z from public.items
     where id = 'a1000000-0000-0000-0000-000000000001' $$,
  $$ values (10::real, 20::real, 100::real, 50::real, 3) $$,
  'A''s item was moved by save_canvas_layout');
select results_eq(
  $$ select canvas_x, canvas_y, canvas_w, canvas_h, canvas_z from public.items
     where id = 'b1000000-0000-0000-0000-000000000001' $$,
  $$ values (5::real, 6::real, 7::real, 8::real, 0) $$,
  'B''s item is unchanged after A passed its id to save_canvas_layout');
select is(
  (select count(*)::int from public.items where canvas_x = 999),
  0,
  'no item anywhere received the foreign coordinates');
select is(
  (select count(*)::int from public.unfurl_log),
  2,
  'unfurl_log holds exactly the two original inserts');
select is(
  (select url from public.unfurl_log where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  'https://b.example.com',
  'B''s log row is untouched');

-- anon: save_canvas_layout is not executable at all
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$ select public.save_canvas_layout('[{"id":"b1000000-0000-0000-0000-000000000001","x":42,"y":42,"w":1,"h":1,"z":1}]'::jsonb) $$,
  '42501', null,
  'anon cannot execute save_canvas_layout');
reset role;
select is(
  (select canvas_x from public.items where id = 'b1000000-0000-0000-0000-000000000001'),
  5::real,
  'anon''s save_canvas_layout moved nothing');

select * from finish();
rollback;
