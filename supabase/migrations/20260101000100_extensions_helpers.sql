-- Extensions (Supabase keeps them in the `extensions` schema)
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- unaccent() is not IMMUTABLE, so wrap it to use in a generated column
create function public.f_unaccent(text) returns text
language sql immutable parallel safe strict
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, $1)
$$;

-- Generic updated_at maintenance trigger
create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
