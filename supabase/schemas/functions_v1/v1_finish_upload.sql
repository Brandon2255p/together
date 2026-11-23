-- The last step of an upload: once the browser has put the file's encrypted objects in Storage, check they're all
-- there and no bigger than the row said (the quota was checked against that), record their real size, and make the
-- file ready. Only the person uploading it can finish it. A failed check leaves the row uploading; the purge job
-- clears those after a day.

create function public.v1_finish_upload(p_id uuid)
returns public.files
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_file public.files;
  v_expected integer;
  v_count integer;
  v_size bigint;
begin
  select * into v_file from public.files
  where id = p_id
    and together_id = public.my_together_id()
    and uploaded_by = auth.uid()
    and status = 'uploading'
  for update;
  if not found then
    raise exception 'That upload isn''t waiting to finish.' using errcode = 'P0002';
  end if;

  v_expected := 1 + (v_file.thumb_path is not null)::integer + (v_file.preview_path is not null)::integer;
  select count(*), coalesce(sum((o.metadata ->> 'size')::bigint), 0) into v_count, v_size
  from storage.objects o
  where o.bucket_id = 'files' and o.name in (v_file.original_path, v_file.thumb_path, v_file.preview_path);

  if v_count <> v_expected then
    raise exception 'Part of the upload is missing.' using errcode = 'P0002';
  end if;
  if v_size > v_file.stored_bytes or v_size = 0 then
    raise exception 'The upload doesn''t match what was expected.' using errcode = '22023';
  end if;

  update public.files set status = 'ready', stored_bytes = v_size where id = p_id returning * into v_file;
  return v_file;
end;
$$;

revoke execute on function public.v1_finish_upload(uuid) from public, anon;
grant execute on function public.v1_finish_upload(uuid) to authenticated;
