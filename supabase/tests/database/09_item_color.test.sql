-- items.color: a fixed palette for notes; null means the default look.
begin;
select plan(4);

insert into auth.users (id, email, is_anonymous, aud, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@test.local', false, 'authenticated', 'authenticated');

select lives_ok(
  $$insert into public.items (id, user_id, kind, title, position, color) values
    ('a1000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'note', 'n', 'a0', 'graphite')$$,
  'a palette color is accepted');

select lives_ok(
  $$insert into public.items (id, user_id, kind, title, position) values
    ('a1000000-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'note', 'n', 'a1')$$,
  'color defaults to null');

select throws_ok(
  $$insert into public.items (id, user_id, kind, title, position, color) values
    ('a1000000-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'note', 'n', 'a2', 'green')$$,
  '23514', null, 'a color outside the palette is rejected');

select lives_ok(
  $$update public.items set color = null where id = 'a1000000-0000-0000-0000-000000000001'$$,
  'color can be cleared to null');

select * from finish();
rollback;
