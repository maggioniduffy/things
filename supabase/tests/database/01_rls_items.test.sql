-- items: row-level security, ownership of collection_id, defaults and updated_at.
begin;
select plan(17);

-- Rows-affected helper: runs a DML statement as the current role and returns the row count.
create function pg_temp.affected(q text) returns bigint
language plpgsql as $$
declare n bigint;
begin
  execute q;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Fixtures (as postgres, RLS bypassed)
insert into auth.users (id, email, is_anonymous, aud, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@test.local', false, 'authenticated', 'authenticated'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@test.local', false, 'authenticated', 'authenticated');

insert into public.collections (id, user_id, name, position) values
  ('ac000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A box', 'a0'),
  ('bc000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'B box', 'a0');

insert into public.items (id, user_id, kind, title, position, updated_at) values
  ('a1000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'note', 'A item', 'a0', '2020-01-01'),
  ('b1000000-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'note', 'B item', 'a0', '2020-01-01');

-- ---------------------------------------------------------------- user A
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'role', 'authenticated', 'is_anonymous', false)::text, true);

select results_eq(
  $$ select id from public.items $$,
  $$ values ('a1000000-0000-0000-0000-000000000001'::uuid) $$,
  'A sees only their own items'
);

select is_empty(
  $$ select 1 from public.items where id = 'b1000000-0000-0000-0000-000000000001' $$,
  'A cannot select B''s item by id'
);

select is(
  pg_temp.affected($$ update public.items set title = 'hacked' where id = 'b1000000-0000-0000-0000-000000000001' $$),
  0::bigint,
  'A updating B''s item affects 0 rows'
);

select is(
  pg_temp.affected($$ delete from public.items where id = 'b1000000-0000-0000-0000-000000000001' $$),
  0::bigint,
  'A deleting B''s item affects 0 rows'
);

select throws_ok(
  $$ insert into public.items (user_id, kind, position)
     values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'note', 'a1') $$,
  '42501', null,
  'A cannot insert an item with user_id = B'
);

select throws_ok(
  $$ insert into public.items (kind, position, collection_id)
     values ('note', 'a1', 'bc000000-0000-0000-0000-000000000001') $$,
  '42501', null,
  'A cannot insert an item into B''s collection'
);

select throws_ok(
  $$ update public.items set collection_id = 'bc000000-0000-0000-0000-000000000001'
     where id = 'a1000000-0000-0000-0000-000000000001' $$,
  '42501', null,
  'A cannot move their item into B''s collection'
);

select throws_ok(
  $$ update public.items set user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
     where id = 'a1000000-0000-0000-0000-000000000001' $$,
  '42501', null,
  'A cannot hand their item over to B'
);

select lives_ok(
  $$ insert into public.items (id, kind, position, collection_id)
     values ('a1000000-0000-0000-0000-000000000002', 'note', 'a1', 'ac000000-0000-0000-0000-000000000001') $$,
  'A can insert an item into their own collection'
);

select lives_ok(
  $$ update public.items set collection_id = 'ac000000-0000-0000-0000-000000000001'
     where id = 'a1000000-0000-0000-0000-000000000001' $$,
  'A can move their item into their own collection'
);

select is(
  (select user_id from public.items where id = 'a1000000-0000-0000-0000-000000000002'),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'user_id defaults to auth.uid()'
);

select ok(
  (select updated_at > '2020-01-01'::timestamptz from public.items where id = 'a1000000-0000-0000-0000-000000000001'),
  'updated_at is bumped by the update trigger'
);

select is(
  pg_temp.affected($$ delete from public.items where id = 'a1000000-0000-0000-0000-000000000002' $$),
  1::bigint,
  'A can delete their own item'
);

-- ---------------------------------------------------------------- user B
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'role', 'authenticated', 'is_anonymous', false)::text, true);

select results_eq(
  $$ select id from public.items $$,
  $$ values ('b1000000-0000-0000-0000-000000000001'::uuid) $$,
  'B sees only their own items'
);

select is(
  pg_temp.affected($$ update public.items set title = 'hacked' where id = 'a1000000-0000-0000-0000-000000000001' $$),
  0::bigint,
  'B updating A''s item affects 0 rows'
);

select is(
  pg_temp.affected($$ delete from public.items where id = 'a1000000-0000-0000-0000-000000000001' $$),
  0::bigint,
  'B deleting A''s item affects 0 rows'
);

-- ---------------------------------------------------------------- back to postgres: nothing leaked
reset role;

select results_eq(
  $$ select id, title from public.items order by id $$,
  $$ values ('a1000000-0000-0000-0000-000000000001'::uuid, 'A item'),
            ('b1000000-0000-0000-0000-000000000001'::uuid, 'B item') $$,
  'both original items are untouched after cross-user attempts'
);

select * from finish();
rollback;
