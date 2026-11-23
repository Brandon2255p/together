-- Search the current Together's Gallery and Files. Every word has to match the name, a tag, the folder's name or the
-- name of whoever added it. Dates refine to a year, or a month of a year, never finer, in the Together's time zone.
-- Newest taken first; pass the last row's taken_at and id to get the next page. Binned and unfinished files are left out.

create function public.v1_search_files(
  p_query text default null,
  p_kinds public.file_kind[] default null,
  p_year integer default null,
  p_month integer default null,
  p_limit integer default 50,
  p_before_taken_at timestamptz default null,
  p_before_id uuid default null
)
returns setof public.files
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_words text[];
begin
  if p_month is not null and p_year is null then
    raise exception 'Pick a year before a month.' using errcode = '22023';
  end if;
  if p_month is not null and p_month not between 1 and 12 then
    raise exception 'There''s no month %.', p_month using errcode = '22023';
  end if;

  -- words, with LIKE's wildcards escaped
  select coalesce(array_agg(replace(replace(replace(w, '\', '\\'), '%', '\%'), '_', '\_')), '{}')
  into v_words
  from unnest(regexp_split_to_array(lower(btrim(coalesce(p_query, ''))), '\s+')) w
  where w <> '';

  return query
    select f.*
    from public.files f
    join public.togethers t on t.id = f.together_id
    left join public.file_folders d on d.id = f.folder_id
    left join public.profiles p on p.id = f.uploaded_by
    where f.together_id = (select public.my_together_id())
      and f.status = 'ready'
      and f.deleted_at is null
      and (p_kinds is null or f.kind = any (p_kinds))
      and (p_year is null or extract(year from f.taken_at at time zone t.time_zone) = p_year)
      and (p_month is null or extract(month from f.taken_at at time zone t.time_zone) = p_month)
      and (p_before_taken_at is null or (f.taken_at, f.id) < (p_before_taken_at, p_before_id))
      and not exists (
        select 1 from unnest(v_words) w
        where not (
          lower(f.name) like '%' || w || '%'
          or exists (select 1 from unnest(f.tags) tag where tag like '%' || w || '%')
          or lower(coalesce(d.name, '')) like '%' || w || '%'
          or lower(coalesce(p.name, '')) like '%' || w || '%'
        )
      )
    order by f.taken_at desc, f.id desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200);
end;
$$;

revoke execute on function public.v1_search_files(text, public.file_kind[], integer, integer, integer, timestamptz, uuid) from public, anon;
grant execute on function public.v1_search_files(text, public.file_kind[], integer, integer, integer, timestamptz, uuid) to authenticated;
