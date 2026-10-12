-- items.search: generated tsvector with accent-insensitive 'simple' lexemes.
begin;
select plan(6);

insert into auth.users (id, email, is_anonymous, aud, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'a@test.local', false, 'authenticated', 'authenticated');

insert into public.items (id, user_id, kind, title, description, note, position) values
  ('a1000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'note',
   'Canción', 'Ñandú descripción', 'apuntes', 'a0');

select ok(
  (select search @@ to_tsquery('simple', 'cancion') from public.items where id = 'a1000000-0000-0000-0000-000000000001'),
  'title "Canción" produces the unaccented lexeme "cancion"');

select ok(
  (select search @@ to_tsquery('simple', 'cancion:A') from public.items where id = 'a1000000-0000-0000-0000-000000000001'),
  'title lexemes carry weight A');

select ok(
  (select search @@ to_tsquery('simple', 'descripcion:B') from public.items where id = 'a1000000-0000-0000-0000-000000000001'),
  'description lexemes are unaccented with weight B');

select ok(
  (select search @@ to_tsquery('simple', 'apuntes:C') from public.items where id = 'a1000000-0000-0000-0000-000000000001'),
  'note lexemes carry weight C');

select ok(
  not (select search @@ to_tsquery('simple', 'cancionero') from public.items where id = 'a1000000-0000-0000-0000-000000000001'),
  'unrelated words do not match');

-- The generated column follows updates to its source columns
update public.items set title = 'Corazón' where id = 'a1000000-0000-0000-0000-000000000001';
select ok(
  (select search @@ to_tsquery('simple', 'corazon') and not search @@ to_tsquery('simple', 'cancion')
   from public.items where id = 'a1000000-0000-0000-0000-000000000001'),
  'search is regenerated when the title changes');

select * from finish();
rollback;
