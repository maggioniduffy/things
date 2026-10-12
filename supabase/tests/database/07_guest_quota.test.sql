-- Guest quota: 10 MB per file and 25 MB in total, on items.file_size (friendly check)
-- and on storage.objects (authoritative check). Regular users are never limited.
-- Sizes: 9 MB = 9437184, 10 MB = 10485760, 11 MB = 11534336, 25 MB = 26214400.
begin;
select plan(25);

-- Fixtures (as postgres)
insert into auth.users (id, email, is_anonymous, aud, role) values
  -- items section
  ('11111111-1111-1111-1111-111111111111', null, true,  'authenticated', 'authenticated'),  -- guest
  ('12121212-1212-1212-1212-121212121212', null, true,  'authenticated', 'authenticated'),  -- guest, exact limits
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'r@test.local', false, 'authenticated', 'authenticated'),  -- regular
  -- storage section
  ('51515151-5151-5151-5151-515151515151', null, true,  'authenticated', 'authenticated'),  -- guest, add
  ('52525252-5252-5252-5252-525252525252', null, true,  'authenticated', 'authenticated'),  -- guest, update
  ('53535353-5353-5353-5353-535353535353', null, true,  'authenticated', 'authenticated'),  -- guest, other bucket
  ('54545454-5454-5454-5454-545454545454', 's@test.local', false, 'authenticated', 'authenticated');  -- regular

insert into storage.buckets (id, name, public) values ('other', 'other', false);

-- ================================================================ items trigger
-- Guest: 11 MB, then 9 + 9 OK, then +9 rejected
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111', 'role', 'authenticated', 'is_anonymous', true)::text, true);

select throws_ok(
  $$ insert into public.items (kind, position, file_size) values ('pdf', 'a0', 11534336) $$,
  'P0001', 'guest_quota_exceeded', 'items: a guest cannot save an 11 MB file');

select lives_ok(
  $$ insert into public.items (id, kind, position, file_size)
     values ('c1000000-0000-0000-0000-000000000001', 'pdf', 'a0', 9437184) $$,
  'items: a guest can save a 9 MB file');

select lives_ok(
  $$ insert into public.items (id, kind, position, file_size)
     values ('c1000000-0000-0000-0000-000000000002', 'pdf', 'a1', 9437184) $$,
  'items: a guest can save a second 9 MB file (18 MB total)');

select throws_ok(
  $$ insert into public.items (kind, position, file_size) values ('pdf', 'a2', 9437184) $$,
  'P0001', 'guest_quota_exceeded', 'items: a third 9 MB file would pass 25 MB and is rejected');

select throws_ok(
  $$ update public.items set file_size = 11534336 where id = 'c1000000-0000-0000-0000-000000000001' $$,
  'P0001', 'guest_quota_exceeded', 'items: growing an existing file past 10 MB is rejected');

select lives_ok(
  $$ insert into public.items (kind, position, title) values ('note', 'a3', 'no file') $$,
  'items: a guest at 18 MB can still save items without a file');

-- Soft-deleted items stop counting toward the total
update public.items set deleted_at = now() where id = 'c1000000-0000-0000-0000-000000000001';
select lives_ok(
  $$ insert into public.items (kind, position, file_size) values ('pdf', 'a4', 9437184) $$,
  'items: a soft-deleted file frees its quota');

-- Guest: exact limits are allowed (10 MB per file, 25 MB total), one byte more is not
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', '12121212-1212-1212-1212-121212121212', 'role', 'authenticated', 'is_anonymous', true)::text, true);

select lives_ok(
  $$ insert into public.items (kind, position, file_size) values ('pdf', 'a0', 10485760) $$,
  'items: a guest can save a file of exactly 10 MB');
select lives_ok(
  $$ insert into public.items (kind, position, file_size) values ('pdf', 'a1', 10485760) $$,
  'items: a second 10 MB file is fine (20 MB total)');
select lives_ok(
  $$ insert into public.items (kind, position, file_size) values ('pdf', 'a2', 5242880) $$,
  'items: a guest can reach exactly 25 MB in total');
select throws_ok(
  $$ insert into public.items (kind, position, file_size) values ('pdf', 'a3', 1) $$,
  'P0001', 'guest_quota_exceeded', 'items: one byte past 25 MB is rejected');

-- Regular user: 11 MB OK, 30 MB total OK
reset role;
set local role authenticated;
select set_config('request.jwt.claims',
  json_build_object('sub', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'role', 'authenticated', 'is_anonymous', false)::text, true);

