-- The last step of an upload, now that files live in S3 (infra/storage): the app's server checks the encrypted
-- objects arrived (each signed upload only accepts exactly the size the row declared, so stored_bytes is already
-- right), then calls this to make the file show. Only the person uploading it can finish it. Called without the
-- objects in place, the file would show broken to its own Together and still count its declared size against the
-- quota, so there's nothing to gain by skipping the check.
--
-- v1_finish_upload read Supabase Storage's objects instead; it stays until nothing calls it.

create function public.v2_finish_upload(p_id uuid)
returns public.files
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_file public.files;
begin
  update public.files set status = 'ready'
  where id = p_id
    and together_id = public.my_together_id()
    and uploaded_by = auth.uid()
    and status = 'uploading'
  returning * into v_file;
  if not found then
    raise exception 'That upload isn''t waiting to finish.' using errcode = 'P0002';
  end if;
  return v_file;
end;
$$;

revoke execute on function public.v2_finish_upload(uuid) from public, anon;
grant execute on function public.v2_finish_upload(uuid) to authenticated;
