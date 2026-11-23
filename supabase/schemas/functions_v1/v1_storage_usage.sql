-- How much of the current Together's storage quota is used, and by what: the storage card on the Together screen,
-- and the upload sheet's "will it fit?" check. Bytes are as stored (encrypted, thumbnails included). Uploads still in
-- progress count towards used_bytes but no group.

create function public.v1_storage_usage()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with mine as (
    select f.kind, f.stored_bytes, f.status, f.deleted_at
    from public.files f
    where f.together_id = (select public.my_together_id())
  ),
  part as (
    select
      case when deleted_at is not null then 'bin' else kind::text || 's' end as name,
      count(*)::integer as count,
      sum(stored_bytes)::bigint as bytes
    from mine
    where status = 'ready' or deleted_at is not null
    group by 1
  )
  select jsonb_build_object(
    'quota_bytes', t.storage_quota_bytes,
    'used_bytes', (select coalesce(sum(stored_bytes), 0)::bigint from mine),
    'photos', coalesce((select jsonb_build_object('count', count, 'bytes', bytes) from part where name = 'photos'), '{"count": 0, "bytes": 0}'),
    'videos', coalesce((select jsonb_build_object('count', count, 'bytes', bytes) from part where name = 'videos'), '{"count": 0, "bytes": 0}'),
    'documents', coalesce((select jsonb_build_object('count', count, 'bytes', bytes) from part where name = 'documents'), '{"count": 0, "bytes": 0}'),
    'bin', coalesce((select jsonb_build_object('count', count, 'bytes', bytes) from part where name = 'bin'), '{"count": 0, "bytes": 0}')
  )
  from public.togethers t
  where t.id = (select public.my_together_id());
$$;

revoke execute on function public.v1_storage_usage() from public, anon;
grant execute on function public.v1_storage_usage() to authenticated;
