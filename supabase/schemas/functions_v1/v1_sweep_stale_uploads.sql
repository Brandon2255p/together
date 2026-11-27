-- The daily clean-up (app/api/cron/files-cleanup), for uploads nobody aborted (the tab closed, the network went):
-- rows still uploading an hour after they started (their signed URLs died after 15 minutes) are deleted, in every
-- Together. Returns their object paths for the job to delete from S3. Server only.

create function public.v1_sweep_stale_uploads()
returns setof text
language sql
security definer
set search_path = ''
as $$
  with gone as (
    delete from public.files
    where status = 'uploading' and created_at < now() - interval '1 hour'
    returning original_path, thumb_path, preview_path
  )
  select p from gone, unnest(array[gone.original_path, gone.thumb_path, gone.preview_path]) as p where p is not null;
$$;

revoke execute on function public.v1_sweep_stale_uploads() from public, anon, authenticated;
grant execute on function public.v1_sweep_stale_uploads() to service_role;
