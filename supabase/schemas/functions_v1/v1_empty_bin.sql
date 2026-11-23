-- Empty the current Together's bin now: everything in it is marked as 30 days old, so the next purge (the daily job)
-- deletes the rows and their Storage objects. Returns how many items were in it.

create function public.v1_empty_bin()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if public.my_together_id() is null then
    raise exception 'You''re not in a Together yet.' using errcode = '42501';
  end if;
  update public.files
  set deleted_at = least(deleted_at, now() - interval '30 days')
  where together_id = public.my_together_id() and deleted_at is not null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.v1_empty_bin() from public, anon;
grant execute on function public.v1_empty_bin() to authenticated;