select lives_ok(
  $$ insert into public.items (kind, position, file_size) values ('pdf', 'a0', 11534336) $$,
  'items: a regular user can save an 11 MB file');
select lives_ok(
  $$ insert into public.items (kind, position, file_size) values ('pdf', 'a1', 19922944) $$,
  'items: a regular user can reach 30 MB in total');

reset role;

-- ================================================================ storage trigger (as postgres, like the storage service)
-- Guest: 11 MB, then 9 + 9 OK, then +9 rejected
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id, metadata)
     values ('things', '51515151-5151-5151-5151-515151515151/big', '51515151-5151-5151-5151-515151515151',
             jsonb_build_object('size', 11534336)) $$,
  'P0001', 'guest_quota_exceeded', 'storage: a guest cannot store an 11 MB object');

select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id, metadata)
     values ('things', '51515151-5151-5151-5151-515151515151/one', '51515151-5151-5151-5151-515151515151',
             jsonb_build_object('size', 9437184)) $$,
  'storage: a guest can store a 9 MB object');

select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id, metadata)
     values ('things', '51515151-5151-5151-5151-515151515151/two', '51515151-5151-5151-5151-515151515151',
             jsonb_build_object('size', 9437184)) $$,
  'storage: a guest can store a second 9 MB object (18 MB total)');

select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id, metadata)
     values ('things', '51515151-5151-5151-5151-515151515151/three', '51515151-5151-5151-5151-515151515151',
             jsonb_build_object('size', 9437184)) $$,
  'P0001', 'guest_quota_exceeded', 'storage: a third 9 MB object would pass 25 MB and is rejected');

-- Non-guest owner is unaffected
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id, metadata)
     values ('things', '54545454-5454-5454-5454-545454545454/one', '54545454-5454-5454-5454-545454545454',
             jsonb_build_object('size', 11534336)) $$,
  'storage: a regular user can store an 11 MB object');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id, metadata)
     values ('things', '54545454-5454-5454-5454-545454545454/two', '54545454-5454-5454-5454-545454545454',
             jsonb_build_object('size', 19922944)) $$,
  'storage: a regular user can reach 30 MB in total');

-- Updates: a guest at 24 MB (10 + 10 + 4)
insert into storage.objects (bucket_id, name, owner_id, metadata) values
  ('things', '52525252-5252-5252-5252-525252525252/a', '52525252-5252-5252-5252-525252525252', jsonb_build_object('size', 10485760)),
  ('things', '52525252-5252-5252-5252-525252525252/b', '52525252-5252-5252-5252-525252525252', jsonb_build_object('size', 10485760)),
  ('things', '52525252-5252-5252-5252-525252525252/c', '52525252-5252-5252-5252-525252525252', jsonb_build_object('size', 4194304));

select throws_ok(
  $$ update storage.objects set metadata = jsonb_build_object('size', 6291456)
     where name = '52525252-5252-5252-5252-525252525252/c' $$,
  'P0001', 'guest_quota_exceeded', 'storage: an update that grows a guest past 25 MB in total is rejected');

select throws_ok(
  $$ update storage.objects set metadata = jsonb_build_object('size', 11534336)
     where name = '52525252-5252-5252-5252-525252525252/a' $$,
  'P0001', 'guest_quota_exceeded', 'storage: an update that grows one guest object past 10 MB is rejected');

select lives_ok(
  $$ update storage.objects set metadata = jsonb_build_object('size', 5242880)
     where name = '52525252-5252-5252-5252-525252525252/c' $$,
  'storage: an update that lands exactly on 25 MB is allowed');

-- Other buckets are ignored by both the trigger and the sum
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id, metadata)
     values ('other', '53535353-5353-5353-5353-535353535353/huge', '53535353-5353-5353-5353-535353535353',
             jsonb_build_object('size', 31457280)) $$,
  'storage: a 30 MB guest object in another bucket is ignored by the trigger');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id, metadata)
     values ('things', '53535353-5353-5353-5353-535353535353/one', '53535353-5353-5353-5353-535353535353',
             jsonb_build_object('size', 9437184)) $$,
  'storage: other-bucket objects do not count toward the guest total (9 MB OK)');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id, metadata)
     values ('things', '53535353-5353-5353-5353-535353535353/two', '53535353-5353-5353-5353-535353535353',
             jsonb_build_object('size', 9437184)) $$,
  'storage: a second 9 MB object is still fine (would be 48 MB if the other bucket counted)');

select * from finish();
rollback;
