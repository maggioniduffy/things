-- Note background color: one of the aurora brand colors, white or graphite. null = the default look.
alter table public.items
  add column color text
  check (color is null or color in ('pink','violet','blue','red','coral','olive','white','graphite'));
