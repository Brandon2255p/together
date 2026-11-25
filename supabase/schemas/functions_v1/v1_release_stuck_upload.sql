-- An upload of this exact file (same content MAC) that never finished is in the way of adding it again: the
-- duplicate guard counts it. Clear it when it's yours (your own retry; any attempt still running in another tab
-- loses), or when it's anyone's and older than the 15 minutes its signed upload URLs last, so it can't still be
-- sending. Ready and binned files are never touched. Returns the object paths of what was cleared, for the app's
-- server to delete from S3.

create function public.v1_release_stuck_upload(p_mac text)
returns setof text
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.files
    where together_id = public.my_together_id()
      and content_mac = p_mac
      and status = 'uploading'
      and (uploaded_by = auth.uid() or created_at < now() - interval '20 minutes')
    returning original_path, thumb_path, preview_path
  )
  select p from gone, unnest(array[gone.original_path, gone.thumb_path, gone.preview_path]) as p where p is not null;
$$;

revoke execute on function public.v1_release_stuck_upload(text) from public, anon;
grant execute on function public.v1_release_stuck_upload(text) to authenticated;
