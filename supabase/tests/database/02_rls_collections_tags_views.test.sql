-- collections, tags, smart_views: per-user isolation, tag name uniqueness, color check.
begin;
select plan(29);

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

insert into public.collections (id, user_id, name, position) values
  ('ac000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A box', 'a0'),
  ('bc000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'B box', 'a0');

insert into public.tags (id, user_id, name) values
  ('a7000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Reading'),
  ('b7000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Reading');

insert into public.smart_views (id, user_id, name, rules, position) values
  ('a5000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A view', '{}', 'a0'),
  ('b5000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'B view', '{}', 'a0');

-- ---------------------------------------------------------------- user A
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'role', 'authenticated', 'is_anonymous', false)::text, true);

-- collections
select results_eq($$ select id from public.collections $$,
  $$ values ('ac000000-0000-0000-0000-000000000001'::uuid) $$,
  'collections: A sees only their own');
select throws_ok(
  $$ insert into public.collections (user_id, name, position)
     values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'x', 'a1') $$,
  '42501', null, 'collections: A cannot insert for B');
select is(pg_temp.affected($$ update public.collections set name = 'hacked' where id = 'bc000000-0000-0000-0000-000000000001' $$),
  0::bigint, 'collections: A cannot update B''s row');
select is(pg_temp.affected($$ delete from public.collections where id = 'bc000000-0000-0000-0000-000000000001' $$),
  0::bigint, 'collections: A cannot delete B''s row');
select throws_ok(
  $$ update public.collections set user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
     where id = 'ac000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'collections: A cannot hand their row to B');
select lives_ok(
  $$ insert into public.collections (name, position, color) values ('Second', 'a1', 'violet') $$,
  'collections: A can insert their own (valid color)');
select throws_ok(
  $$ insert into public.collections (name, position, color) values ('Bad color', 'a2', 'green') $$,
  '23514', null, 'collections: unknown color is rejected');
select lives_ok(
  $$ update public.collections set name = 'Renamed' where id = 'ac000000-0000-0000-0000-000000000001' $$,
  'collections: A can update their own');
select is(pg_temp.affected($$ delete from public.collections where name = 'Second' $$),
  1::bigint, 'collections: A can delete their own');

-- tags
select results_eq($$ select id from public.tags $$,
  $$ values ('a7000000-0000-0000-0000-000000000001'::uuid) $$,
  'tags: A sees only their own');
select throws_ok(
  $$ insert into public.tags (user_id, name) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'x') $$,
  '42501', null, 'tags: A cannot insert for B');
select is(pg_temp.affected($$ update public.tags set name = 'hacked' where id = 'b7000000-0000-0000-0000-000000000001' $$),
  0::bigint, 'tags: A cannot update B''s row');
select is(pg_temp.affected($$ delete from public.tags where id = 'b7000000-0000-0000-0000-000000000001' $$),
  0::bigint, 'tags: A cannot delete B''s row');
select throws_ok(
  $$ insert into public.tags (name) values ('reading') $$,
  '23505', null, 'tags: name is unique per user, case-insensitively');
select throws_ok(
  $$ insert into public.tags (name, color) values ('Pretty', 'green') $$,
  '23514', null, 'tags: unknown color is rejected');
select lives_ok(
  $$ insert into public.tags (name, color) values ('Pretty', 'coral') $$,
  'tags: A can insert their own (valid color)');

-- smart_views
select results_eq($$ select id from public.smart_views $$,
  $$ values ('a5000000-0000-0000-0000-000000000001'::uuid) $$,
  'smart_views: A sees only their own');
select throws_ok(
  $$ insert into public.smart_views (user_id, name, rules, position)
     values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'x', '{}', 'a1') $$,
  '42501', null, 'smart_views: A cannot insert for B');
select is(pg_temp.affected($$ update public.smart_views set name = 'hacked' where id = 'b5000000-0000-0000-0000-000000000001' $$),
  0::bigint, 'smart_views: A cannot update B''s row');
select is(pg_temp.affected($$ delete from public.smart_views where id = 'b5000000-0000-0000-0000-000000000001' $$),
  0::bigint, 'smart_views: A cannot delete B''s row');
select lives_ok(
  $$ insert into public.smart_views (name, rules, position) values ('Mine', '{"kind":"link"}', 'a1') $$,
  'smart_views: A can insert their own');
select is(pg_temp.affected($$ update public.smart_views set name = 'Mine 2' where name = 'Mine' $$),
  1::bigint, 'smart_views: A can update their own');
select is(pg_temp.affected($$ delete from public.smart_views where name = 'Mine 2' $$),
  1::bigint, 'smart_views: A can delete their own');

-- ---------------------------------------------------------------- user B
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'role', 'authenticated', 'is_anonymous', false)::text, true);

select results_eq($$ select id from public.collections $$,
  $$ values ('bc000000-0000-0000-0000-000000000001'::uuid) $$,
  'collections: B sees only their own');
select results_eq($$ select id from public.tags $$,
  $$ values ('b7000000-0000-0000-0000-000000000001'::uuid) $$,
  'tags: B sees only their own (the same tag name as A is allowed across users)');
select results_eq($$ select id from public.smart_views $$,
  $$ values ('b5000000-0000-0000-0000-000000000001'::uuid) $$,
  'smart_views: B sees only their own');
select lives_ok(
  $$ insert into public.tags (name) values ('Pretty') $$,
  'tags: B can reuse a tag name that A has');

-- ---------------------------------------------------------------- back to postgres: nothing leaked
reset role;

select results_eq(
  $$ select name from public.collections where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' $$,
  $$ values ('B box') $$,
  'B''s collection is untouched');
select results_eq(
  $$ select name from public.smart_views where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' $$,
  $$ values ('B view') $$,
  'B''s smart view is untouched');

select * from finish();
rollback;
