insert into storage.buckets (id, name, public, file_size_limit)
values ('things', 'things', false, 52428800)
on conflict (id) do nothing;

create policy "things select own" on storage.objects for select to authenticated
  using (bucket_id = 'things' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "things insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'things' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "things update own" on storage.objects for update to authenticated
  using (bucket_id = 'things' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'things' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "things delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'things' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Authoritative guest quota. The storage service inserts the final row as service_role, so JWT
-- claims are not available here; owner_id and the server-measured metadata.size are.
create function public.enforce_guest_storage_quota() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_guest boolean;
  new_size bigint;
  used bigint;
begin
  if new.owner_id is null then
    return new;
  end if;

  select u.is_anonymous into is_guest
  from auth.users u
  where u.id = new.owner_id::uuid;

  if not coalesce(is_guest, false) then
    return new;
  end if;

  -- Serialize a guest's concurrent uploads so parallel requests can't each pass the sum check.
  perform pg_advisory_xact_lock(hashtextextended('things_guest_quota:' || new.owner_id, 0));

  new_size := coalesce((new.metadata->>'size')::bigint, 0);
  if new_size > 10485760 then
    raise exception 'guest_quota_exceeded' using errcode = 'P0001';
  end if;

  select coalesce(sum(coalesce((o.metadata->>'size')::bigint, 0)), 0) into used
  from storage.objects o
  where o.bucket_id = 'things'
    and o.owner_id = new.owner_id
    and o.id <> new.id
    and o.name <> new.name; -- an upsert replaces the object with the same name: don't count it twice

  if used + new_size > 26214400 then
    raise exception 'guest_quota_exceeded' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke execute on function public.enforce_guest_storage_quota() from public, anon, authenticated;

create trigger things_guest_storage_quota
  before insert or update on storage.objects
  for each row
  when (new.bucket_id = 'things')
  execute function public.enforce_guest_storage_quota();
