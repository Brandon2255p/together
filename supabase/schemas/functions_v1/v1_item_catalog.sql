-- The autocomplete's names: what this Together has added before, plus items at least three Togethers buy.
-- SECURITY DEFINER to count across Togethers. It only ever returns a name, never whose it was.
create or replace function public.v1_item_catalog()
returns table (name text, times_added integer, popular boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select h.name_key, h.name, h.times_added
    from public.item_history h
    where h.together_id = public.my_together_id()
  ),
  popular as (
    select h.name_key, min(h.name) as name
    from public.item_history h
    group by h.name_key
    having count(*) >= 3
    order by count(*) desc
    limit 200
  )
  select coalesce(m.name, p.name), coalesce(m.times_added, 0), p.name_key is not null
  from mine m
  full join popular p using (name_key)
  where public.my_together_id() is not null;
$$;

revoke execute on function public.v1_item_catalog() from public, anon;
grant execute on function public.v1_item_catalog() to authenticated;
