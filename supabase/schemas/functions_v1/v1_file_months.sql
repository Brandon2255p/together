-- How many files the current Together has per year and month taken (in its time zone): the gallery's month headers
-- and the When sheet, which greys out empty months.

create function public.v1_file_months(p_kinds public.file_kind[] default null)
returns table (year integer, month integer, count integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    extract(year from f.taken_at at time zone t.time_zone)::integer,
    extract(month from f.taken_at at time zone t.time_zone)::integer,
    count(*)::integer
  from public.files f
  join public.togethers t on t.id = f.together_id
  where f.together_id = (select public.my_together_id())
    and f.status = 'ready'
    and f.deleted_at is null
    and (p_kinds is null or f.kind = any (p_kinds))
  group by 1, 2
  order by 1 desc, 2 desc;
$$;

revoke execute on function public.v1_file_months(public.file_kind[]) from public, anon;
grant execute on function public.v1_file_months(public.file_kind[]) to authenticated;
