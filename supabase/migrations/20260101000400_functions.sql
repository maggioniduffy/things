-- One call saves every moved or resized canvas node. security invoker keeps RLS in force.
create function public.save_canvas_layout(layout jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  update public.items i set
    canvas_x = (l->>'x')::real,
    canvas_y = (l->>'y')::real,
    canvas_w = (l->>'w')::real,
    canvas_h = (l->>'h')::real,
    canvas_z = (l->>'z')::int,
    updated_at = now()
  from jsonb_array_elements(layout) l
  where i.id = (l->>'id')::uuid
    and i.user_id = (select auth.uid());
$$;

-- Sidebar badges: the client sums these rows
create view public.item_counts
with (security_invoker = true) as
select
  kind,
  collection_id,
  is_read,
  is_favorite,
  (archived_at is not null) as archived,
  (deleted_at is not null) as deleted,
  count(*)::int as n
from public.items
group by 1, 2, 3, 4, 5, 6;

-- Friendly early guest quota check. The client writes file_size, so it can lie;
-- the authoritative check is the storage.objects trigger (see storage migration).
create function public.enforce_guest_item_quota() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  used bigint;
begin
  if coalesce((auth.jwt()->>'is_anonymous')::boolean, false) and new.file_size is not null then
    if new.file_size > 10485760 then
      raise exception 'guest_quota_exceeded' using errcode = 'P0001';
    end if;
    select coalesce(sum(i.file_size), 0) into used
    from public.items i
    where i.user_id = new.user_id
      and i.id <> new.id
      and i.deleted_at is null;
    if used + new.file_size > 26214400 then
      raise exception 'guest_quota_exceeded' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger items_guest_quota
  before insert or update of file_size on public.items
  for each row execute function public.enforce_guest_item_quota();
