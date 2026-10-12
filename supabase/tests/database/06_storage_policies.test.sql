-- storage.objects policies for the private `things` bucket: first path segment must be the caller's id.
begin;
select plan(14);

create function pg_temp.affected(q text) returns bigint
language plpgsql as $$
declare n bigint;
begin
  execute q;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Fixtures (as postgres): B owns an object, A owns one
insert into auth.users (id, email, is_anonymous, aud, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@test.local', false, 'authenticated', 'authenticated'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'b@test.local', false, 'authenticated', 'authenticated');

insert into storage.objects (bucket_id, name, owner_id, metadata) values
  ('things', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/x/file', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '{"size": 10}'),
  ('things', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/seed/file', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '{"size": 10}');

-- ---------------------------------------------------------------- user A
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'role', 'authenticated', 'is_anonymous', false)::text, true);

select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id, metadata)
     values ('things', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/x/file', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '{"size": 10}') $$,
  'A can upload into their own folder');

select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id, metadata)
     values ('things', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/y/file', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '{"size": 10}') $$,
  '42501', null, 'A cannot upload into B''s folder');

select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id, metadata)
     values ('things', 'file-at-root', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '{"size": 10}') $$,
  '42501', null, 'A cannot upload outside any user folder');

select results_eq(
  $$ select name from storage.objects where bucket_id = 'things' order by name $$,
  $$ values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/seed/file'), ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/x/file') $$,
  'A sees only objects under their own folder');

select is_empty(
  $$ select 1 from storage.objects where name = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/x/file' $$,
  'A cannot select B''s object');

select is(
  pg_temp.affected($$ update storage.objects set metadata = '{"size": 1}'
                      where name = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/x/file' $$),
  0::bigint, 'A cannot update B''s object');

select throws_ok(
  $$ update storage.objects set name = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/stolen'
     where name = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/seed/file' $$,
  '42501', null, 'A cannot move their object into B''s folder');

-- The storage service sets this flag when it deletes; direct deletes are otherwise blocked outright.
select throws_ok(
  $$ delete from storage.objects where name = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/x/file' $$,
  '42501', null, 'direct deletes without the storage flag are blocked');

set local storage.allow_delete_query = 'true';

select is(
  pg_temp.affected($$ delete from storage.objects where name = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/x/file' $$),
  0::bigint, 'A cannot delete B''s object (RLS filters it out)');

select is(
  pg_temp.affected($$ delete from storage.objects where name = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/x/file' $$),
  1::bigint, 'A can delete their own object');

-- ---------------------------------------------------------------- user B
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'role', 'authenticated', 'is_anonymous', false)::text, true);

select results_eq(
  $$ select name from storage.objects where bucket_id = 'things' $$,
  $$ values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/x/file') $$,
  'B sees only their own object, still intact');

-- ---------------------------------------------------------------- signed out
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is_empty($$ select 1 from storage.objects $$, 'anon cannot select any object');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id, metadata)
     values ('things', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/anon/file', null, '{"size": 10}') $$,
  '42501', null, 'anon cannot upload');

-- ---------------------------------------------------------------- back to postgres
reset role;

select is(
  (select count(*)::int from storage.objects where bucket_id = 'things'
     and owner_id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')),
  2,
  'exactly A''s seed object and B''s object remain');

select * from finish();
rollback;
