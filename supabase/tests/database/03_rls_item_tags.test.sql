-- item_tags: a link must join the caller's own item with the caller's own tag.
begin;
select plan(9);

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

insert into public.items (id, user_id, kind, title, position) values
  ('a1000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'note', 'A item', 'a0'),
  ('b1000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'note', 'B item', 'a0');

insert into public.tags (id, user_id, name) values
  ('a7000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A tag'),
  ('b7000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'B tag');

insert into public.item_tags (item_id, tag_id, user_id) values
  ('b1000000-0000-0000-0000-000000000001', 'b7000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

-- ---------------------------------------------------------------- user A
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'role', 'authenticated', 'is_anonymous', false)::text, true);

select throws_ok(
  $$ insert into public.item_tags (item_id, tag_id)
     values ('a1000000-0000-0000-0000-000000000001', 'b7000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'A cannot link their item to B''s tag');

select throws_ok(
  $$ insert into public.item_tags (item_id, tag_id)
     values ('b1000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'A cannot link B''s item to their own tag');

select throws_ok(
  $$ insert into public.item_tags (item_id, tag_id, user_id)
     values ('a1000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000001',
             'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') $$,
  '42501', null, 'A cannot insert a link with user_id = B');

select throws_ok(
  $$ insert into public.item_tags (item_id, tag_id, user_id)
     values ('b1000000-0000-0000-0000-000000000001', 'b7000000-0000-0000-0000-000000000001',
             'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') $$,
  '42501', null, 'A cannot claim a link between B''s own item and tag');

select lives_ok(
  $$ insert into public.item_tags (item_id, tag_id)
     values ('a1000000-0000-0000-0000-000000000001', 'a7000000-0000-0000-0000-000000000001') $$,
  'A can link their own item and their own tag');

select results_eq(
  $$ select item_id from public.item_tags $$,
  $$ values ('a1000000-0000-0000-0000-000000000001'::uuid) $$,
  'A sees only their own link');

select is(
  pg_temp.affected($$ delete from public.item_tags where item_id = 'b1000000-0000-0000-0000-000000000001' $$),
  0::bigint, 'A cannot delete B''s link');

-- ---------------------------------------------------------------- user B
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'role', 'authenticated', 'is_anonymous', false)::text, true);

select results_eq(
  $$ select item_id from public.item_tags $$,
  $$ values ('b1000000-0000-0000-0000-000000000001'::uuid) $$,
  'B sees only their own link');

-- ---------------------------------------------------------------- back to postgres
reset role;

select is(
  (select count(*)::int from public.item_tags where user_id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')),
  2,
  'exactly two links exist: B''s original and A''s legitimate one');

select * from finish();
rollback;
