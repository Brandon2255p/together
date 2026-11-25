-- Undo an upload that didn't finish (a send or the size check failed): the row goes, so it no longer holds the
-- duplicate guard or counts against the quota. Only the person uploading it can abort it, and only while it's still
-- uploading. Returns the object paths the row named, for the app's server to delete from S3 (any it misses, the
-- daily clean-up removes: see v1_sweep_stale_uploads). Aborting twice, or something already finished, returns nothing.

create function public.v1_abort_upload(p_id uuid)
returns setof text
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.files
    where id = p_id
      and together_id = public.my_together_id()
      and uploaded_by = auth.uid()
      and status = 'uploading'
    returning original_path, thumb_path, preview_path
  )
  select p from gone, unnest(array[gone.original_path, gone.thumb_path, gone.preview_path]) as p where p is not null;
$$;

revoke execute on function public.v1_abort_upload(uuid) from public, anon;
grant execute on function public.v1_abort_upload(uuid) to authenticated;
