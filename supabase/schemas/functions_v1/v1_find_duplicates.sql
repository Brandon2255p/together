-- Which of these files (by content MAC) the current Together already has, so the upload sheet can skip them and say
-- who added each one. in_bin: offer a restore instead.

create function public.v1_find_duplicates(p_macs text[])
returns table (content_mac text, file_id uuid, name text, uploaded_by_name text, created_at timestamptz, in_bin boolean)
language sql
stable
security invoker
set search_path = ''
as $$
  select f.content_mac, f.id, f.name, p.name, f.created_at, f.deleted_at is not null
  from public.files f
  left join public.profiles p on p.id = f.uploaded_by
  where f.together_id = (select public.my_together_id())
    and f.status = 'ready'
    and f.content_mac = any (p_macs);
$$;

revoke execute on function public.v1_find_duplicates(text[]) from public, anon;
grant execute on function public.v1_find_duplicates(text[]) to authenticated;
